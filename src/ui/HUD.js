import { on } from '../core/EventBus.js';

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
    };
    
    this.diCtx = this.el.diCanvas.getContext('2d');
    this.damageMarks = [];
    
    this.kills = 0;
    this.deaths = 0;
    this.playerYaw = 0;
    this._bind();
  }

  _bind() {
    on('player:hp', e => {
      this.el.hpFill.style.width = (e.hp / e.max * 100) + '%';
      this.el.hpNum.textContent = `${Math.round(e.hp)}/${e.max}`;
    });

    on('player:damaged', e => {
      // Screen Flash
      this.el.screenFlash.style.transition = 'none';
      this.el.screenFlash.style.background = 'rgba(224,87,74,0.35)';
      requestAnimationFrame(() => {
        this.el.screenFlash.style.transition = 'background 0.35s ease';
        this.el.screenFlash.style.background = 'rgba(224,87,74,0)';
      });

      // Salva vetor de dano relativo ao player
      if (e.source) {
        this.damageMarks.push({
          dx: e.source.pos.x - e.playerPos.x,
          dz: e.source.pos.z - e.playerPos.z,
          t: 1.0
        });
      }
    });

    on('weapon:ammo', e => {
      this.el.ammoFill.style.width = (e.ammo / e.max * 100) + '%';
      this.el.ammoNum.textContent = `${e.ammo}/${e.max}`;
    });
    
    on('weapon:equipped', e => {
      this.el.weapon.firstChild.textContent = e.name + ' ';
    });
    
    on('shot:bot', e => this._hit(e.headshot));

    on('bot:died', e => {
      this.kills++; 
      this.el.kills.textContent = this.kills;
      this._addKillFeed(`Você eliminou <b>Bot</b>${e.headshot ? ' <span class="hs">HEADSHOT</span>' : ''}`);
    });

    on('player:died', () => { 
      this.deaths++; 
      this.el.deaths.textContent = this.deaths; 
      this.el.deathScreen.classList.add('show');
    });

    on('player:respawn', () => {
      this.el.deathScreen.classList.remove('show');
    });

    on('player:respawn_tick', t => {
      this.setRespawnText(t);
    });

    on('game:reset', () => {
      this.kills = 0;
      this.deaths = 0;
      this.el.kills.textContent = '0';
      this.el.deaths.textContent = '0';
      this.el.deathScreen.classList.remove('show');
      this.el.killfeed.innerHTML = '';
      this.damageMarks = [];
    });

    on('kill:combo', e => {
      let text = '';
      let color = '#e8933a';
      if (e.combo >= 3) text = 'TRIPLE KILL!';
      else if (e.combo === 2) text = 'DOUBLE KILL!';
      else if (e.headshot) { text = 'HEADSHOT!'; color = '#ffd166'; }
      
      if (text) this._showKillPopup(text, color);
    });

    on('round:timer', t => {
      this.setTimer(t);
    });

    on('round:over', () => {
      const screen = document.getElementById('roundover-screen');
      const stats = document.getElementById('final-stats');
      stats.textContent = `${this.kills} abates · ${this.deaths} mortes`;
      screen.style.opacity = '1';
      screen.style.pointerEvents = 'auto';
    });
    
    document.getElementById('restart-btn')?.addEventListener('click', () => location.reload());

    on('input:lock', locked => {
      this.el.overlay.classList.toggle('hidden', locked);
      const controls = document.getElementById('controls');
      if (controls) controls.style.display = locked ? 'none' : 'block';
    });
    
    on('interact:target', target => {
      this.el.prompt.style.opacity = target ? '1' : '0';
    });
  }

  _hit(headshot) {
    const el = this.el.hitmarker;
    el.classList.toggle('head', !!headshot);
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%,-50%) scale(1.3)';
    clearTimeout(this._hitT);
    this._hitT = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%,-50%) scale(1)';
    }, 110);
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

  _showKillPopup(text, color) {
    const el = this.el.killPopup;
    el.textContent = text;
    el.style.color = color;
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%,-50%) scale(1.05)';
    clearTimeout(this._popupT);
    this._popupT = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%,-50%) scale(0.85)';
    }, 700);
  }

  updateCrosshair(isAds, spread = 0.02, isSprinting = false) {
    if (!this.el.crosshair) return;
    const adsFactor = typeof isAds === 'number' ? isAds : (isAds ? 1 : 0);
    if (adsFactor >= 0.95) {
      this.el.crosshair.style.opacity = '0';
      return;
    }
    const baseOpacity = isSprinting ? 0.35 : 1;
    this.el.crosshair.style.opacity = String(Math.max(0, (1 - adsFactor * 1.2) * baseOpacity));
    const scale = Math.max(0.75, Math.min(2.5, (spread / 0.02) * 0.9));
    this.el.crosshair.style.transform = `translate(-50%,-50%) scale(${scale.toFixed(2)})`;
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