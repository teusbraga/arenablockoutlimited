import * as THREE from 'three';
import { on } from '../core/EventBus.js';

export const SCOPE_RT_CONFIG = {
  NORMAL_FOV: 75,
  ADS_FOV: 60,
  SCOPE_FOV: 12,
  SCOPE_RT_SIZE: 512,
  ADS_SPEED: 12,
  LENS_SIZE: 0.42,
};

export const rad = d => d * Math.PI / 180;

export class ScopeRenderTargetSystem {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;

    this.scopeFov = SCOPE_RT_CONFIG.SCOPE_FOV;
    this.adsT = 0;
    this.scopeOn = false;
    this.baseDepth = null;
    this.pxShiftX = 0;
    this.pxShiftY = 0;

    // ── Scope Camera (second camera, narrow FOV, aspect=1 for square RT)
    this.scopeCamera = new THREE.PerspectiveCamera(this.scopeFov, 1, 0.1, 150);

    // ── Render Target (scene rendered from scope POV → texture)
    this.scopeRT = new THREE.WebGLRenderTarget(SCOPE_RT_CONFIG.SCOPE_RT_SIZE, SCOPE_RT_CONFIG.SCOPE_RT_SIZE, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    // ── Overlay ShaderMaterial: RT texture + PSO-1 procedural reticle + vignette
    this.lensMat = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tMap:      { value: this.scopeRT.texture },
        uOpacity:  { value: 0.0 },
        uParallax: { value: new THREE.Vector2(0, 0) },
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tMap;
        uniform float uOpacity;
        uniform vec2 uParallax;
        varying vec2 vUv;

        float drawChevron(vec2 uv, vec2 center, float size) {
          vec2 p = uv - center;
          p.y = -p.y;
          float lineThick = 0.003;
          float d1 = abs(p.y - abs(p.x)) * 0.707;
          return (1.0 - smoothstep(0.0, lineThick, d1)) * step(p.y, 0.0) * step(-size, p.y);
        }

        void main() {
          vec2 p = vUv - 0.5;
          float r = length(p) * 2.0;

          // Chromatic aberration
          vec2 ca = p * 0.006 * r * r;
          vec3 col;
          col.r = texture2D(tMap, vUv + ca).r;
          col.g = texture2D(tMap, vUv).g;
          col.b = texture2D(tMap, vUv - ca).b;
          col *= 1.18;

          // PSO-1 procedural reticle (crosshairs + chevron drop marks)
          vec2 pp = p; // p already centered on 0,0; but shader draws in vUv space so:
          vec2 uvp = vUv - 0.5; // same as p
          float reticle = 0.0;
          reticle += (1.0 - smoothstep(0.0, 0.002, abs(uvp.x))) * step(uvp.y, 0.0);
          reticle += (1.0 - smoothstep(0.0, 0.002, abs(uvp.y))) * step(abs(uvp.x), 0.3);
          reticle += drawChevron(vUv, vec2(0.5, 0.5),  0.030);
          reticle += drawChevron(vUv, vec2(0.5, 0.45), 0.020);
          reticle += drawChevron(vUv, vec2(0.5, 0.40), 0.020);
          vec3 reticleColor = vec3(1.0, 0.12, 0.0);
          col = mix(col, reticleColor, clamp(reticle, 0.0, 1.0));

          // Sharp circular mask (clean 1-px AA edge)
          float alpha = uOpacity * (1.0 - smoothstep(0.995, 1.0, r));

          gl_FragColor = vec4(col, alpha);
        }`,
    });

    // ── 2D Overlay: orthographic scene + circular lens mesh (1 unit radius → scaled in px)
    this.overlayScene = new THREE.Scene();
    this.overlayCam = new THREE.OrthographicCamera(
      -innerWidth / 2, innerWidth / 2,
       innerHeight / 2, -innerHeight / 2,
      -10, 10
    );
    this.lensMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 48), this.lensMat);
    this.overlayScene.add(this.lensMesh);

    this.mainCameraRef = null;
    this.protoDetails = null;

    this._onResize = () => this.onResize();
    window.addEventListener('resize', this._onResize);
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    if (this.scopeRT) {
      this.scopeRT.dispose();
      this.scopeRT = null;
    }
    if (this.lensMat) this.lensMat.dispose();
    if (this.lensMesh) this.lensMesh.geometry.dispose();
  }

  lensDiameter() {
    return Math.min(innerWidth, innerHeight) * SCOPE_RT_CONFIG.LENS_SIZE;
  }

  attachToModel(protoDetails) {
    if (!protoDetails || !protoDetails.rearLens) return;
    this.protoDetails = protoDetails;
    // Apply the scope RT shader to the 3D rear lens mesh as well (visible in close-up / ADS lock)
    protoDetails.rearLens.material = this.lensMat;
  }

  getSensitivityFactor() {
    if (this.adsT <= 0.001) return 1.0;
    const ratio = Math.tan(rad(this.scopeFov) / 2) / Math.tan(rad(SCOPE_RT_CONFIG.ADS_FOV) / 2);
    return 1 + (Math.pow(ratio, 0.6) - 1) * this.adsT;
  }

  update(dt, mainCamera, isAdsActive, rig, viewmodel) {
    this.mainCameraRef = mainCamera;

    const target = isAdsActive ? 1 : 0;
    this.adsT += (target - this.adsT) * (1 - Math.exp(-dt * SCOPE_RT_CONFIG.ADS_SPEED));
    if (Math.abs(target - this.adsT) < 0.001) this.adsT = target;

    this.scopeOn = this.adsT > 0.01;

    // ── Orient scope camera using front/rear lens world positions (tracks weapon sway/recoil)
    if (this.protoDetails && this.protoDetails.rearLens && this.protoDetails.frontLens) {
      this.protoDetails.rearLens.updateMatrixWorld(true);
      this.protoDetails.frontLens.updateMatrixWorld(true);

      const vRear  = new THREE.Vector3();
      const vFront = new THREE.Vector3();
      this.protoDetails.rearLens.getWorldPosition(vRear);
      this.protoDetails.frontLens.getWorldPosition(vFront);

      const dir = new THREE.Vector3().subVectors(vFront, vRear).normalize();

      const vUp = new THREE.Vector3(0, 1, 0);
      if (this.protoDetails.opticBody) {
        vUp.transformDirection(this.protoDetails.opticBody.matrixWorld).normalize();
      }

      this.scopeCamera.position.copy(mainCamera.position);
      const lookTarget = new THREE.Vector3().copy(this.scopeCamera.position).add(dir);
      this.scopeCamera.up.copy(vUp);
      this.scopeCamera.lookAt(lookTarget);
    } else {
      this.scopeCamera.position.copy(mainCamera.position);
      this.scopeCamera.quaternion.copy(mainCamera.quaternion);
    }

    this.scopeCamera.fov = this.scopeFov;
    this.scopeCamera.aspect = 1;
    this.scopeCamera.updateProjectionMatrix();
  }

  // ── PASS 1: Render scene from scope camera → RT (called before main render)
  renderScopePass(vssModel) {
    if (!this.scopeOn) return;

    // Re-sync scope camera with latest matrices before rendering
    if (this.mainCameraRef) {
      this.scopeCamera.position.copy(this.mainCameraRef.position);
    }
    if (this.protoDetails?.rearLens && this.protoDetails?.frontLens) {
      this.protoDetails.rearLens.updateMatrixWorld(true);
      this.protoDetails.frontLens.updateMatrixWorld(true);
      const vRear  = new THREE.Vector3();
      const vFront = new THREE.Vector3();
      this.protoDetails.rearLens.getWorldPosition(vRear);
      this.protoDetails.frontLens.getWorldPosition(vFront);
      const dir = new THREE.Vector3().subVectors(vFront, vRear).normalize();
      const vUp = new THREE.Vector3(0, 1, 0);
      if (this.protoDetails.opticBody) {
        vUp.transformDirection(this.protoDetails.opticBody.matrixWorld).normalize();
      }
      const lookTarget = new THREE.Vector3().copy(this.scopeCamera.position).add(dir);
      this.scopeCamera.up.copy(vUp);
      this.scopeCamera.lookAt(lookTarget);
    } else if (this.mainCameraRef) {
      this.scopeCamera.quaternion.copy(this.mainCameraRef.quaternion);
    }

    if (vssModel) vssModel.visible = false;
    this.renderer.setRenderTarget(this.scopeRT);
    this.renderer.clear();
    this.renderer.render(this.scene, this.scopeCamera);
    this.renderer.setRenderTarget(null);
    if (vssModel) vssModel.visible = true;
  }

  // ── PASS 2: Composite RT texture as 2D overlay disc (called after main render)
  render(mainCamera) {
    const w = innerWidth, h = innerHeight;
    if (!this.scopeOn) return;

    // Overlay fades in only at the final phase of ADS (eye-relief transition)
    const eyeReliefThreshold = 0.65;
    const overlayProgress = Math.max(0, (this.adsT - eyeReliefThreshold) / (1 - eyeReliefThreshold));
    if (overlayProgress <= 0.001) return;
    const smoothOverlay = Math.pow(overlayProgress, 1.8);

    mainCamera.updateMatrixWorld(true);
    if (this.protoDetails?.rearLens) this.protoDetails.rearLens.updateMatrixWorld(true);
    if (this.protoDetails?.frontLens) this.protoDetails.frontLens.updateMatrixWorld(true);

    let offsetX = 0, offsetY = 0, rollAngle = 0, depthScale = 1.0;

    if (this.protoDetails?.rearLens) {
      const v = new THREE.Vector3();
      this.protoDetails.rearLens.getWorldPosition(v);

      // Track depth for physically-accurate lens scale during weapon sway/recoil
      const vCam  = v.clone().applyMatrix4(mainCamera.matrixWorldInverse);
      const depthZ = -vCam.z;
      if (!this.baseDepth) {
        this.baseDepth = depthZ;
      } else if (this.adsT > 0.95) {
        this.baseDepth += (depthZ - this.baseDepth) * 0.05;
      }
      if (depthZ > 0.02) {
        const rawScale = this.baseDepth / depthZ;
        depthScale = Math.max(0.65, Math.min(2.5, rawScale));
      }

      // Project rear lens world position onto screen
      v.project(mainCamera);
      offsetX =  v.x * (w / 2);
      offsetY = -v.y * (h / 2);

      // Roll: track optic body world orientation to sync disc rotation with weapon tilt
      if (this.protoDetails.opticBody) {
        const vUp = new THREE.Vector3(0, 1, 0);
        vUp.transformDirection(this.protoDetails.opticBody.matrixWorld);
        vUp.transformDirection(mainCamera.matrixWorldInverse);
        rollAngle = Math.atan2(vUp.x, vUp.y);
      }

      // Parallax shift (front vs rear lens offset = parallax depth cue)
      if (this.protoDetails.frontLens) {
        const vFront = new THREE.Vector3();
        this.protoDetails.frontLens.getWorldPosition(vFront);
        vFront.project(mainCamera);
        this.pxShiftX = (vFront.x * (w / 2)) - offsetX;
        this.pxShiftY = (-vFront.y * (h / 2)) - offsetY;
      }
    }

    const centerX = (w / 2) + offsetX;
    const centerY = (h / 2) - offsetY; // WebGL scissor: origin bottom-left

    const D = this.lensDiameter() * (0.68 + 0.32 * smoothOverlay) * depthScale;
    const R = D / 2;

    // Position and scale the 2D disc mesh in the ortho overlay scene
    this.lensMesh.position.set(offsetX, -offsetY, 0);
    this.lensMesh.rotation.z = -rollAngle;
    this.lensMesh.scale.set(R, R, 1);
    this.lensMat.uniforms.uOpacity.value = smoothOverlay;

    // Parallax: physical tube depth feeling
    let shiftX = 0, shiftY = 0;
    if (D > 0 && this.pxShiftX !== undefined) {
      const pxMul = 0.80;
      shiftX = (this.pxShiftX / D) * pxMul;
      shiftY = (-this.pxShiftY / D) * pxMul;
    }
    this.lensMat.uniforms.uParallax.value.set(shiftX, shiftY);

    // Scissor test (render only the lens quad area for performance)
    const scissorX    = Math.round(centerX - R - 2);
    const scissorY    = Math.round(centerY - R - 2);
    const scissorSize = Math.round(D + 4);

    this.renderer.setScissor(scissorX, scissorY, scissorSize, scissorSize);
    this.renderer.setScissorTest(true);
    this.renderer.autoClear = false;
    this.renderer.render(this.overlayScene, this.overlayCam);
    this.renderer.setScissorTest(false);
    this.renderer.autoClear = true;
  }

  onResize() {
    this.overlayCam.left   = -innerWidth  / 2;
    this.overlayCam.right  =  innerWidth  / 2;
    this.overlayCam.top    =  innerHeight / 2;
    this.overlayCam.bottom = -innerHeight / 2;
    this.overlayCam.updateProjectionMatrix();
  }
}
