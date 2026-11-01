import * as THREE from 'three';
import { Bot } from '../entities/Bot.js';
import { ItemDrop } from '../world/ItemDrop.js';
import { MagazineDrop } from '../weapons/MagazineDrop.js';
import { CONFIG } from './ConfigLoader.js';
import { emit, on } from './EventBus.js';
import { WEAPONS } from '../weapons/WeaponDefs.js';
import { DeathmatchMode } from './modes/DeathmatchMode.js';

const _tempPelletDir = new THREE.Vector3();

export class GameManager {
  constructor({ scene, world, player, weapons, botSpawns = [], playerSpawn = null, bounds = [-24, 24, -24, 24] }) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.weapons = weapons;
    this.botSpawns = botSpawns;
    this.playerSpawn = playerSpawn;
    this.bounds = bounds;

    // Conecta ProjectileManager ao GameManager se disponível
    if (this.weapons?.projectileManager) {
      this.weapons.projectileManager.setGameManager(this);
    }

    // Modo de Jogo Ativo (Padrão: Deathmatch / Mata-Mata FFA)
    const allSpawns = [...(playerSpawn ? [playerSpawn] : []), ...(botSpawns || [])];
    this.gameMode = new DeathmatchMode({
      bounds: this.bounds,
      spawns: allSpawns
    });

    if (this.player) {
      this.player.onRespawnRequest = () => this.getSpawnPoint(this.player);
      this.gameMode.registerCombatant(this.player);
    }

    this.bots = [];
    this.doors = [];
    this.plinkers = [];
    this.itemDrops = [];
    this.magazineDrops = [];
    this.hasStarted = false;
    this.roundOver = false;
    this.roundDuration = 210; // Padrão 3m 30s
    this.roundTimeLeft = 210;
    this._lastEmittedTimerSec = -1;
    this.killCombo = 0;
    this.lastKillTime = -999;
    this._lastInteractTarget = null;

