import * as THREE from 'three';
import { Bot } from '../entities/Bot.js';
import { CONFIG } from './Config.js';
import { emit, on } from './EventBus.js';

export class GameManager {
  constructor({ scene, world, player, weapons, botSpawns = [] }) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.weapons = weapons;
    this.botSpawns = botSpawns;

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

    on('bot:died', e => {
      this.registerKill(e.headshot);
    });
  }

  setDoors(doors) {
    this.doors = doors;
  }

  _findSafeSpawnPos() {
    let sx = 0, sz = 0, tries = 0;
    const boundsLimit = 22;
    do {
      const a = Math.random() * Math.PI * 2;
      const r = 10 + Math.random() * 12;
      sx = this.player.pos.x + Math.cos(a) * r;
      sz = this.player.pos.z + Math.sin(a) * r;
      tries++;
    } while (tries < 35 && (Math.abs(sx) > boundsLimit || Math.abs(sz) > boundsLimit));

    // Fallback se não achar posição livre longe da borda
    if (Math.abs(sx) > boundsLimit) sx = (Math.random() - 0.5) * 20;
    if (Math.abs(sz) > boundsLimit) sz = (Math.random() - 0.5) * 20;

    return { x: sx, z: sz };
  }

  respawnBot(b) {
    b.respawn();

    let sx = 0, sz = 0, sy = 0.6;
    if (this.botSpawns && this.botSpawns.length > 0) {
      // Ordena spawns por distância decrescente do player para não spawnar na cara dele
      const sorted = [...this.botSpawns].sort((s1, s2) => {
        const d1 = Math.hypot(s1[0] - this.player.pos.x, s1[2] - this.player.pos.z);
        const d2 = Math.hypot(s2[0] - this.player.pos.x, s2[2] - this.player.pos.z);
        return d2 - d1;
      });
      // Pega um dos spawns mais distantes com variação aleatória suave
      const pick = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
      sx = pick[0] + (Math.random() - 0.5) * 2;
      sy = pick[1] || 0.6;
      sz = pick[2] + (Math.random() - 0.5) * 2;
    } else {
      const sp = this._findSafeSpawnPos();
      sx = sp.x;
      sz = sp.z;
    }

    b.pos.set(sx, sy, sz);
    b.vel.set(0, 0, 0);
    b.root.position.copy(b.pos);
    b.root.visible = true;
  }

  spawnBot(id) {
    const b = new Bot(id, this.world, this.scene);
    this.respawnBot(b);
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

    // Reposiciona Bots
    for (const b of this.bots) {
      this.respawnBot(b);
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
          if (b.respawnTimer <= 0) this.respawnBot(b);
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

  respawnBot(b) {
    b.hp = b.maxHp;
    b.alive = true;
    b.respawnTimer = 0;
    b.vel.set(0, 0, 0);
    
    // Reseta inteligência artificial
    if (b.ai) {
      b.ai.state = 'patrol';
      b.ai.reactionTimer = 0;
      b.ai.losTimer = 0;
      b.ai.searchTimer = 0;
      b.ai.patrolTarget = null;
      b.ai.fireTimer = 0.8 + Math.random() * 0.5;
    }

    const sp = this._findSafeSpawnPos();
    b.pos.set(sp.x, 0.8, sp.z);
    b.root.position.copy(b.pos);
    b.root.visible = true;
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
