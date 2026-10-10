import * as THREE from 'three';
import { SmokeGrenade } from './SmokeGrenade.js';
import { emit } from '../core/EventBus.js';

/**
 * SmokeGrenadeManager.js
 * Gerenciador de lançamento e ciclo de vida de granadas de fumaça,
 * controlando rigorosamente o cooldown de 30 segundos e eventos associados.
 */
export class SmokeGrenadeManager {
  constructor({ scene = null, world = null, audio = null } = {}) {
    this.scene = scene;
    this.world = world;
    this.audio = audio;
    this.grenades = [];
    this.cooldown = 0;
    this.maxCooldown = 30.0; // Cooldown de 30 segundos solicitado
  }

  setDependencies({ scene, world, audio }) {
    if (scene) this.scene = scene;
    if (world) this.world = world;
    if (audio) this.audio = audio;
  }

  canThrow() {
    return this.cooldown <= 0;
  }

  getRemainingSeconds() {
    return Math.max(0, Math.ceil(this.cooldown));
  }

  getCooldownRatio() {
    return Math.max(0, Math.min(1.0, this.cooldown / this.maxCooldown));
  }

  /**
   * Tenta lançar uma granada de fumaça a partir da câmera/jogador.
   */
  throw({ camera, player }) {
    if (this.cooldown > 0) {
      const remaining = Math.ceil(this.cooldown);
      emit('hud:popup', {
        text: `FUMAÇA EM COOLDOWN (${remaining}s)`,
        color: '#e0a14a',
        duration: 900
      });
      emit('weapon:empty');
      return false;
    }

    if (!camera || !player) return false;

    // Inicia cooldown de 30 segundos
    this.cooldown = this.maxCooldown;

    // Posição de saída (ligeiramente à frente da câmera)
    const launchPos = new THREE.Vector3();
    const launchDir = new THREE.Vector3();

    camera.getWorldPosition(launchPos);
    camera.getWorldDirection(launchDir);

    // Desloca 0.35m à frente na linha de visão
    launchPos.addScaledVector(launchDir, 0.35);
    launchPos.y -= 0.10;

    const grenade = new SmokeGrenade({
      pos: launchPos,
      dir: launchDir,
      world: this.world,
      scene: this.scene,
      audio: this.audio
    });

    this.grenades.push(grenade);

    emit('hud:popup', {
      text: 'GRANADA DE FUMAÇA LANÇADA (10s ativa · Cooldown: 30s)',
      color: '#65d6a2',
      duration: 1200
    });
    emit('smoke:thrown', { remainingCooldown: this.maxCooldown });

    return true;
  }

  update(dt) {
    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - dt);
    }

    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.update(dt);
      if (g.state === 'done') {
        this.grenades.splice(i, 1);
      }
    }
  }

  reset() {
    this.cooldown = 0;
    for (const g of this.grenades) {
      g.dispose();
    }
    this.grenades = [];
  }
}
