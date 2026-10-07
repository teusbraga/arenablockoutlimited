import * as THREE from 'three';
import { CONFIG } from './ConfigLoader.js';
import { on } from './EventBus.js';

/**
 * SceneSetup
 * Configura câmera, luzes, sombras, névoa e fundo da cena Three.js.
 */
export class SceneSetup {
  constructor(appElement) {
    this.appElement = appElement;

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // Em mobile (high-dpi nativo), travar o pixel ratio perto de 1.0 ou 1.2 destrava o FPS.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.2 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.appElement.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1c2530);
    this.scene.fog = new THREE.Fog(0x1c2530, 40, 110);

    this.camera = new THREE.PerspectiveCamera(
      CONFIG.CAMERA.hipFov,
      window.innerWidth / window.innerHeight,
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
    };
    window.addEventListener('resize', this._onResize);

    const BASE_AMBIENT = 1.05;
    this._unsubFired = on('weapon:fired', () => {
      this.ambient.intensity = BASE_AMBIENT + 0.35;
      clearTimeout(window.__ambFlashT);
      window.__ambFlashT = setTimeout(() => {
        this.ambient.intensity = BASE_AMBIENT;
      }, 60);
    });
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
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
