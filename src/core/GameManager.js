import * as THREE from 'three';
import { Bot } from '../entities/Bot.js';
import { CONFIG } from './Config.js';
import { emit, on } from './EventBus.js';

export class GameManager {
  constructor({ scene, world, player, weapons, botSpawns = [], bounds = [-24, 24, -24, 24] }) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.weapons = weapons;
    this.botSpawns = botSpawns;
    this.bounds = bounds;

    this.bots = [];
    this.doors = [];
    this.hasStarted = false;
    this.roundOver = false;
    this.roundDuration = 210; // Padrão 3m 30s
    this.roundTimeLeft = 210;
    this.killCombo = 0;
    this.lastKillTime = -999;

    this._setupEvents();
  }

  setRoundDuration(seconds) {
    this.roundDuration = seconds;
    if (!this.hasStarted) {
      this.roundTimeLeft = seconds;
      emit('round:timer', this.roundTimeLeft);
    }
  }

  _setupEvents() {
    // Danos causados por tiro de Bot no Player
    on('bot:fired', ({ bot, player: p, dist }) => {
      const chance = Math.max(0.15, 1 - dist / 35);
      if (Math.random() < chance) {
        const dmg = CONFIG.BOTS.damageBody + Math.random() * 6;
        p.takeDamage(dmg, bot);
      }
    });

    // Quando qualquer bot morre: registra kill e agenda respawn com lock-in de posição
    on('bot:died', e => {
      this.registerKill(e.headshot);
      if (e.bot) {
        this.scheduleBotRespawn(e.bot);
      }
    });
  }

  setDoors(doors) {
    this.doors = doors;
  }

  /**
   * Calcula a distância euclidiana exata no plano horizontal (X/Z) de um ponto até uma caixa AABB.
   * Se o ponto estiver dentro da caixa, retorna 0.
   */
  _distToBox(px, pz, b) {
    const dx = Math.max(0, b.min.x - px, px - b.max.x);
    const dz = Math.max(0, b.min.z - pz, pz - b.max.z);
    return Math.hypot(dx, dz);
  }

  /**
   * Avalia se uma posição (px, pz) está desobstruída e cumpre as regras de segurança:
   * - Dentro dos limites do mapa
   * - Distância mínima de qualquer prop/parede sólida (ignora o chão y <= 0.2)
   * - Distância mínima do jogador
   * - Distância mínima de outros bots ou posições já reservadas
   */
  _isPositionClear(px, pz, minPropDist = 3.0, minPlayerDist = 11.0, ignoreBot = null) {
    const [minX, maxX, minZ, maxZ] = this.bounds;
    if (px < minX + 2.5 || px > maxX - 2.5 || pz < minZ + 2.5 || pz > maxZ - 2.5) {
      return false;
    }

    if (this.player) {
      const distP = Math.hypot(px - this.player.pos.x, pz - this.player.pos.z);
      if (distP < minPlayerDist) return false;
    }

    if (this.world?.boxes) {
      for (const b of this.world.boxes) {
        if (!b.solid || b.max.y <= 0.2) continue;
        if (this._distToBox(px, pz, b) < minPropDist) {
          return false;
        }
      }
    }

    for (const other of this.bots) {
      if (other === ignoreBot) continue;
      if (other.alive) {
        if (Math.hypot(px - other.pos.x, pz - other.pos.z) < 2.5) return false;
      } else if (other.nextSpawnPos) {
        if (Math.hypot(px - other.nextSpawnPos.x, pz - other.nextSpawnPos.z) < 2.5) return false;
      }
    }

    return true;
  }

  /**
   * Busca uma coordenada segura no mapa livre de props e do jogador.
   * Dá lock-in no melhor ponto disponível.
   */
  _findClearSpawnPos(minPropDist = 3.0, minPlayerDist = 11.0, forBot = null) {
    // 1. Testa os pontos pré-configurados do mapa
    if (this.botSpawns && this.botSpawns.length > 0) {
      const validPresets = [];
      for (const s of this.botSpawns) {
        const sx = s[0];
        const sz = s[2];
        if (this._isPositionClear(sx, sz, minPropDist, minPlayerDist, forBot)) {
          const distToP = Math.hypot(sx - this.player.pos.x, sz - this.player.pos.z);
          validPresets.push({ x: sx, y: s[1] || 0.6, z: sz, distToP });
        }
      }
      if (validPresets.length > 0) {
        validPresets.sort((a, b) => b.distToP - a.distToP);
        const pick = validPresets[Math.floor(Math.random() * Math.min(2, validPresets.length))];
        return { x: pick.x, y: pick.y, z: pick.z };
      }
    }

    // 2. Busca aleatória por espaço aberto com pelo menos 3 metros de distância de props
    const [minX, maxX, minZ, maxZ] = this.bounds;
    for (let i = 0; i < 45; i++) {
      const rx = minX + 3.5 + Math.random() * (maxX - minX - 7);
      const rz = minZ + 3.5 + Math.random() * (maxZ - minZ - 7);
      if (this._isPositionClear(rx, rz, minPropDist, minPlayerDist, forBot)) {
        return { x: rx, y: 0.6, z: rz };
      }
    }

    // 3. Relaxamento controlado de margens caso o mapa tenha alta densidade
    for (let i = 0; i < 30; i++) {
      const rx = minX + 2.5 + Math.random() * (maxX - minX - 5);
      const rz = minZ + 2.5 + Math.random() * (maxZ - minZ - 5);
      if (this._isPositionClear(rx, rz, 1.8, 8.0, forBot)) {
        return { x: rx, y: 0.6, z: rz };
      }
    }

    // 4. Fallback absoluto nos presets
    if (this.botSpawns && this.botSpawns.length > 0) {
      const sorted = [...this.botSpawns].sort((a, b) => {
        const da = Math.hypot(a[0] - this.player.pos.x, a[2] - this.player.pos.z);
        const db = Math.hypot(b[0] - this.player.pos.x, b[2] - this.player.pos.z);
        return db - da;
      });
      return { x: sorted[0][0], y: sorted[0][1] || 0.6, z: sorted[0][2] };
    }

    return { x: 0, y: 0.6, z: 0 };
  }

  /**
   * Agenda o respawn de um bot: busca o local limpo e dá lock-in nele.
   */
  scheduleBotRespawn(bot) {
    if (!bot) return;
    const safePos = this._findClearSpawnPos(3.0, 11.0, bot);
    bot.nextSpawnPos = safePos;
    bot.respawnTimer = CONFIG.BOTS.respawnTime || 4.0;
  }

  /**
   * Finaliza o respawn ativando o bot exatamente na posição reservada (lock-in).
   */
  finalizeBotRespawn(b) {
    b.respawn();

    const spawnPos = b.nextSpawnPos || this._findClearSpawnPos(3.0, 11.0, b);
    b.pos.set(spawnPos.x, spawnPos.y || 0.6, spawnPos.z);
    b.vel.set(0, 0, 0);
    b.hp = b.maxHp;
    b.alive = true;
    b.respawnTimer = 0;
    b.nextSpawnPos = null;

    b.root.position.copy(b.pos);
    b.root.visible = true;

    if (b.ai) {
      b.ai.state = 'patrol';
      b.ai.reactionTimer = 0;
      b.ai.losTimer = 0;
      b.ai.searchTimer = 0;
      b.ai.patrolTarget = null;
      b.ai.fireTimer = 0.8 + Math.random() * 0.5;
    }
  }

  respawnBot(b) {
    this.finalizeBotRespawn(b);
  }

  spawnBot(id) {
    const b = new Bot(id, this.world, this.scene);
    this.finalizeBotRespawn(b);
    return b;
  }

  setBotCount(count) {
    const n = Math.max(0, Math.min(20, count | 0));

    while (this.bots.length > n) {
      const b = this.bots.pop();
      this.scene.remove(b.root);
      b.root.traverse(o => {
        if (o.geometry) o.geometry.dispose();
      });
    }

    while (this.bots.length < n) {
      this.bots.push(this.spawnBot(this.bots.length + 1));
    }
  }

  setBotSkin(skin) {
    Bot.skinType = skin;
    const n = this.bots.length;
    while (this.bots.length > 0) {
      const b = this.bots.pop();
      this.scene.remove(b.root);
      b.root.traverse(o => {
        if (o.geometry) o.geometry.dispose();
      });
    }
    for (let i = 1; i <= n; i++) {
      this.bots.push(this.spawnBot(i));
    }
  }

  resetGame() {
    this.roundOver = false;
    this.roundTimeLeft = this.roundDuration;
    this.killCombo = 0;
    this.lastKillTime = -999;
    
    // Reset da HUD via EventBus
    emit('game:reset');

    // Respawna Player
    this.player.hp = this.player.maxHp;
    this.player.alive = true;
    this.player.pos.set(0, 0.1, 12);
    this.player.vel.set(0, 0, 0);
    emit('player:hp', { hp: this.player.hp, max: this.player.maxHp });

    // Reposiciona Bots com posições seguras
    for (const b of this.bots) {
      this.finalizeBotRespawn(b);
    }

    // Recarrega Arma
    if (this.weapons) {
      this.weapons.ammo = this.weapons.def.magSize;
      this.weapons.reloading = false;
      emit('weapon:ammo', { ammo: this.weapons.ammo, max: this.weapons.def.magSize });
    }
  }

  update(dt) {
    if (!this.hasStarted || this.roundOver) return;

    // Timer do Round
    this.roundTimeLeft -= dt;
    if (this.roundTimeLeft <= 0) {
      this.roundTimeLeft = 0;
      this.endRound();
    }
    emit('round:timer', this.roundTimeLeft);
    
    // Atualiza portas e interação
    let nearDoor = null;
    for (const d of this.doors) {
      d.update(dt);
      const dist = this.player.pos.distanceTo(d.pivot.position);
      if (dist < d.interactRange) {
        nearDoor = d;
      }
    }
    emit('interact:target', nearDoor);
    if (nearDoor && this.player.alive && this.weapons?.input?.consumeAction('interact')) {
      nearDoor.toggle();
    }

    // Atualiza bots e Colisões Bot-Player
    for (const b of this.bots) {
      if (!b.alive) {
        if (b.respawnTimer > 0) {
          b.respawnTimer -= dt;
          if (b.respawnTimer <= 0) {
            this.finalizeBotRespawn(b);
          }
        } else if (!b.nextSpawnPos) {
          // Failsafe: se algum bot morreu sem agendamento prévio, agenda imediatamente
          this.scheduleBotRespawn(b);
        }
        continue;
      }
      b.update(dt, this.player);

      // Repulsão (anti-clipping)
      const dx = this.player.pos.x - b.pos.x;
      const dz = this.player.pos.z - b.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.8 && dist > 0.001) {
        const push = (0.8 - dist) * 0.5;
        this.player.pos.x += (dx / dist) * push;
        this.player.pos.z += (dz / dist) * push;
        b.pos.x -= (dx / dist) * push;
        b.pos.z -= (dz / dist) * push;
      }
    }
  }

  registerKill(headshot) {
    const now = performance.now() / 1000;
    if (now - this.lastKillTime < 3.5) this.killCombo++;
    else this.killCombo = 1;
    this.lastKillTime = now;

    emit('kill:combo', { combo: this.killCombo, headshot });
  }

  endRound() {
    this.roundOver = true;
    if (document.pointerLockElement) document.exitPointerLock();
    emit('round:over');
  }
}
