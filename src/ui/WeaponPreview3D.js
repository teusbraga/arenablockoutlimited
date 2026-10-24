import * as THREE from 'three';
import { WEAPONS } from '../weapons/WeaponDefs.js';
import { ItemDrop } from '../world/ItemDrop.js';
import createCharacter, { applyPaletteToCharacter } from '../view/models/TacticalManContinuous.js';

/**
 * WeaponPreview3D
 * Vitrine 3D interativa para a aba de Loadout do menu.
 * Reutiliza os modelos 3D e templates do ItemDrop (que foram desativados no chão do mapa para evitar lag),
 * renderizando apenas 1 arma por vez e hibernando 100% durante a partida ou fora da aba Loadout.
 */
export class WeaponPreview3D {
  constructor({
    canvasId = 'weapon-preview-canvas',
    containerId = 'weapon-preview-box',
    initialWeaponId = 'ar15',
    initialSoldierSkin = null,
  } = {}) {
    this.canvasId = canvasId;
    this.containerId = containerId;
    this.weaponId = initialWeaponId;
    this.currentSoldierSkin = initialSoldierSkin;
    this.soldierModel = null;
    this.activeSlot = 0; // 0 = Primária, 1 = Secundária, 'soldier' = Soldado

    this.autoRotate = true;
    this.dragMode = 'rotate'; // 'rotate' | 'pan'
    this.isActive = true;

    // Estado cinemático de câmera / inspeção
    this.yaw = -0.35;
    this.pitch = 0.16;
    this.targetYaw = -0.35;
    this.targetPitch = 0.16;

    this.panX = 0;
    this.panY = 0;
    this.targetPanX = 0;
    this.targetPanY = 0;

    this.zoomDist = 1.25;
    this.targetZoomDist = 1.25;

    this.animTime = 0;
    this.lastFrameTime = 0;
    this._rafId = null;

    // Estado de ponteiro / touch
    this._isDragging = false;
    this._activeDragAction = 'rotate';
    this._lastPointerX = 0;
    this._lastPointerY = 0;
    this._lastPinchDist = 0;
    this._lastTwoFingerX = 0;
    this._lastTwoFingerY = 0;

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.rootGroup = null;
    this.orbitGroup = null;
    this.weaponHolder = null;
    this.ringMat = null;
    this.discMat = null;
    this.rimLight = null;

    if (typeof document !== 'undefined') {
      this._initDOM();
      this._initThree();
      this._bindEvents();
      this.setWeapon(this.weaponId, 0);
      this._updateLoopState();
    }
  }

  _initDOM() {
    this.containerEl = document.getElementById(this.containerId);
    this.canvasEl = document.getElementById(this.canvasId);
    this.nameLabelEl = document.getElementById('wp-preview-name');
    this.emptyNoticeEl = document.getElementById('wp-preview-empty');

    this.btnSlot1 = document.getElementById('wp-btn-slot1');
    this.btnSlot2 = document.getElementById('wp-btn-slot2');
    this.btnSoldier = document.getElementById('wp-btn-soldier');
    this.btnModeRotate = document.getElementById('wp-btn-mode-rotate');
    this.btnModePan = document.getElementById('wp-btn-mode-pan');
    this.btnAutoSpin = document.getElementById('wp-btn-autospin');
    this.btnReset = document.getElementById('wp-btn-reset');
  }

