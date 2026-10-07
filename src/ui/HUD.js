import { emit, on } from '../core/EventBus.js';
import { WEAPONS } from '../weapons/WeaponDefs.js';

export class HUD {
  constructor() {
    this.el = {
      kills: document.getElementById('kills'),
      deaths: document.getElementById('deaths'),
      hpFill: document.getElementById('hp-fill'),
      hpNum: document.getElementById('hp-num'),
      ammoFill: document.getElementById('ammo-fill'),
      ammoNum: document.getElementById('ammo-num'),
      weapon: document.getElementById('weapon-name'),
      hitmarker: document.getElementById('hitmarker'),
      crosshair: document.getElementById('crosshair'),
      prompt: document.getElementById('prompt'),
      overlay: document.getElementById('overlay'),
      killfeed: document.getElementById('killfeed'),
      killPopup: document.getElementById('kill-popup'),
      screenFlash: document.getElementById('screen-flash'),
      deathScreen: document.getElementById('death-screen'),
      respawnTxt: document.getElementById('respawn-txt'),
      diCanvas: document.getElementById('damage-indicator'),
      roundTimer: document.getElementById('round-timer'),
      fireMode: document.getElementById('fire-mode'),
      weaponName: document.getElementById('weapon-name'),
      ammoMax: document.getElementById('ammo-max'),
      hpHud: document.getElementById('hp-hud'),
      weaponHud: document.getElementById('weapon-hud'),
      slot1Pill: document.getElementById('slot-1-pill'),
      slot2Pill: document.getElementById('slot-2-pill'),
    };
    
    this.diCtx = this.el.diCanvas.getContext('2d');
    this.damageMarks = [];
    this._flashTimers = new Map();
    
    this.kills = 0;
    this.deaths = 0;
    this.playerYaw = 0;
    this._bind();
  }

  /**
   * Efeito de iluminação sutil de 2 segundos:
   * O elemento passa de cinza suave para cinza mais claro ao ser alterado,
   * retornando suavemente ao normal após 2 segundos.
   */
  triggerFlash(el) {
    if (!el) return;
    el.classList.add('hud-flash');
    if (this._flashTimers.has(el)) {
      clearTimeout(this._flashTimers.get(el));
    }
    const timer = setTimeout(() => {
      el.classList.remove('hud-flash');
      this._flashTimers.delete(el);
    }, 2000);
    this._flashTimers.set(el, timer);
  }