    this._setupEvents();
  }

  setGameMode(mode) {
    this.gameMode = mode;
  }

  isEnemy(entityA, entityB) {
    if (this.gameMode) return this.gameMode.isEnemy(entityA, entityB);
    return entityA !== entityB && entityA?.alive && entityB?.alive;
  }

  canDamage(attacker, victim) {
    if (this.gameMode) return this.gameMode.canDamage(attacker, victim);
    return attacker !== victim;
  }

  getSpawnPoint(entity) {
    const allCombatants = [this.player, ...this.bots].filter(Boolean);
    const allSpawns = [...(this.playerSpawn ? [this.playerSpawn] : []), ...(this.botSpawns || [])];
    if (this.gameMode) {
      return this.gameMode.getSpawnPoint(entity, {
        bounds: this.bounds,
        world: this.world,
        combatants: allCombatants,
        spawns: allSpawns,
        isPositionClear: (px, py, pz, minPropDist, minOtherDist, ignoreEntity) =>
          this._isPositionClear(px, py, pz, minPropDist, minOtherDist, ignoreEntity)
      });
    }
    return this._findClearSpawnPos(3.0, 11.0, entity);
  }

  startMatch() {
    this.hasStarted = true;
    if (this.weapons && typeof this.weapons.setLoadoutLocked === 'function') {
      this.weapons.setLoadoutLocked(true);
    }
    if (this.gameMode) {
      emit('match:score_update', { scoreboard: this.gameMode.getScoreboard() });
    }
  }

  _getRandomWeaponId() {
    const keys = Object.keys(WEAPONS);
    const catalog = keys.length > 0 ? keys : ['ar15', 'ak47', 'rifle_proto', 'uzi', 'm249', 'p9', 'sw500', 'm12', 'vss', 'scar_h'];
    return catalog[Math.floor(Math.random() * catalog.length)];
  }

  setRoundDuration(seconds) {
    this.roundDuration = seconds;
    if (!this.hasStarted) {
      this.roundTimeLeft = seconds;
      this._lastEmittedTimerSec = Math.floor(this.roundTimeLeft);
      emit('round:timer', { timeLeft: this.roundTimeLeft, seconds: this.roundTimeLeft });
    }
  }

  _setupEvents() {
    this._unsubs = [
      // Disparo de Bot: Spawna projétil físico contínuo com CCD, balística realista e supressão tática
      on('bot:fired', e => {
        const bot = e.bot;
        const p = e.player || this.player;
        const def = bot?.weaponId ? WEAPONS[bot.weaponId] : null;

        if (this.weapons?.projectileManager && def && e.muzzleWorld && e.dir) {
          const pelletCount = def.pellets || 1;
          for (let i = 0; i < pelletCount; i++) {
            let pelletDir = e.dir;
            if (pelletCount > 1) {
              const spread = def.spreadHip || 0.035;
              const angle = Math.random() * Math.PI * 2;
              const radius = Math.random() * spread;
              _tempPelletDir.copy(e.dir);
              _tempPelletDir.x += Math.cos(angle) * radius;
              _tempPelletDir.y += Math.sin(angle) * radius;
              _tempPelletDir.normalize();
              pelletDir = _tempPelletDir;
            }
            this.weapons.projectileManager.spawn({
              origin: e.muzzleWorld,
              direction: pelletDir,
              weaponDef: def,
              owner: 'bot',
              ownerEntity: bot,
              isPellet: pelletCount > 1
            });
          }
        } else if (p && p.alive) {
          // Fallback caso não haja projectileManager instanciado
          const isHit = typeof e.hit === 'boolean' ? e.hit : (() => {
            const base = CONFIG.BOTS?.hitAccuracyBase ?? 0.08;
            const range = CONFIG.BOTS?.hitAccuracyRange ?? 28.0;
            const maxAcc = CONFIG.BOTS?.hitAccuracyMax ?? 0.55;
            const chance = Math.min(maxAcc, Math.max(base, 1 - (e.dist || 10) / range));
            return Math.random() < chance;
          })();

          if (isHit) {
            const baseDamage = def?.damageBody || CONFIG.BOTS?.damageBody || 14;
            const dmg = baseDamage * (0.8 + Math.random() * 0.4);
            if (p.isPlayer || p === this.player) {
              p.takeDamage(dmg, bot);
            } else {
              p.takeDamage(dmg, 'body', bot);
            }
          }
        }
      }),

      // Quando qualquer bot morre: registra kill, dropa arma/loot específica e agenda respawn
      on('bot:died', e => {
        const killer = e?.attacker !== undefined ? e.attacker : (this.player || null);
        const killInfo = this.gameMode
          ? this.gameMode.onKill(killer, e.bot, e.headshot, { player: this.player, weaponId: killer?.weaponId })
          : null;

        if (killInfo) {
          emit('match:kill', killInfo);
          emit('match:score_update', { scoreboard: this.gameMode.getScoreboard() });
        }

        if (e?.attacker === this.player || killInfo?.isPlayerKiller) {
          this.registerKill(e?.headshot);
        }

        if (e.bot) {
          const dropWeapon = e.bot.weaponId || this._getRandomWeaponId();
          const def = WEAPONS[dropWeapon];
          const ammo = def?.magSize || 30;
          this.spawnItemDrop(e.bot.pos, dropWeapon, ammo);
          e.bot.respawnTimer = CONFIG.BOTS.respawnTime || 4.0;
          setTimeout(() => {
            if (e.bot && !e.bot.alive) this.scheduleBotRespawn(e.bot);
          }, 0);
        }
      }),

      on('player:died', e => {
        const killer = e?.attacker;
        const killInfo = this.gameMode
          ? this.gameMode.onKill(killer, this.player, false, { player: this.player, weaponId: killer?.weaponId })
          : null;

        if (killInfo) {
          emit('match:kill', killInfo);
          emit('match:score_update', { scoreboard: this.gameMode.getScoreboard() });
        }
      }),
      on('player:respawn', () => {
        if (this.gameMode) {
          emit('match:score_update', { scoreboard: this.gameMode.getScoreboard() });
        }
      }),
      on('weapon:magazine_dropped', e => {
        this.spawnMagazineDrop(e.pos, e.weaponId, e.ammoCount, e.maxAmmo);
      }),
    ];
  }

  spawnItemDrop(pos, weaponId = 'ar15', ammo = 30) {
    const drop = new ItemDrop({
      weaponId,
      ammo,
      pos: { x: pos.x, y: pos.y + 0.3, z: pos.z },
      scene: this.scene,
      world: this.world,
    });
    this.itemDrops.push(drop);

    // Limit persistent drops to avoid lag (FIFO queue)
    const MAX_DROPS = 2;
    while (this.itemDrops.length > MAX_DROPS) {
      const oldestDrop = this.itemDrops.shift();
      if (oldestDrop) oldestDrop.destroy();
    }

    return drop;
  }

  spawnMagazineDrop(pos, weaponId = 'ar15', ammoCount = 0, maxAmmo = 30) {
    const drop = new MagazineDrop({
      scene: this.scene,
      world: this.world,
      weaponId,
      ammoCount,
      maxAmmo,
      pos,
    });
    this.magazineDrops.push(drop);

    const MAX_MAGS = 16;
    while (this.magazineDrops.length > MAX_MAGS) {
      const oldest = this.magazineDrops.shift();
      if (oldest) oldest.destroy();
    }

    return drop;
  }

  destroy() {
    this.hasStarted = false;
    this.roundOver = false;
    if (this.weapons && typeof this.weapons.setLoadoutLocked === 'function') {
      this.weapons.setLoadoutLocked(false);
    }
    if (this._unsubs) {
      for (const unsub of this._unsubs) unsub();
      this._unsubs = [];
    }
    while (this.itemDrops.length > 0) {
      const d = this.itemDrops.pop();
      if (d && typeof d.destroy === 'function') d.destroy();
    }
    while (this.magazineDrops.length > 0) {
      const m = this.magazineDrops.pop();
      if (m && typeof m.destroy === 'function') m.destroy();
    }
    while (this.bots.length > 0) {
      const b = this.bots.pop();
      if (b && typeof b.destroy === 'function') b.destroy();
    }
    if (this.doors) {
      for (const d of this.doors) {
        if (d && typeof d.destroy === 'function') d.destroy();
      }
      this.doors = [];
    }
    if (this.plinkers) {
      for (const p of this.plinkers) {
        if (p && typeof p.destroy === 'function') p.destroy();
      }
      this.plinkers = [];
    }
  }

  setDoors(doors) {
    this.doors = doors;
  }

  setPlinkers(plinkers) {
    this.plinkers = Array.isArray(plinkers) ? plinkers : [];
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
   * Avalia se uma posição (px, py, pz) está desobstruída e cumpre as regras de segurança:
   * - Dentro dos limites do mapa
   * - Distância mínima de qualquer prop/parede sólida considerando a cota vertical (Y):
   *   caixas abaixo dos pés (b.max.y <= py + 0.1) são suporte/chão (lajes e telhados válidos).
   *   caixas acima da cabeça (b.min.y >= py + 1.85) não obstruem.
   * - Distância mínima do jogador e de outros bots.
   */
  _isPositionClear(px, py, pz, minPropDist = 3.0, minOtherDist = 11.0, ignoreEntity = null) {
    let y = py;
    let z = pz;
    let propDist = minPropDist;
    let otherDist = minOtherDist;
    let ignore = ignoreEntity;

    // Suporte retrocompatível se chamado no formato legado 2D (px, pz, ...)
    if (arguments.length <= 5 && (typeof minOtherDist === 'object' || (typeof py === 'number' && typeof pz !== 'number'))) {
      z = py;
      y = 0.6;
      propDist = typeof pz === 'number' ? pz : 3.0;
      otherDist = typeof minPropDist === 'number' ? minPropDist : 11.0;
      ignore = typeof minOtherDist === 'object' ? minOtherDist : null;
    } else if (typeof y !== 'number') {
      y = 0.6;
    }

    const [minX, maxX, minZ, maxZ] = this.bounds;
    if (px < minX + 2.5 || px > maxX - 2.5 || z < minZ + 2.5 || z > maxZ - 2.5) {
      return false;
    }

    if (this.player && this.player !== ignore) {
      const distP = Math.hypot(px - this.player.pos.x, z - this.player.pos.z);
      const dyP = Math.abs(y - this.player.pos.y);
      if (distP < otherDist && dyP < 3.0) return false;
    }

    for (const other of this.bots) {
      if (other === ignore) continue;
      if (other.alive) {
        const distOther = Math.hypot(px - other.pos.x, z - other.pos.z);
        const dyOther = Math.abs(y - other.pos.y);
        if (distOther < 2.5 && dyOther < 2.5) return false;
      } else if (other.nextSpawnPos) {
        const nextY = other.nextSpawnPos.y ?? 0.6;
        const distNext = Math.hypot(px - other.nextSpawnPos.x, z - other.nextSpawnPos.z);
        const dyNext = Math.abs(y - nextY);
        if (distNext < 2.5 && dyNext < 2.5) return false;
      }
    }

    const checkBoxes = (candidates) => {
      for (let i = 0; i < candidates.length; i++) {
        const b = candidates[i];
        if (!b.solid) continue;

        // Se a caixa estiver abaixo dos pés do spawn, ela atua como chão de suporte (laje/telhado), NÃO bloqueio
        if (b.max.y <= y + 0.1) continue;

        // Se a caixa estiver acima da cabeça do personagem, não obstrui
        if (b.min.y >= y + 1.85) continue;

        // Conflito de volume vertical: verifica distância horizontal
        if (this._distToBox(px, z, b) < propDist) {
          return false;
        }
      }
      return true;
    };

    if (this.world?.getNearbyBoxes) {
      const r = propDist;
      const candidates = this.world.getNearbyBoxes(px - r, px + r, z - r, z + r);
      if (!checkBoxes(candidates)) return false;
    } else if (this.world?.boxes) {
      if (!checkBoxes(this.world.boxes)) return false;
    }

    return true;
  }

  /**
   * Busca uma coordenada segura no mapa livre de props e do jogador.
   * Dá lock-in no melhor ponto disponível.
   */
  _findClearSpawnPos(minPropDist = 3.0, minPlayerDist = 11.0, forBot = null) {
    if (this.gameMode) {
      return this.gameMode.getSpawnPoint(forBot, {
        bounds: this.bounds,
        world: this.world,
        combatants: [this.player, ...this.bots].filter(Boolean),
        spawns: [...(this.playerSpawn ? [this.playerSpawn] : []), ...(this.botSpawns || [])],
        isPositionClear: (px, py, pz, pDist, oDist, ign) => this._isPositionClear(px, py, pz, pDist, oDist, ign)
      });
    }

    // 1. Testa os pontos pré-configurados do mapa
    if (this.botSpawns && this.botSpawns.length > 0) {
      const validPresets = [];
      for (const s of this.botSpawns) {
        const sx = s[0];
        const sy = s[1] || 0.6;
        const sz = s[2];
        if (this._isPositionClear(sx, sy, sz, minPropDist, minPlayerDist, forBot)) {
          const distToP = Math.hypot(sx - this.player.pos.x, sz - this.player.pos.z);
          validPresets.push({ x: sx, y: sy, z: sz, distToP });
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
      if (this._isPositionClear(rx, 0.6, rz, minPropDist, minPlayerDist, forBot)) {
        return { x: rx, y: 0.6, z: rz };
      }
    }

    // 3. Relaxamento controlado de margens caso o mapa tenha alta densidade
    for (let i = 0; i < 30; i++) {
      const rx = minX + 2.5 + Math.random() * (maxX - minX - 5);
      const rz = minZ + 2.5 + Math.random() * (maxZ - minZ - 5);
      if (this._isPositionClear(rx, 0.6, rz, 1.8, 8.0, forBot)) {
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
    const safePos = this.getSpawnPoint(bot);
    bot.nextSpawnPos = safePos;
    if (bot.respawnTimer <= 0) {
      bot.respawnTimer = CONFIG.BOTS.respawnTime || 4.0;
    }
  }

  /**
   * Finaliza o respawn ativando o bot exatamente na posição reservada (lock-in).
   */
  finalizeBotRespawn(b) {
    b.respawn();
    b.weaponId = this._getRandomWeaponId();

    const spawnPos = b.nextSpawnPos || this.getSpawnPoint(b);
    b.setPosition(spawnPos.x, spawnPos.y ?? 0.6, spawnPos.z);
    b.vel.set(0, 0, 0);
    b.hp = b.maxHp;
    b.alive = true;
    b.respawnTimer = 0;
    b.nextSpawnPos = null;

    if (b.root) {
      b.root.position.copy(b.pos);
      b.root.visible = true;
    }

    if (b.ai) {
      b.ai.clearPath?.();
      b.ai.state = 'patrol';
      b.ai.reactionTimer = 0;
      b.ai.losTimer = 0;
      b.ai.searchTimer = 0;
      b.ai.hasPatrolTarget = false;
      b.ai.fireTimer = 0.8 + Math.random() * 0.5;
    }

    if (this.gameMode) {
      emit('match:score_update', { scoreboard: this.gameMode.getScoreboard() });
    }
  }

  respawnBot(b) {
    this.finalizeBotRespawn(b);
  }

  spawnBot(id) {
    const weaponId = this._getRandomWeaponId();
    const b = new Bot(id, this.world, this.scene, Bot.skinType, weaponId);
    b.gameManager = this;
    if (b.ai) {
      b.ai.gameManager = this;
    }
    if (this.gameMode) {
      this.gameMode.registerCombatant(b);
    }
    this.finalizeBotRespawn(b);
    return b;
  }

  setBotCount(count) {
    const n = Math.max(0, Math.min(20, count | 0));

    while (this.bots.length > n) {
      const b = this.bots.pop();
      b.destroy();
    }

    while (this.bots.length < n) {
      this.bots.push(this.spawnBot(this.bots.length + 1));
    }

    if (this.gameMode) {
      emit('match:score_update', { scoreboard: this.gameMode.getScoreboard() });
    }
  }

  setBotSkin(skin) {
    Bot.skinType = skin;
    const n = this.bots.length;
    while (this.bots.length > 0) {
      const b = this.bots.pop();
      b.destroy();
    }
    for (let i = 1; i <= n; i++) {
      this.bots.push(this.spawnBot(i));
    }
  }

  resetGame() {
    this.roundOver = false;
    this.roundTimeLeft = this.roundDuration;
    this._lastEmittedTimerSec = -1;
    this.killCombo = 0;
    this.lastKillTime = -999;
    
    if (this.gameMode) {
      this.gameMode.reset();
      emit('match:score_update', { scoreboard: this.gameMode.getScoreboard() });
    }

    // Reset da HUD via EventBus
    emit('game:reset', {});

    // Respawna Player
    if (this.player) {
      this.player.hp = this.player.maxHp;
      this.player.alive = true;
      const playerSpawnPos = this.getSpawnPoint(this.player);
      this.player.setPosition(playerSpawnPos.x, playerSpawnPos.y, playerSpawnPos.z);
      this.player.vel.set(0, 0, 0);
      emit('player:hp', { hp: this.player.hp, max: this.player.maxHp });
    }

    // Reposiciona Bots com posições seguras
    for (const b of this.bots) {
      this.finalizeBotRespawn(b);
    }

    // Aplica loadout pendente e recarrega arma
    if (this.weapons) {
      if (typeof this.weapons.applyPendingSlots === 'function') {
        this.weapons.applyPendingSlots();
      }
      this.weapons.ammo = this.weapons.def.magSize;
      this.weapons.reloading = false;
      emit('weapon:ammo', { ammo: this.weapons.ammo, max: this.weapons.def.magSize });
    }
  }

  renderUpdate(alpha, dt) {
    if (this.plinkers) {
      for (let i = 0; i < this.plinkers.length; i++) {
        this.plinkers[i].update(dt);
      }
    }
    if (!this.hasStarted || this.roundOver) return;
    for (const b of this.bots) {
      if (b.renderUpdate) b.renderUpdate(alpha, dt);
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
    const newSec = Math.floor(this.roundTimeLeft);
    if (newSec !== this._lastEmittedTimerSec) {
      this._lastEmittedTimerSec = newSec;
      emit('round:timer', { timeLeft: this.roundTimeLeft, seconds: this.roundTimeLeft });
    }
    
    // Atualiza portas e interação
    let nearDoor = null;
    let minDoorDist = Infinity;
    for (const d of this.doors) {
      d.update(dt);
      const dist = this.player.pos.distanceTo(d.pivot.position);
      if (dist < d.interactRange && dist < minDoorDist) {
        minDoorDist = dist;
        nearDoor = d;
      }
    }

    // Atualiza Drops e Coleta de Itens
    let nearDrop = null;
    let minDropDist = Infinity;
    for (let i = this.itemDrops.length - 1; i >= 0; i--) {
      const drop = this.itemDrops[i];
      drop.update(dt);

      if (drop.checkPickup(this.player)) {
        const dropPos = drop.mesh?.position || this.player.pos;
        const d = this.player.pos.distanceTo(dropPos);
        if (d < minDropDist) {
          minDropDist = d;
          nearDrop = drop;
        }
        if (this.weapons) {
          // Se tiver a mesma arma equipada e precisar de munição, reabastece ao passar
          if (this.weapons.current === drop.weaponId && this.weapons.ammo < this.weapons.def.magSize) {
            this.weapons.ammo = this.weapons.def.magSize;
            emit('weapon:ammo', { ammo: this.weapons.ammo, max: this.weapons.def.magSize });
            emit('notification', { message: `+Munição: ${drop.weaponId.toUpperCase()}` });
            drop.destroy();
            this.itemDrops.splice(i, 1);
            continue;
          }
        }
      }
    }

    // Atualiza Carregadores descartados no mapa
    let nearMag = null;
    let minMagDist = Infinity;
    for (let i = this.magazineDrops.length - 1; i >= 0; i--) {
      const mag = this.magazineDrops[i];
      if (mag.collected) {
        this.magazineDrops.splice(i, 1);
        continue;
      }
      mag.update(dt);
      if (mag.checkPickup(this.player)) {
        const d = this.player.pos.distanceTo(mag.pos);
        if (d < minMagDist) {
          minMagDist = d;
          nearMag = mag;
        }
      }
    }

    // Alvo contextual de interação (porta, carregador ou drop de arma no chão)
    const interactTarget = nearDoor || nearMag || nearDrop;
    if (interactTarget !== this._lastInteractTarget) {
      this._lastInteractTarget = interactTarget;
      emit('interact:target', { target: interactTarget });
    }

    if (this.player.alive && this.weapons?.input?.consumeAction('interact')) {
      if (nearDoor) {
        nearDoor.toggle();
      } else if (nearMag) {
        const wepName = WEAPONS[nearMag.weaponId]?.name || nearMag.weaponId.toUpperCase();
        emit('notification', { message: `+Carregador ${wepName} (${nearMag.ammoCount} balas)` });
        if (this.weapons) {
          this.weapons.addReserveMag(nearMag.weaponId, nearMag.ammoCount);
        }
        nearMag.destroy();
        const dropIdx = this.magazineDrops.indexOf(nearMag);
        if (dropIdx !== -1) this.magazineDrops.splice(dropIdx, 1);
      } else if (nearDrop) {
        // Substitui a arma do slot atual ativo e dropa a anterior
        const oldWeapon = this.weapons.pickupWeapon(nearDrop.weaponId);
        emit('notification', { message: `Slot ${this.weapons.currentSlot + 1}: Equipou ${nearDrop.weaponId.toUpperCase()}` });
        
        const dropPos = nearDrop.mesh?.position?.clone() || this.player.pos.clone();
        nearDrop.destroy();
        const dropIdx = this.itemDrops.indexOf(nearDrop);
        if (dropIdx !== -1) this.itemDrops.splice(dropIdx, 1);

        if (oldWeapon) {
          const oldDef = WEAPONS[oldWeapon];
          const oldAmmo = oldDef?.magSize || 30;
          this.spawnItemDrop(dropPos, oldWeapon, oldAmmo);
        }
      }
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
    emit('round:over', {});
  }
}
