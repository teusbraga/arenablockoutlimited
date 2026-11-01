import * as THREE from 'three';
import { CONFIG } from './ConfigLoader.js';
import { on } from './EventBus.js';
import { DeviceTierDetector } from './DeviceTierDetector.js';
import { materialFactory } from '../world/MaterialFactory.js';

/**
 * SceneSetup
 * Configura câmera, luzes, sombras, névoa e fundo da cena Three.js.
 */
export class SceneSetup {
  constructor(appElement) {
    this.appElement = appElement;

    const isTouch = (typeof window !== 'undefined' && 'ontouchstart' in window) || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
    const detectedTier = DeviceTierDetector.detect();
    const activePreset = (!CONFIG.GRAPHICS?.preset || CONFIG.GRAPHICS.preset === 'auto')
      ? detectedTier
      : CONFIG.GRAPHICS.preset;
    this.currentPreset = activePreset;

    const isPotato = activePreset === 'potato';
    const isLowOrPotato = isPotato || activePreset === 'low';

    this.renderer = new THREE.WebGLRenderer({
      antialias: !isLowOrPotato,
      precision: isTouch ? 'mediump' : 'highp',
      powerPreference: 'high-performance'
    });
    const winW = typeof window !== 'undefined' ? window.innerWidth : 800;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 600;
    this.renderer.setSize(winW, winH);

    // Limites de DPR calibrados por perfil de performance
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const maxDpr = isPotato ? 1.0 : (activePreset === 'low' ? 1.25 : (activePreset === 'medium' ? 1.5 : 2.0));
    this.renderer.setPixelRatio(Math.min(dpr, maxDpr));
    this.renderer.shadowMap.enabled = !isLowOrPotato;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.appElement.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1c2530);
    this.scene.fog = new THREE.Fog(0x1c2530, 40, 110);

    this.camera = new THREE.PerspectiveCamera(
      CONFIG.CAMERA.hipFov,
      winW / winH,
      0.03,
      250
    );
    this.scene.add(this.camera);

    this._setupLights();
    this._bindEvents();
  }

  _setupLights() {
    this.ambient = new THREE.AmbientLight(0x9aa8bc, 1.05);
    this.scene.add(this.ambient);

    this.hemi = new THREE.HemisphereLight(0xbfd0e0, 0x2a2620, 0.75);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffe9c8, 1.7);
    this.sun.position.set(14, 22, 8);
    this.sun.castShadow = true;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const shadowMapRes = isTouch ? 1024 : 2048;
    this.sun.shadow.mapSize.set(shadowMapRes, shadowMapRes);
    this.sun.shadow.camera.left = -35;
    this.sun.shadow.camera.right = 35;
    this.sun.shadow.camera.top = 35;
    this.sun.shadow.camera.bottom = -35;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);

    this.fill = new THREE.DirectionalLight(0x88aaff, 0.35);
    this.fill.position.set(-12, 10, -10);
    this.scene.add(this.fill);
  }

  _bindEvents() {
    this._onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);

      const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
      const preset = this.currentPreset || 'medium';
      const maxDpr = preset === 'potato' ? 1.0 : (preset === 'low' ? 1.25 : (preset === 'medium' ? 1.5 : 2.0));
      this.renderer.setPixelRatio(Math.min(dpr, maxDpr));
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this._onResize);
    }

    const BASE_AMBIENT = 1.05;
    this._unsubGraphics = on('config:graphicsChanged', e => {
      if (e && e.preset) {
        this.applyQualityProfile(e.preset);
        if (materialFactory && typeof materialFactory.setRenderMode === 'function') {
          if (e.preset === 'potato') materialFactory.setRenderMode('potato');
          else if (e.preset === 'low') materialFactory.setRenderMode('flat_textures');
          else materialFactory.setRenderMode('pbr');
        }
      }
    });

    this._unsubFired = on('weapon:fired', () => {
      this.ambient.intensity = BASE_AMBIENT + 0.35;
      clearTimeout(window.__ambFlashT);
      window.__ambFlashT = setTimeout(() => {
        this.ambient.intensity = BASE_AMBIENT;
      }, 60);
    });
  }

  /**
   * Aplica um preset de qualidade gráfica dinamicamente sem reload.
   * Emita 'config:graphicsChanged' via EventBus para acionar externamente.
   * @param {'high'|'medium'|'low'|'potato'} preset
   */
  applyQualityProfile(preset) {
    this.currentPreset = preset;
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    if (preset === 'potato') {
      // Extrema Performance (Potato Phone): zero sombras, fill rate travado em 1.0, 1 luz
      this.renderer.shadowMap.enabled = false;
      if (this.sun) this.sun.castShadow = false;
      if (this.fill) this.fill.visible = false;
      if (this.ambient) this.ambient.intensity = 1.7;
      if (this.hemi) this.hemi.intensity = 1.2;
      this.renderer.setPixelRatio(1.0);
    } else if (preset === 'low') {
      // Mobile / Low-End: zero sombras, 1 luz, DPR ≤ 1.25
      this.renderer.shadowMap.enabled = false;
      if (this.sun) this.sun.castShadow = false;
      if (this.fill) this.fill.visible = false;
      if (this.ambient) this.ambient.intensity = 1.6;
      if (this.hemi) this.hemi.intensity = 1.1;
      this.renderer.setPixelRatio(Math.min(dpr, 1.25));
    } else if (preset === 'medium') {
      // Equilibrado: sombras 1024, fill visível, DPR ≤ 1.5
      this.renderer.shadowMap.enabled = true;
      if (this.sun) {
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(1024, 1024);
      }
      if (this.fill) this.fill.visible = true;
      if (this.ambient) this.ambient.intensity = 1.05;
      if (this.hemi) this.hemi.intensity = 0.75;
      this.renderer.setPixelRatio(Math.min(dpr, 1.5));
    } else {
      // High (PC completo): estado original total
      this.renderer.shadowMap.enabled = true;
      if (this.sun) {
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
      }
      if (this.fill) this.fill.visible = true;
      if (this.ambient) this.ambient.intensity = 1.05;
      if (this.hemi) this.hemi.intensity = 0.75;
      this.renderer.setPixelRatio(Math.min(dpr, 2.0));
    }
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this._onResize);
    }
    if (this._unsubGraphics) {
      this._unsubGraphics();
      this._unsubGraphics = null;
    }
    if (this._unsubFired) {
      this._unsubFired();
      this._unsubFired = null;
    }
    clearTimeout(window.__ambFlashT);
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement?.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }
}