  _bind() {
    this._unsubs = [
      on('player:hp', e => {
        const val = Math.round(e.hp);
        if (this.el.hpNum) {
          this.el.hpNum.textContent = val;
          this.triggerFlash(this.el.hpHud || this.el.hpNum);
        }
      }),
      on('player:damaged', e => {
        this.el.screenFlash.style.transition = 'none';
        this.el.screenFlash.style.background = 'rgba(224,87,74,0.35)';
        requestAnimationFrame(() => {
          this.el.screenFlash.style.transition = 'background 0.35s ease';
          this.el.screenFlash.style.background = 'rgba(224,87,74,0)';
        });
        if (e.source) {
          this.damageMarks.push({
            dx: e.source.pos.x - e.playerPos.x,
            dz: e.source.pos.z - e.playerPos.z,
            t: 1.0
          });
        }
      }),
      on('weapon:ammo', e => {
        if (this.el.ammoNum) {
          this.el.ammoNum.textContent = e.ammo;
          this.triggerFlash(this.el.ammoNum);
        }
        if (this.el.ammoMax) {
          this.el.ammoMax.textContent = e.max;
        }
      }),
      on('weapon:equipped', e => {
        if (this.el.weaponName) {
          this.el.weaponName.textContent = e.name;
          this.triggerFlash(this.el.weaponHud || this.el.weaponName);
        }
        if (this.el.fireMode && e.fireMode) {
          this.el.fireMode.textContent = e.fireMode.toUpperCase();
          this.triggerFlash(this.el.fireMode);
        }
      }),
      on('weapon:firemode', e => {
        if (this.el.fireMode && e.fireMode) {
          this.el.fireMode.textContent = e.fireMode.toUpperCase();
          this.el.fireMode.style.display = e.canToggle || e.fireMode ? 'inline-block' : 'none';
          this.triggerFlash(this.el.fireMode);
        }
      }),
      on('weapon:slots', ({ slots, currentSlot }) => {
        if (this.el.slot1Pill) {
          const w1 = slots[0];
          this.el.slot1Pill.textContent = `[1] ${w1 ? (WEAPONS[w1]?.name || w1.toUpperCase()) : 'VAZIO'}`;
          this.el.slot1Pill.classList.toggle('active', currentSlot === 0);
        }
        if (this.el.slot2Pill) {
          const w2 = slots[1];
          this.el.slot2Pill.textContent = `[2] ${w2 ? (WEAPONS[w2]?.name || w2.toUpperCase()) : 'VAZIO'}`;
          this.el.slot2Pill.classList.toggle('active', currentSlot === 1);
        }
      }),
      on('shot:bot', e => this._hit(e)),
      on('bot:died', e => {
        this.kills++; 
        this.el.kills.textContent = this.kills;
        this.triggerFlash(this.el.kills);
        this._addKillFeed(`Você eliminou <b>Bot</b>${e.headshot ? ' <span class="hs">HEADSHOT</span>' : ''}`);
      }),
      on('player:died', () => { 
        this.deaths++; 
        this.el.deaths.textContent = this.deaths; 
        this.triggerFlash(this.el.deaths);
        this.el.deathScreen.classList.add('show');
      }),
      on('player:respawn', () => {
        this.el.deathScreen.classList.remove('show');
      }),
      on('player:respawn_tick', t => {
        this.setRespawnText(t);
      }),
      on('game:reset', () => {
        this.kills = 0;
        this.deaths = 0;
        this.el.kills.textContent = '0';
        this.el.deaths.textContent = '0';
        this.el.deathScreen.classList.remove('show');
        this.el.killfeed.innerHTML = '';
        this.damageMarks = [];
      }),
      on('kill:combo', e => {
        let text = '';
        let color = '#e8933a';
        if (e.combo >= 3) text = 'TRIPLE KILL!';
        else if (e.combo === 2) text = 'DOUBLE KILL!';
        else if (e.headshot) { text = 'HEADSHOT!'; color = '#ffd166'; }
        
        if (text) this._showKillPopup(text, color);
      }),
      on('round:timer', t => {
        this.setTimer(t);
      }),
      on('hud:popup', ({ text, color, duration }) => {
        this._showKillPopup(text, color || '#06d6a0', duration || 1600);
      }),
      on('round:over', () => {
        const screen = document.getElementById('roundover-screen');
        const stats = document.getElementById('final-stats');
        stats.textContent = `${this.kills} abates · ${this.deaths} mortes`;
        screen.style.opacity = '1';
        screen.style.pointerEvents = 'auto';
      }),
      on('input:lock', locked => {
        this.el.overlay.classList.toggle('hidden', locked);
        const controls = document.getElementById('controls');
        if (controls) controls.style.display = locked ? 'none' : 'block';
      }),
      on('interact:target', target => {
        this.el.prompt.style.opacity = target ? '1' : '0';
      }),
    ];

    // Alternância de slot ao tocar/clicar diretamente nos pills
    const bindPill = (el, slotIdx) => {
      if (!el) return;
      const select = e => {
        e.preventDefault();
        e.stopPropagation();
        emit('weapon:select_slot', slotIdx);
      };
      el.addEventListener('click', select);
      el.addEventListener('touchstart', select, { passive: false });
    };
    bindPill(this.el.slot1Pill, 0);
    bindPill(this.el.slot2Pill, 1);

    document.getElementById('restart-btn')?.addEventListener('click', () => location.reload());
  }

  destroy() {
    if (this._unsubs) {
      for (const unsub of this._unsubs) unsub();
      this._unsubs = [];
    }
    for (const [, timer] of this._flashTimers) {
      clearTimeout(timer);
    }
    this._flashTimers.clear();
    clearTimeout(this._hitT);
  }

