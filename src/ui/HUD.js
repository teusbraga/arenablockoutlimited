import { emit, on } from '../core/EventBus.js';
import { WEAPONS } from '../weapons/WeaponDefs.js';
import { CrosshairManager } from './CrosshairManager.js';

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
      suppressionOverlay: document.getElementById('suppression-overlay'),
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
      invModal: document.getElementById('inventory-modal'),
      invWeight: document.getElementById('inv-weight-lbl'),
      invSlotPri: document.getElementById('inv-slot-pri'),
      invSlotSec: document.getElementById('inv-slot-sec'),
      invGrid: document.getElementById('inv-grid-container'),
      invCloseBtn: document.getElementById('inv-btn-close'),
      reloadQte: document.getElementById('reload-qte'),
      qteSweetSpot: document.getElementById('qte-sweet-spot'),
      qteNeedle: document.getElementById('qte-needle'),
      qteStatus: document.getElementById('qte-status'),
    };
    
    this.diCtx = this.el.diCanvas.getContext('2d');
    this.damageMarks = [];
    this._flashTimers = new Map();
    
    this.kills = 0;
    this.deaths = 0;
    this.playerYaw = 0;
    this.isLocked = false;
    this.isInventoryOpen = false;
    this.isRoundOver = false;
    this.isDead = false;
    this.crosshairManager = new CrosshairManager({
      crosshairEl: this.el.crosshair,
      noFireEl: typeof document !== 'undefined' ? document.getElementById('crosshair-no-fire') : null
    });
    this._bind();
    this._bindInventoryUI();
    this.syncGameplayUIVisibility();
  }

  /**
   * Sincroniza a visibilidade de todos os elementos de combate (HUD, Crosshair, Touch Controls).
   * Exibe o HUD de combate estritamente quando o jogador está em partida ativa.
   */
  syncGameplayUIVisibility() {
    if (typeof document === 'undefined') return;
    const inGameplay = Boolean(
      this.isLocked && !this.isInventoryOpen && !this.isRoundOver && !this.isDead
    );
    document.body.classList.toggle('in-gameplay', inGameplay);
    if (!inGameplay) {
      if (this.el.prompt) this.el.prompt.style.opacity = '0';
      const noFire = document.getElementById('crosshair-no-fire');
      if (noFire) noFire.style.display = 'none';
    }
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
        const srcPos = e?.source?.pos || e?.sourcePos;
        if (srcPos && e?.playerPos) {
          this._addDirectionalMark(srcPos, e.playerPos, 1.0, false);
        }
      }),
      on('player:suppression', e => {
        const intensity = Math.min(1.0, (e?.intensity || 0.5));
        const srcPos = e?.source?.pos || e?.sourcePos || e?.pos;
        if (srcPos && e?.playerPos) {
          this._addDirectionalMark(srcPos, e.playerPos, Math.max(0.65, intensity * 0.9), true);
        }
        if (!this.el.suppressionOverlay) return;
        const overlay = this.el.suppressionOverlay;
        overlay.classList.add('active');
        overlay.style.opacity = String(Math.max(0.40, intensity * 0.95));
        if (this._suppressT) clearTimeout(this._suppressT);
        this._suppressT = setTimeout(() => {
          overlay.classList.remove('active');
          overlay.style.opacity = '0';
        }, 450);
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
      on('weapon:qte:start', ({ sweetStart, sweetEnd }) => {
        if (this.el.reloadQte) {
          this.el.reloadQte.classList.remove('hidden');
          if (this.el.qteSweetSpot) {
            this.el.qteSweetSpot.style.left = (sweetStart * 100) + '%';
            this.el.qteSweetSpot.style.width = ((sweetEnd - sweetStart) * 100) + '%';
          }
          if (this.el.qteNeedle) this.el.qteNeedle.style.left = '0%';
          if (this.el.qteStatus) {
            this.el.qteStatus.className = 'qte-label';
            this.el.qteStatus.innerHTML = '<span class="k">R</span> GUARDAR NO BOLSO';
          }
        }
      }),
      on('weapon:qte:update', ({ progress }) => {
        if (this.el.qteNeedle) {
          const pct = Math.max(0, Math.min(100, progress * 100));
          this.el.qteNeedle.style.left = pct + '%';
        }
      }),
      on('weapon:qte:result', ({ success }) => {
        if (this.el.qteStatus) {
          if (success) {
            this.el.qteStatus.className = 'qte-label qte-success';
            this.el.qteStatus.textContent = 'PERFEITO! +RECARGA RÁPIDA';
          } else {
            this.el.qteStatus.className = 'qte-label qte-fail';
            this.el.qteStatus.textContent = 'FALHA! RECARGA LENTA';
          }
        }
        setTimeout(() => {
          if (this.el.reloadQte) this.el.reloadQte.classList.add('hidden');
        }, 350);
      }),
      on('weapon:qte:stop', () => {
        if (this.el.reloadQte) this.el.reloadQte.classList.add('hidden');
      }),
      on('weapon:reload:end', () => {
        if (this.el.reloadQte) this.el.reloadQte.classList.add('hidden');
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
      on('shot:world', e => {
        if (e?.box?.meta?.isPlinker || e?.material === 'plinker' || e?.box?.meta?.material === 'target' || e?.box?.meta?.isTarget) {
          this._hit({ headshot: false });
        }
      }),
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
        this.isDead = true;
        this.el.deathScreen.classList.add('show');
        this.syncGameplayUIVisibility();
      }),
      on('player:respawn', () => {
        this.isDead = false;
        this.el.deathScreen.classList.remove('show');
        this.syncGameplayUIVisibility();
      }),
      on('player:respawn_tick', e => {
        const t = typeof e === 'object' && e !== null ? (e.seconds ?? e.count) : e;
        this.setRespawnText(t);
      }),
      on('game:reset', () => {
        this.kills = 0;
        this.deaths = 0;
        this.isDead = false;
        this.isRoundOver = false;
        this.el.kills.textContent = '0';
        this.el.deaths.textContent = '0';
        this.el.deathScreen.classList.remove('show');
        this.el.killfeed.innerHTML = '';
        this.damageMarks = [];
        this.syncGameplayUIVisibility();
      }),
      on('kill:combo', e => {
        let text = '';
        let color = '#e8933a';
        if (e.combo >= 3) text = 'TRIPLE KILL!';
        else if (e.combo === 2) text = 'DOUBLE KILL!';
        else if (e.headshot) { text = 'HEADSHOT!'; color = '#ffd166'; }
        
        if (text) this._showKillPopup(text, color);
      }),
      on('round:timer', e => {
        const t = typeof e === 'object' && e !== null ? (e.seconds ?? e.timeLeft) : e;
        this.setTimer(t);
      }),
      on('hud:popup', ({ text, color, duration }) => {
        this._showKillPopup(text, color || '#06d6a0', duration || 1600);
      }),
      on('notification', ({ message }) => {
        if (message) this._showKillPopup(message, '#ffaa00', 1800);
      }),
      on('round:over', () => {
        this.isRoundOver = true;
        this.el.overlay?.classList.add('hidden');
        const screen = document.getElementById('roundover-screen');
        const stats = document.getElementById('final-stats');
        stats.textContent = `${this.kills} abates · ${this.deaths} mortes`;
        screen.style.opacity = '1';
        screen.style.pointerEvents = 'auto';
        this.syncGameplayUIVisibility();
      }),
      on('input:lock', e => {
        const locked = typeof e === 'object' && e !== null ? !!e.locked : !!e;
        this.isLocked = !!locked;
        if (!this.isInventoryOpen && !this.isRoundOver) {
          this.el.overlay?.classList.toggle('hidden', !!locked);
        }
        this.syncGameplayUIVisibility();
      }),
      on('interact:target', e => {
        const target = (e && typeof e === 'object' && 'target' in e) ? e.target : e;
        if (!this.isLocked || this.isInventoryOpen) {
          this.el.prompt.style.opacity = '0';
          return;
        }
        if (target) {
          this.el.prompt.style.opacity = '1';
          if (target.ammoCount !== undefined) {
            const wepName = WEAPONS[target.weaponId]?.name || target.weaponId?.toUpperCase() || 'ARMA';
            this.el.prompt.textContent = `[F] PEGAR CARREGADOR (${wepName} - ${target.ammoCount} balas)`;
          } else if (target.weaponId) {
            const wepName = WEAPONS[target.weaponId]?.name || target.weaponId.toUpperCase();
            this.el.prompt.textContent = `[F] PEGAR ARMA (${wepName})`;
          } else {
            this.el.prompt.textContent = '[F] INTERAGIR';
          }
        } else {
          this.el.prompt.style.opacity = '0';
        }
      }),
    ];

    // Alternância de slot ao tocar/clicar diretamente nos pills
    const bindPill = (el, slotIdx) => {
      if (!el) return;
      const select = e => {
        e.preventDefault();
        e.stopPropagation();
        emit('weapon:select_slot', { slotIdx, slot: slotIdx });
      };
      el.addEventListener('click', select);
      el.addEventListener('touchstart', select, { passive: false });
    };
    bindPill(this.el.slot1Pill, 0);
    bindPill(this.el.slot2Pill, 1);

    document.getElementById('restart-btn')?.addEventListener('click', () => location.reload());
  }

  _bindInventoryUI() {
    if (!this.el.invModal) return;

    this._unsubs.push(
      on('inventory:opened', ({ gear, storage }) => {
        this.isInventoryOpen = true;
        this.el.invModal.classList.add('show');
        this.el.overlay?.classList.add('hidden');
        this._renderInventory(gear, storage);
        this.syncGameplayUIVisibility();
      }),
      on('inventory:closed', () => {
        this.isInventoryOpen = false;
        this.el.invModal.classList.remove('show');
        this.syncGameplayUIVisibility();
      }),
      on('inventory:changed', ({ gear, storage }) => {
        this._renderInventory(gear, storage);
      })
    );

    this.el.invCloseBtn?.addEventListener('click', () => {
      emit('inventory:toggle', {});
    });
  }

  _renderInventory(gear, storage) {
    if (this.el.invSlotPri) {
      const p = gear?.primary;
      this.el.invSlotPri.textContent = p ? (WEAPONS[p]?.name || p.toUpperCase()) : 'VAZIO';
    }
    if (this.el.invSlotSec) {
      const s = gear?.secondary;
      this.el.invSlotSec.textContent = s ? (WEAPONS[s]?.name || s.toUpperCase()) : 'VAZIO';
    }
    if (this.el.invGrid && Array.isArray(storage)) {
      this.el.invGrid.innerHTML = '';
      storage.forEach((item, idx) => {
        const cell = document.createElement('div');
        cell.className = 'inv-grid-cell' + (item ? '' : ' empty');
        if (item) {
          const nameSpan = document.createElement('span');
          nameSpan.className = 'inv-item-name';
          nameSpan.textContent = item.name;
          cell.appendChild(nameSpan);

          if (item.count && item.count > 1) {
            const countSpan = document.createElement('span');
            countSpan.className = 'inv-item-count';
            countSpan.textContent = `x${item.count}`;
            cell.appendChild(countSpan);
          }

          cell.title = `Clique para usar ${item.name}`;
          cell.addEventListener('click', () => {
            emit('inventory:use_item', { slotIdx: idx, idx });
          });
        } else {
          cell.innerHTML = '<span style="opacity:0.25;font-size:8px;">[VAZIO]</span>';
        }
        this.el.invGrid.appendChild(cell);
      });
    }
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

  updateCrosshair(isAds, spread = 0.02, isSprinting = false, weaponId = 'ar15', extra = {}) {
    if (!this.crosshairManager) return;
    const adsAmount = typeof isAds === 'number' ? isAds : (isAds ? 1.0 : 0.0);
    this.crosshairManager.update({
      dt: extra.dt || 0.016,
      isAds: adsAmount > 0.5,
      adsAmount,
      spread,
      isSprinting,
      weaponId,
      cameraRig: extra.cameraRig || null,
      cameraFov: extra.cameraFov || 78,
      wallCompression: extra.wallCompression || 0,
      sprayRecoil: extra.sprayRecoil || null,
      barrelScreenPos: extra.barrelScreenPos || null,
      pureBarrelScreenPos: extra.pureBarrelScreenPos || null
    });
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

  _addDirectionalMark(sourcePos, playerPos, intensity = 1.0, isSuppression = false) {
    if (!sourcePos || !playerPos) return;
    const dx = sourcePos.x - playerPos.x;
    const dz = sourcePos.z - playerPos.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) return;

    const nx = dx / len;
    const nz = dz / len;

    // Deduplica marcas vindas da mesma direção (produto escalar > 0.92 ≈ ~23°) para evitar poluição visual em rajadas
    for (let i = 0; i < this.damageMarks.length; i++) {
      const m = this.damageMarks[i];
      const mLen = Math.hypot(m.dx, m.dz) || 1;
      const dot = (m.dx / mLen) * nx + (m.dz / mLen) * nz;
      if (dot > 0.92) {
        m.dx = dx;
        m.dz = dz;
        m.t = Math.max(m.t, Math.min(1.2, intensity));
        if (!isSuppression) m.isSuppression = false;
        return;
      }
    }

    this.damageMarks.push({
      dx,
      dz,
      t: Math.min(1.2, Math.max(0.65, intensity)),
      isSuppression
    });
  }

  // Chamado a cada frame pelo main.js para atualizar o canvas do indicador direcional
  update(dt, playerYaw) {
    this.playerYaw = playerYaw;
    const w = this.el.diCanvas.width;
    const h = this.el.diCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const R = 84;

    this.diCtx.clearRect(0, 0, w, h);

    for (let i = this.damageMarks.length - 1; i >= 0; i--) {
      const m = this.damageMarks[i];
      m.t -= dt * 0.95;
      if (m.t <= 0) {
        this.damageMarks.splice(i, 1);
        continue;
      }
      
      // Converte o vetor local do tiro para o referencial de rotação da câmera do player
      const relX = m.dx * Math.cos(this.playerYaw) + m.dz * (-Math.sin(this.playerYaw));
      const relFwd = m.dx * (-Math.sin(this.playerYaw)) + m.dz * (-Math.cos(this.playerYaw));
      const canvasAngle = Math.atan2(relX, relFwd) - Math.PI / 2;
      
      const arcHalf = m.isSuppression ? 0.24 : 0.32;
      const alpha = Math.min(m.t, 1) * (m.isSuppression ? 0.78 : 0.95);
      const rgb = m.isSuppression ? '232,147,58' : '224,87,74';

      this.diCtx.save();
      this.diCtx.shadowColor = `rgba(${rgb},${alpha * 0.8})`;
      this.diCtx.shadowBlur = 8;
      this.diCtx.strokeStyle = `rgba(${rgb},${alpha})`;
      this.diCtx.lineWidth = m.isSuppression ? 5.5 : 7.5;
      this.diCtx.lineCap = 'round';
      this.diCtx.beginPath();
      this.diCtx.arc(cx, cy, R, canvasAngle - arcHalf, canvasAngle + arcHalf);
      this.diCtx.stroke();
      this.diCtx.restore();
    }
  }
}
