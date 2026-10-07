import * as THREE from 'three';
import { on } from '../core/EventBus.js';

export const SCOPE_RT_CONFIG = {
  NORMAL_FOV: 75,
  ADS_FOV: 60,
  SCOPE_FOV: 12,
  SCOPE_RT_SIZE: 512,
  ADS_SPEED: 12
};

export const rad = d => d * Math.PI / 180;

export class ScopeRenderTargetSystem {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;

    this.scopeFov = SCOPE_RT_CONFIG.SCOPE_FOV;
    this.adsT = 0;
    this.scopeOn = false;

    // Scope Camera
    this.scopeCamera = new THREE.PerspectiveCamera(this.scopeFov, 1, 0.1, 150);

    // Render Target
    this.scopeRT = new THREE.WebGLRenderTarget(SCOPE_RT_CONFIG.SCOPE_RT_SIZE, SCOPE_RT_CONFIG.SCOPE_RT_SIZE, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    // We will use a custom shader on the weapon's lens mesh to combine the RT texture and a procedural reticle
    this.lensMat = new THREE.ShaderMaterial({
      transparent: false,
      uniforms: {
        tMap: { value: this.scopeRT.texture },
        uAdsT: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D tMap;
        uniform float uAdsT;
        varying vec2 vUv;

        // Função para desenhar o retículo PSO-1 style (Chevron)
        float drawChevron(vec2 uv, vec2 center, float size) {
          vec2 p = uv - center;
          p.y = -p.y; // Inverte Y para desenhar "para cima"
          float lineThick = 0.003;
          
          // Chevron
          float d1 = abs(p.y - abs(p.x)) * 0.707; // Distância para V invertido
          float chevron = (1.0 - smoothstep(0.0, lineThick, d1)) * step(p.y, 0.0) * step(-size, p.y);
          
          return chevron;
        }

        void main() {
          // Centraliza UV
          vec2 uv = vUv;
          
          // Ligeiro efeito de barrel distortion / chromatic aberration
          vec2 p = uv - 0.5;
          float r = length(p);
          vec2 ca = p * 0.005 * r;
          
          vec3 texColor;
          texColor.r = texture2D(tMap, uv + ca).r;
          texColor.g = texture2D(tMap, uv).g;
          texColor.b = texture2D(tMap, uv - ca).b;
          
          // Retículo procedural (PSO-1)
          float reticle = 0.0;
          
          // Linhas verticais e horizontais centrais
          reticle += (1.0 - smoothstep(0.0, 0.002, abs(p.x))) * step(p.y, 0.0); // Linha vertical inferior
          reticle += (1.0 - smoothstep(0.0, 0.002, abs(p.y))) * step(abs(p.x), 0.3); // Linha horizontal
          
          // Chevrons (Marcações de queda)
          reticle += drawChevron(uv, vec2(0.5, 0.5), 0.03);
          reticle += drawChevron(uv, vec2(0.5, 0.45), 0.02);
          reticle += drawChevron(uv, vec2(0.5, 0.4), 0.02);
          
          vec3 reticleColor = vec3(1.0, 0.0, 0.0); // Vermelho iluminado
          
          vec3 finalColor = mix(texColor, reticleColor, clamp(reticle, 0.0, 1.0));
          
          // Simula a escuridão quando não está em ADS (eye relief)
          float vignette = 1.0 - smoothstep(0.45, 0.5, r);
          finalColor *= mix(0.02, vignette, uAdsT); // Quase preto fora do ADS

          gl_FragColor = vec4(finalColor, 1.0);
        }`
    });

    this.mainCameraRef = null;
    this.protoDetails = null;
  }

  destroy() {
    if (this.scopeRT) {
      this.scopeRT.dispose();
      this.scopeRT = null;
    }
    if (this.lensMat) {
      this.lensMat.dispose();
    }
  }

  attachToModel(protoDetails) {
    if (!protoDetails || !protoDetails.rearLens) return;
    this.protoDetails = protoDetails;
    // Substitui o material da lente traseira pelo nosso shader
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

    this.lensMat.uniforms.uAdsT.value = this.adsT;
    this.scopeOn = this.adsT > 0.01;

    // Atualiza a câmera do scope baseada no cano ou câmera principal
    if (this.protoDetails && this.protoDetails.rearLens && this.protoDetails.frontLens) {
      this.protoDetails.rearLens.updateMatrixWorld(true);
      this.protoDetails.frontLens.updateMatrixWorld(true);
      
      const vRear = new THREE.Vector3();
      const vFront = new THREE.Vector3();
      this.protoDetails.rearLens.getWorldPosition(vRear);
      this.protoDetails.frontLens.getWorldPosition(vFront);
      
      const dir = new THREE.Vector3().subVectors(vFront, vRear).normalize();
      
      const vUp = new THREE.Vector3(0, 1, 0);
      vUp.transformDirection(this.protoDetails.opticBody.matrixWorld).normalize();

      this.scopeCamera.position.copy(mainCamera.position);
      const targetPos = new THREE.Vector3().copy(this.scopeCamera.position).add(dir);
      this.scopeCamera.up.copy(vUp);
      this.scopeCamera.lookAt(targetPos);
    } else {
      this.scopeCamera.position.copy(mainCamera.position);
      this.scopeCamera.quaternion.copy(mainCamera.quaternion);
    }

    this.scopeCamera.fov = this.scopeFov;
    this.scopeCamera.aspect = 1;
    this.scopeCamera.updateProjectionMatrix();
  }

  renderScopePass(protoModel) {
    if (!this.scopeOn) return;

    if (protoModel) protoModel.visible = false; // Não renderizar a própria arma no scope
    
    // Opcionalmente esconder o jogador local, se houver mesh
    this.renderer.setRenderTarget(this.scopeRT);
    this.renderer.clear();
    this.renderer.render(this.scene, this.scopeCamera);
    this.renderer.setRenderTarget(null);

    if (protoModel) protoModel.visible = true;
  }
}
