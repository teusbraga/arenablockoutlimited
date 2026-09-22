/**
 * ConfigLoader: Carregador e consolidador data-driven de configurações do jogo.
 * Suporta Deep Merge com valores padrão para garantir tolerância a falhas caso um modder
 * cometa erros de digitação ou apague propriedades em arquivos JSON.
 */

// Fallbacks de segurança garantidos (caso os arquivos JSON não carreguem)
export const DEFAULT_CONFIG = {
  PLAYER: {
    height: 1.8, crouchHeight: 1.2, eyeHeight: 1.6, eyeCrouch: 1.05,
    radius: 0.35,
    walkSpeed: 5.2, sprintMul: 1.75, crouchMul: 0.5, adsMul: 0.5,
    accel: 40.0, airAccel: 6.0, friction: 22.0,
    jumpSpeed: 7.0, gravity: 20.0,
    stepHeight: 0.55,
    regenDelay: 5.0, regenRate: 12.0
  },
  CAMERA: {
    hipFov: 78.0, adsFov: 55.0,
    sens: 0.0022, adsSensMul: 0.55,
    pitchLimit: 1.52
  },
  PHYSICS: { fixedDt: 1 / 120, maxFrame: 0.1 },
  BOTS: {
    walkSpeed: 3.2, sprintSpeed: 5.5,
    viewRange: 28.0, fov: 2.45,
    reactionTime: 0.22, losMemory: 1.6, searchTime: 3.5,
    fireInterval: 0.85, damageBody: 8.0, damageHead: 20.0,
    respawnTime: 4.0, maxHp: 100.0,
    hitAccuracyBase: 0.15, hitAccuracyRange: 35.0
  },
  SWAY: {
    springStiffness: 25.0,
    springDamping: 8.0,
    swaySensitivity: 15.0,
    walkBobFrequency: 8.0,
    sprintBobFrequency: 12.0,
    walkBobAmplitude: 0.015,
    sprintBobAmplitude: 0.030,
    idleBreathingSpeed: 1.5
  },
  GUNPLAY: {
    recoilRecoverySpeed: 14.0,
    fireStreakDecayDelay: 0.22,
    fireStreakMultiplier: 0.16,
    maxFireStreak: 6
  }
};

// Objeto singleton vivo exportado para o resto do motor
export const CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

/**
 * Função utilitária de Deep Merge
 */
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && key in target) {
      Object.assign(source[key], deepMerge(target[key], source[key]));
    }
  }
  Object.assign(target || {}, source);
  return target;
}

export class ConfigLoader {
  static async loadAll() {
    try {
      const [gameplayRes, botsRes, weaponsRes, audioRes] = await Promise.allSettled([
        fetch('./assets/config/gameplay.json').then(r => r.ok ? r.json() : null),
        fetch('./assets/characters/bots.json').then(r => r.ok ? r.json() : null),
        fetch('./assets/weapons/weapons.json').then(r => r.ok ? r.json() : null),
        fetch('./assets/config/audio.json').then(r => r.ok ? r.json() : null),
      ]);

      // 1. Gameplay Config
      if (gameplayRes.status === 'fulfilled' && gameplayRes.value) {
        const gp = gameplayRes.value;
        if (gp.player) {
          CONFIG.PLAYER.walkSpeed = gp.player.walkSpeed ?? CONFIG.PLAYER.walkSpeed;
          CONFIG.PLAYER.sprintMul = gp.player.sprintMultiplier ?? CONFIG.PLAYER.sprintMul;
          CONFIG.PLAYER.crouchMul = gp.player.crouchMultiplier ?? CONFIG.PLAYER.crouchMul;
          CONFIG.PLAYER.adsMul = gp.player.adsMultiplier ?? CONFIG.PLAYER.adsMul;
          CONFIG.PLAYER.jumpSpeed = gp.player.jumpSpeed ?? CONFIG.PLAYER.jumpSpeed;
          CONFIG.PLAYER.gravity = gp.player.gravity ?? CONFIG.PLAYER.gravity;
          CONFIG.PLAYER.stepHeight = gp.player.stepHeight ?? CONFIG.PLAYER.stepHeight;
          CONFIG.PLAYER.regenDelay = gp.player.regenDelay ?? CONFIG.PLAYER.regenDelay;
          CONFIG.PLAYER.regenRate = gp.player.regenRate ?? CONFIG.PLAYER.regenRate;
        }
        if (gp.camera) {
          CONFIG.CAMERA.hipFov = gp.camera.hipFov ?? CONFIG.CAMERA.hipFov;
          CONFIG.CAMERA.adsFov = gp.camera.adsFov ?? CONFIG.CAMERA.adsFov;
          CONFIG.CAMERA.sens = gp.camera.sensitivity ?? CONFIG.CAMERA.sens;
          CONFIG.CAMERA.adsSensMul = gp.camera.adsSensitivityMultiplier ?? CONFIG.CAMERA.adsSensMul;
        }
        if (gp.sway) {
          deepMerge(CONFIG.SWAY, gp.sway);
        }
        if (gp.gunplay) {
          deepMerge(CONFIG.GUNPLAY, gp.gunplay);
        }
      }

      // 2. Bots Config
      if (botsRes.status === 'fulfilled' && botsRes.value) {
        deepMerge(CONFIG.BOTS, botsRes.value);
      }

      const weaponsData = (weaponsRes.status === 'fulfilled' && weaponsRes.value) ? weaponsRes.value : null;
      const audioData = (audioRes.status === 'fulfilled' && audioRes.value) ? audioRes.value : null;

      return {
        config: CONFIG,
        weapons: weaponsData,
        audio: audioData
      };
    } catch (err) {
      console.warn('[ConfigLoader] Usando fallback de segurança padrão:', err);
      return { config: CONFIG, weapons: null, audio: null };
    }
  }
}