  _hit(e) {
    if (e.isShotgun && e.screenX !== undefined && e.screenY !== undefined) {
      // Hitmarkers dinâmicos descentralizados para espingardas (pellets)
      const hm = document.createElement('div');
      hm.innerHTML = '×';
      hm.style.position = 'fixed';
      hm.style.left = e.screenX + 'px';
      hm.style.top = e.screenY + 'px';
      hm.style.color = e.headshot ? '#ffd166' : 'var(--warn)';
      hm.style.fontSize = '24px';
      hm.style.fontWeight = 'bold';
      hm.style.fontFamily = "'Oswald',sans-serif";
      hm.style.pointerEvents = 'none';
      hm.style.zIndex = '110';
      hm.style.textShadow = '0 0 2px rgba(0,0,0,0.8)';
      hm.style.transition = 'opacity 0.12s, transform 0.12s';
      
      const rot = (Math.random() - 0.5) * 60;
      hm.style.transform = `translate(-50%, -50%) scale(1.3) rotate(${rot}deg)`;
      hm.style.opacity = '1';
      
      document.body.appendChild(hm);
      
      requestAnimationFrame(() => {
        hm.style.transform = `translate(-50%, -50%) scale(1) rotate(${rot}deg)`;
      });
      
      setTimeout(() => {
        hm.style.opacity = '0';
        setTimeout(() => hm.remove(), 120);
      }, 120);
    } else {
      // Hitmarker central clássico
      const el = this.el.hitmarker;
      el.classList.toggle('head', !!e.headshot);
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,-50%) scale(1.3)';
      clearTimeout(this._hitT);
      this._hitT = setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translate(-50%,-50%) scale(1)';
      }, 110);
    }
  }

  _addKillFeed(html) {
    const feed = this.el.killfeed;
    const el = document.createElement('div');
    el.className = 'feed-item';
    el.innerHTML = html;
    feed.appendChild(el);
    while (feed.children.length > 5) feed.removeChild(feed.firstChild);
    setTimeout(() => {
      el.classList.add('fade');
      setTimeout(() => el.remove(), 600);
    }, 3200);
  }

  _showKillPopup(text, color, duration = 700) {
    const el = this.el.killPopup;
    el.textContent = text;
    el.style.color = color;
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%,-50%) scale(1.05)';
    clearTimeout(this._popupT);
    this._popupT = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%,-50%) scale(0.85)';
    }, duration);
  }

  updateCrosshair(isAds, spread = 0.02, isSprinting = false, weaponId = 'ar15') {
    if (!this.el.crosshair) return;
    const adsFactor = typeof isAds === 'number' ? isAds : (isAds ? 1 : 0);
    if (adsFactor >= 0.95) {
      this.el.crosshair.style.opacity = '0';
      return;
    }
    const baseOpacity = isSprinting ? 0.25 : 0.85;
    this.el.crosshair.style.opacity = String(Math.max(0, (1 - adsFactor * 1.2) * baseOpacity));

    // Espaçamento dinâmico tático (gap) proporcional à precisão de cada arma
    // Armas mais precisas (HK416, Rifle Proto) têm crosshairs bem fechadas;
    // Armas de alta dispersão (UZI, M249) têm crosshairs mais abertas.
    const baseGapByWeapon = {
      'rifle_proto': 3.5,
      'sw500': 4.0,
      'ar15': 4.5,
      'ak47': 5.5,
      'p9': 6.0,
      'm12': 5.0,
      'uzi': 10.0,
      'm249': 12.0
    };
    const baseGap = baseGapByWeapon[weaponId] || 5.0;
    // Spread atual abre o gap durante movimento, tiro ou spray
    const dynamicGap = baseGap + Math.max(0, (spread - 0.015) * 450);
    this.el.crosshair.style.setProperty('--gap', `${dynamicGap.toFixed(1)}px`);
  }

  updateAds(amount) {
    this.updateCrosshair(amount);
  }

  setRespawnText(t) {
    this.el.respawnTxt.textContent = `reaparecendo em ${t}...`;
  }

  setTimer(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    this.el.roundTimer.textContent = `${m}:${String(s).padStart(2, '0')}`;
  }

  // Chamado a cada frame pelo main.js para atualizar o canvas do indicador direcional
  update(dt, playerYaw) {
    this.playerYaw = playerYaw;
    const w = this.el.diCanvas.width;
    const h = this.el.diCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const R = 78;

    this.diCtx.clearRect(0, 0, w, h);

    for (let i = this.damageMarks.length - 1; i >= 0; i--) {
      const m = this.damageMarks[i];
      m.t -= dt * 1.1;
      if (m.t <= 0) {
        this.damageMarks.splice(i, 1);
        continue;
      }
      
      // Converte o vetor local do tiro para o referencial de rotação da câmera do player
      const relX = m.dx * Math.cos(this.playerYaw) + m.dz * (-Math.sin(this.playerYaw));
      const relFwd = m.dx * (-Math.sin(this.playerYaw)) + m.dz * (-Math.cos(this.playerYaw));
      const canvasAngle = Math.atan2(relX, relFwd) - Math.PI/2;
      
      const arcHalf = 0.30;
      const alpha = Math.min(m.t, 1) * 0.9;
      
      this.diCtx.strokeStyle = `rgba(224,87,74,${alpha})`;
      this.diCtx.lineWidth = 7;
      this.diCtx.lineCap = 'round';
      this.diCtx.beginPath();
      this.diCtx.arc(cx, cy, R, canvasAngle - arcHalf, canvasAngle + arcHalf);
      this.diCtx.stroke();
    }
  }
}