  _initThree() {
    if (!this.canvasEl) return;

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvasEl,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    } catch (err) {
      console.warn('[WeaponPreview3D] Contexto WebGL indisponível:', err);
      this.renderer = null;
      return;
    }

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 2.5, 0.04, 15);
    this.camera.position.set(0, 0.03, this.zoomDist);
    this.camera.lookAt(0, 0, 0);

    // Iluminação de estúdio tático para destacar chanfros, trilhos e materiais metálicos
    const ambLight = new THREE.AmbientLight(0xdce6f5, 1.45);
    this.scene.add(ambLight);

    const hemiLight = new THREE.HemisphereLight(0xf4f8ff, 0x18202a, 1.15);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e4, 2.75);
    keyLight.position.set(2.2, 3.2, 2.8);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x88b8ff, 1.35);
    fillLight.position.set(-2.4, 1.0, 2.0);
    this.scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 1.1);
    backLight.position.set(0.2, 2.0, -2.5);
    this.scene.add(backLight);

    this.rimLight = new THREE.PointLight(0xffcc00, 1.8, 3.5);
    this.rimLight.position.set(0, -0.45, 0.4);
    this.scene.add(this.rimLight);

    // Hierarquia de transformação:
    // rootGroup (Pan X / Y) -> orbitGroup (Pitch X / Yaw Y) -> weaponHolder (Centralização e Escala Normalizada)
    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    this.orbitGroup = new THREE.Group();
    this.orbitGroup.rotation.order = 'XYZ';
    this.rootGroup.add(this.orbitGroup);

    this.weaponHolder = new THREE.Group();
    this.orbitGroup.add(this.weaponHolder);

    // Halo Tático do antigo ItemDrop 3D na base da vitrine
    const ringGeo = new THREE.RingGeometry(0.26, 0.34, 32);
    ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0xffcc00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    this.ringMesh = new THREE.Mesh(ringGeo, this.ringMat);
    this.ringMesh.position.y = -0.22;
    this.orbitGroup.add(this.ringMesh);

    const discGeo = new THREE.CircleGeometry(0.26, 32);
    discGeo.rotateX(-Math.PI / 2);
    this.discMat = new THREE.MeshBasicMaterial({
      color: 0xffcc00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.10,
    });
    this.discMesh = new THREE.Mesh(discGeo, this.discMat);
    this.discMesh.position.y = -0.222;
    this.orbitGroup.add(this.discMesh);

    this._resizeCanvas();
  }

  _getGlowColor(weaponId) {
    const def = WEAPONS[weaponId];
    let glowColor = 0xffcc00;
    if (def) {
      if (def.type === 'sniper' || weaponId === 'scar_h') {
        glowColor = 0x00f0ff;
      } else if (def.type === 'heavy') {
        glowColor = 0xff6600;
      } else if (def.type === 'shotgun') {
        glowColor = 0xff3344;
      } else if (def.type === 'smg') {
        glowColor = 0x33ff66;
      } else if (def.type === 'pistol') {
        glowColor = weaponId === 'sw500' ? 0xff00bb : 0x33ff66;
      }
    }
    return glowColor;
  }

  _getOrBuildTemplate(weaponId) {
    if (!ItemDrop._templates) ItemDrop._templates = {};
    if (!ItemDrop._templates[weaponId]) {
      const builder = ItemDrop.builders?.[weaponId];
      if (typeof builder === 'function') {
        try {
          const res = builder();
          ItemDrop._templates[weaponId] = ItemDrop.prepareTemplate(res.group ?? res);
        } catch (err) {
          console.warn(`[WeaponPreview3D] Erro ao construir template para ${weaponId}:`, err);
        }
      }
    }
    return ItemDrop.prepareTemplate(ItemDrop._templates[weaponId]);
  }

  /**
   * Troca a arma exibida na vitrine 3D.
   */
  setWeapon(weaponId, slotIndex = null) {
    this.soldierModel = null;
    this.btnSoldier?.classList.remove('active');
    if (this.ringMesh) this.ringMesh.position.y = -0.22;
    if (this.discMesh) this.discMesh.position.y = -0.222;

    if (slotIndex !== null) {
      this.activeSlot = slotIndex;
      this.btnSlot1?.classList.toggle('active', slotIndex === 0);
      this.btnSlot2?.classList.toggle('active', slotIndex === 1);
    }

    this.weaponId = weaponId || 'none';

    if (!this.weaponHolder) return;

    // Limpa modelo anterior
    while (this.weaponHolder.children.length > 0) {
      this.weaponHolder.remove(this.weaponHolder.children[0]);
    }

    if (this.weaponId === 'none') {
      this.rootGroup.visible = false;
      if (this.nameLabelEl) {
        this.nameLabelEl.textContent = 'SLOT 2: DESARMADO';
        this.nameLabelEl.style.color = '#8c9194';
      }
      if (this.emptyNoticeEl) {
        this.emptyNoticeEl.style.display = 'flex';
      }
      this._renderSingleFrame();
      return;
    }

    if (this.emptyNoticeEl) {
      this.emptyNoticeEl.style.display = 'none';
    }
    this.rootGroup.visible = true;

    const def = WEAPONS[this.weaponId];
    const glowColor = this._getGlowColor(this.weaponId);
    const hexStr = '#' + glowColor.toString(16).padStart(6, '0');

    if (this.nameLabelEl) {
      const slotTag = this.activeSlot === 0 ? 'PRIMÁRIA' : 'SECUNDÁRIA';
      const wName = (def?.name || this.weaponId).toUpperCase();
      this.nameLabelEl.textContent = `${slotTag}: ${wName}`;
      this.nameLabelEl.style.color = hexStr;
    }

    if (this.ringMat) this.ringMat.color.setHex(glowColor);
    if (this.discMat) this.discMat.color.setHex(glowColor);
    if (this.rimLight) this.rimLight.color.setHex(glowColor);

    const tpl = this._getOrBuildTemplate(this.weaponId);
    if (tpl) {
      const clone = tpl.clone();

      // Calcula bounding box para centralizar perfeitamente e normalizar escala na vitrine
      const bbox = new THREE.Box3().setFromObject(clone);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      bbox.getCenter(center);
      bbox.getSize(size);

      clone.position.sub(center);

      const pivot = new THREE.Group();
      pivot.add(clone);

      // Orienta a lateral da arma para a câmera (modelos originais apontam para -Z)
      pivot.rotation.y = Math.PI * 0.5;
      pivot.rotation.z = 0.08;

      const maxDim = Math.max(size.x, size.y, size.z, 0.22);
      const targetSpan = 0.88;
      const scale = THREE.MathUtils.clamp(targetSpan / maxDim, 0.65, 2.35);
      pivot.scale.setScalar(scale);

      this.weaponHolder.add(pivot);
    }

    this._renderSingleFrame();
  }

  /**
   * Exibe o Soldado Tático Contínuo na vitrine 3D com a skin ativa.
   */
  showSoldier(soldierSkin = null) {
    if (soldierSkin) {
      this.currentSoldierSkin = soldierSkin;
    }
    this.activeSlot = 'soldier';

    this.btnSlot1?.classList.remove('active');
    this.btnSlot2?.classList.remove('active');
    this.btnSoldier?.classList.add('active');

    if (this.emptyNoticeEl) {
      this.emptyNoticeEl.style.display = 'none';
    }
    this.rootGroup.visible = true;

    // Limpa modelo anterior
    while (this.weaponHolder.children.length > 0) {
      this.weaponHolder.remove(this.weaponHolder.children[0]);
    }

    const skin = this.currentSoldierSkin || {};
    const skinName = skin.name || skin.preset || 'Woodland Green';
    const hexColor = skin.sheenColor || skin.uniform || '#00f0ff';

    if (this.nameLabelEl) {
      this.nameLabelEl.textContent = `OPERADOR: ${skinName.toUpperCase()}`;
      this.nameLabelEl.style.color = hexColor;
    }

    const glowColor = new THREE.Color(hexColor).getHex();
    if (this.ringMat) this.ringMat.color.setHex(glowColor);
    if (this.discMat) this.discMat.color.setHex(glowColor);
    if (this.rimLight) this.rimLight.color.setHex(glowColor);

    if (this.ringMesh) this.ringMesh.position.y = -0.35;
    if (this.discMesh) this.discMesh.position.y = -0.352;

    this.soldierModel = createCharacter(THREE, { palette: skin });

    const joints = this.soldierModel.userData?.joints;
    if (joints) {
      const toRad = (deg) => deg * (Math.PI / 180);
      joints.upperArmRight.rotation.set(-toRad(68), toRad(18), 0);
      joints.elbowRight.rotation.x = -toRad(62);
      joints.upperArmLeft.rotation.set(-toRad(52), -toRad(28), 0);
      joints.elbowLeft.rotation.x = -toRad(78);

      const mGun = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.35, metalness: 0.80 });
      const mGunDark = new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.45, metalness: 0.60 });

      const gunGroup = new THREE.Group();
      gunGroup.position.set(-0.04, 0.23, 0.38);
      joints.chest.add(gunGroup);

      const gunReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.32), mGun);
      const gunHandguard = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.075, 0.16), mGunDark);
      gunHandguard.position.set(0, 0, 0.18);
      const gunBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.22), mGun);
      gunBarrel.position.set(0, 0.01, 0.36);
      const gunMuzzle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.05), mGunDark);
      gunMuzzle.position.set(0, 0.01, 0.48);
      const gunMag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.08), mGunDark);
      gunMag.position.set(0, -0.10, 0.06);
      gunMag.rotation.x = 0.20;
      const gunStock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.10, 0.15), mGunDark);
      gunStock.position.set(0, 0.005, -0.20);
      gunGroup.add(gunReceiver, gunHandguard, gunBarrel, gunMuzzle, gunMag, gunStock);
    }

    const pivot = new THREE.Group();
    // Centraliza o soldado verticalmente para que os pés fiquem sobre a base circular do halo
    this.soldierModel.position.set(0, -0.86, 0);
    pivot.add(this.soldierModel);

    // Ajusta a escala para enquadramento perfeito na vitrine 3D
    const scale = 0.38;
    pivot.scale.setScalar(scale);

    this.weaponHolder.add(pivot);
    this._renderSingleFrame();
  }

  /**
   * Atualiza as cores da skin em tempo real caso o soldado esteja em exibição.
   */
  updateSoldierSkin(soldierSkin) {
    if (!soldierSkin) return;
    this.currentSoldierSkin = soldierSkin;
    if (this.activeSlot === 'soldier') {
      if (this.soldierModel) {
        applyPaletteToCharacter(this.soldierModel, soldierSkin);
        const skinName = soldierSkin.name || soldierSkin.preset || 'Operador';
        const hexColor = soldierSkin.sheenColor || soldierSkin.uniform || '#00f0ff';
        if (this.nameLabelEl) {
          this.nameLabelEl.textContent = `OPERADOR: ${skinName.toUpperCase()}`;
          this.nameLabelEl.style.color = hexColor;
        }
        const glowColor = new THREE.Color(hexColor).getHex();
        if (this.ringMat) this.ringMat.color.setHex(glowColor);
        if (this.discMat) this.discMat.color.setHex(glowColor);
        if (this.rimLight) this.rimLight.color.setHex(glowColor);
        this._renderSingleFrame();
      } else {
        this.showSoldier(soldierSkin);
      }
    }
  }

  setAutoRotate(enabled) {
    this.autoRotate = Boolean(enabled);
    this.btnAutoSpin?.classList.toggle('active', this.autoRotate);
  }

  setDragMode(mode) {
    this.dragMode = mode === 'pan' ? 'pan' : 'rotate';
    this.btnModeRotate?.classList.toggle('active', this.dragMode === 'rotate');
    this.btnModePan?.classList.toggle('active', this.dragMode === 'pan');
    if (this.canvasEl) {
      this.canvasEl.style.cursor = this.dragMode === 'pan' ? 'move' : 'grab';
    }
  }

  resetView(enableAutoSpin = true) {
    this.targetYaw = -0.35;
    this.targetPitch = 0.16;
    this.targetPanX = 0;
    this.targetPanY = 0;
    this.targetZoomDist = 1.25;
    this.setAutoRotate(enableAutoSpin);
  }

  setActive(active) {
    const next = Boolean(active);
    if (this.isActive === next) return;
    this.isActive = next;
    if (this.isActive) {
      this._resizeCanvas();
    }
    this._updateLoopState();
  }

  _resizeCanvas() {
    if (!this.renderer || !this.canvasEl || !this.containerEl || !this.camera) return;
    const rect = this.containerEl.getBoundingClientRect();
    const w = Math.max(180, Math.floor(rect.width));
    const h = Math.max(76, Math.floor(rect.height));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _bindEvents() {
    if (!this.containerEl || !this.canvasEl) return;

    // Impede que cliques ou toques dentro da vitrine iniciem a partida no #overlay
    const stopOverlayStart = (e) => {
      e.stopPropagation();
    };
    this.containerEl.addEventListener('click', stopOverlayStart);
    this.containerEl.addEventListener('mousedown', stopOverlayStart);
    this.containerEl.addEventListener('touchstart', stopOverlayStart, { passive: true });

    // Botões de HUD da Vitrine
    this.btnSlot1?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sel1 = document.getElementById('weapon-select');
      this.setWeapon(sel1 ? sel1.value : 'ar15', 0);
    });

    this.btnSlot2?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sel2 = document.getElementById('weapon-secondary-select');
      this.setWeapon(sel2 ? sel2.value : 'p9', 1);
    });

    this.btnSoldier?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showSoldier();
    });

    this.btnModeRotate?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setDragMode('rotate');
    });

    this.btnModePan?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setDragMode('pan');
    });

    this.btnAutoSpin?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setAutoRotate(!this.autoRotate);
    });

    this.btnReset?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.resetView(true);
    });

    // Desativa menu de contexto no botão direito sobre o canvas (para usar botão direito = mover)
    this.canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());

    // ── INTERAÇÃO COM MOUSE ──
    this.canvasEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._isDragging = true;
      this._lastPointerX = e.clientX;
      this._lastPointerY = e.clientY;

      // Botão direito (2), botão do meio (1), Shift pressionado ou modo 'pan' selecionado = Mover (Pan)
      if (e.button === 2 || e.button === 1 || e.shiftKey || this.dragMode === 'pan') {
        this._activeDragAction = 'pan';
        this.canvasEl.style.cursor = 'move';
      } else {
        this._activeDragAction = 'rotate';
        this.canvasEl.style.cursor = 'grabbing';
      }

      // Parar de girar automaticamente assim que o usuário interagir
      this.setAutoRotate(false);
    });

    window.addEventListener('mousemove', (e) => {
      if (!this._isDragging) return;
      const dx = e.clientX - this._lastPointerX;
      const dy = e.clientY - this._lastPointerY;
      this._lastPointerX = e.clientX;
      this._lastPointerY = e.clientY;

      this._applyPointerDelta(dx, dy, this._activeDragAction);
    });

    window.addEventListener('mouseup', () => {
      if (!this._isDragging) return;
      this._isDragging = false;
      if (this.canvasEl) {
        this.canvasEl.style.cursor = this.dragMode === 'pan' ? 'move' : 'grab';
      }
    });

    // Duplo clique no canvas reseta a vista e volta a girar
    this.canvasEl.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.resetView(true);
    });

    // Roda do mouse = Zoom nos detalhes
    this.canvasEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const zoomStep = e.deltaY * 0.0012;
      this.targetZoomDist = THREE.MathUtils.clamp(this.targetZoomDist + zoomStep, 0.52, 2.25);
    }, { passive: false });

    // ── INTERAÇÃO TOUCH (1 DEDO = GIRAR/MOVER, 2 DEDOS = MOVER + PINÇA DE ZOOM) ──
    this.canvasEl.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      if (e.touches.length === 1) {
        this._isDragging = true;
        this._activeDragAction = this.dragMode;
        this._lastPointerX = e.touches[0].clientX;
        this._lastPointerY = e.touches[0].clientY;
        this.setAutoRotate(false);
      } else if (e.touches.length >= 2) {
        this._isDragging = true;
        this._activeDragAction = 'two_finger';
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        this._lastPinchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        this._lastTwoFingerX = (t0.clientX + t1.clientX) * 0.5;
        this._lastTwoFingerY = (t0.clientY + t1.clientY) * 0.5;
        this.setAutoRotate(false);
      }
    }, { passive: true });

    this.canvasEl.addEventListener('touchmove', (e) => {
      if (!this._isDragging) return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();

      if (e.touches.length === 1 && this._activeDragAction !== 'two_finger') {
        const dx = e.touches[0].clientX - this._lastPointerX;
        const dy = e.touches[0].clientY - this._lastPointerY;
        this._lastPointerX = e.touches[0].clientX;
        this._lastPointerY = e.touches[0].clientY;
        this._applyPointerDelta(dx, dy, this._activeDragAction);
      } else if (e.touches.length >= 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const midX = (t0.clientX + t1.clientX) * 0.5;
        const midY = (t0.clientY + t1.clientY) * 0.5;

        if (this._lastPinchDist > 0) {
          const pinchDelta = this._lastPinchDist - dist;
          this.targetZoomDist = THREE.MathUtils.clamp(
            this.targetZoomDist + pinchDelta * 0.0045,
            0.52,
            2.25
          );
        }
        const dx = midX - this._lastTwoFingerX;
        const dy = midY - this._lastTwoFingerY;
        this._applyPointerDelta(dx, dy, 'pan');

        this._lastPinchDist = dist;
        this._lastTwoFingerX = midX;
        this._lastTwoFingerY = midY;
      }
    }, { passive: false });

    const endTouch = (e) => {
      if (!e.touches || e.touches.length === 0) {
        this._isDragging = false;
        this._lastPinchDist = 0;
      } else if (e.touches.length === 1) {
        this._activeDragAction = this.dragMode;
        this._lastPointerX = e.touches[0].clientX;
        this._lastPointerY = e.touches[0].clientY;
        this._lastPinchDist = 0;
      }
    };
    this.canvasEl.addEventListener('touchend', endTouch, { passive: true });
    this.canvasEl.addEventListener('touchcancel', endTouch, { passive: true });

    window.addEventListener('resize', () => {
      if (this.isActive) this._resizeCanvas();
    });
  }

  _applyPointerDelta(dx, dy, action) {
    if (action === 'pan') {
      const panSpeed = 0.0022 * (this.zoomDist / 1.25);
      this.targetPanX = THREE.MathUtils.clamp(this.targetPanX + dx * panSpeed, -0.60, 0.60);
      this.targetPanY = THREE.MathUtils.clamp(this.targetPanY - dy * panSpeed, -0.32, 0.32);
    } else {
      const rotSpeed = 0.0115;
      this.targetYaw += dx * rotSpeed;
      this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + dy * rotSpeed, -1.42, 1.42);
    }
  }

  _updateLoopState() {
    if (this.isActive && this.renderer) {
      if (!this._rafId) {
        this.lastFrameTime = performance.now();
        const tick = (now) => {
          if (!this.isActive) {
            this._rafId = null;
            return;
          }
          const dt = Math.min((now - this.lastFrameTime) * 0.001, 0.1);
          this.lastFrameTime = now;
          this._updateAndRender(dt);
          this._rafId = requestAnimationFrame(tick);
        };
        this._rafId = requestAnimationFrame(tick);
      }
    } else if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _updateAndRender(dt) {
    if (!this.renderer || !this.scene || !this.camera) return;

    // Garante que o canvas redimensione caso a aba tenha acabado de ficar visível
    if (this.containerEl) {
      const rect = this.containerEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const curW = this.canvasEl.width / this.renderer.getPixelRatio();
        const curH = this.canvasEl.height / this.renderer.getPixelRatio();
        if (Math.abs(curW - rect.width) > 2 || Math.abs(curH - rect.height) > 2) {
          this._resizeCanvas();
        }
      }
    }

    if (this.autoRotate && !this._isDragging) {
      this.targetYaw += dt * 1.15;
      this.animTime += dt;
    }

    // Interpolação amortecida para movimentos sedosos no mouse e touch
    const damp = Math.min(dt * 18, 1);
    this.yaw += (this.targetYaw - this.yaw) * damp;
    this.pitch += (this.targetPitch - this.pitch) * damp;
    this.panX += (this.targetPanX - this.panX) * damp;
    this.panY += (this.targetPanY - this.panY) * damp;
    this.zoomDist += (this.targetZoomDist - this.zoomDist) * damp;

    if (this.orbitGroup) {
      this.orbitGroup.rotation.x = this.pitch;
      this.orbitGroup.rotation.y = this.yaw;

      const bobOffset = this.autoRotate ? Math.sin(this.animTime * 2.6) * 0.022 : 0;
      this.orbitGroup.position.y += (bobOffset - this.orbitGroup.position.y) * Math.min(dt * 10, 1);
    }

    if (this.rootGroup) {
      this.rootGroup.position.x = this.panX;
      this.rootGroup.position.y = this.panY;
    }

    this.camera.position.z = this.zoomDist;
    this.renderer.render(this.scene, this.camera);
  }

  _renderSingleFrame() {
    if (!this.renderer || !this.scene || !this.camera) return;
    this._updateAndRender(0.016);
  }

  destroy() {
    this.setActive(false);
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}
