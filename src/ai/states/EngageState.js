import { AIState } from './AIState.js';
import { CONFIG } from '../../core/ConfigLoader.js';
import { WEAPONS } from '../../weapons/WeaponDefs.js';

export class EngageState extends AIState {
  constructor() {
    super('engage');
  }

  enter(controller) {
    controller.reactionTimer = CONFIG.BOTS.reactionTime;
  }

  update(controller, dt, player, dist, canSee) {
    const bot = controller.bot;

    // Se HP estiver crítico (< 30%), recua para Flee/Cover
    if (bot.hp < 30 && dist < 20) {
      controller.changeState('flee');
      return;
    }

    if (!canSee) {
      controller.losTimer -= dt;
      if (controller.losTimer <= 0) {
        controller.changeState('search');
        return;
      }
    } else {
      controller.losTimer = CONFIG.BOTS.losMemory;
    }

    const targetYaw = Math.atan2(player.pos.x - bot.pos.x, player.pos.z - bot.pos.z);
    controller._faceTowards(targetYaw, dt, 8);

    controller.strafeTimer -= dt;
    if (controller.strafeTimer <= 0) {
      controller.strafeDir = Math.random() < 0.5 ? -1 : 1;
      controller.strafeTimer = 0.6 + Math.random() * 1.2;
    }

    // Strafe lateral
    const rightX = Math.cos(bot.yaw);
    const rightZ = -Math.sin(bot.yaw);
    controller.desiredMove.x = rightX * controller.strafeDir * CONFIG.BOTS.walkSpeed * 0.6;
    controller.desiredMove.z = rightZ * controller.strafeDir * CONFIG.BOTS.walkSpeed * 0.6;

    // Avanço / recuo tático
    let forward = 0;
    if (dist > 14) forward = CONFIG.BOTS.sprintSpeed * 0.7;
    else if (dist < 5) forward = -CONFIG.BOTS.walkSpeed * 0.6;
    controller.desiredMove.x += Math.sin(bot.yaw) * forward;
    controller.desiredMove.z += Math.cos(bot.yaw) * forward;

    // Tática de Lean / Peek atrás de quinas e durante disparos
    controller.leanTimer = (controller.leanTimer || 0) - dt;
    if (controller.leanTimer <= 0) {
      const roll = Math.random();
      if (roll < 0.35) {
        bot.targetLean = -1.0; // Peek esquerdo
      } else if (roll < 0.70) {
        bot.targetLean = 1.0;  // Peek direito
      } else {
        bot.targetLean = 0.0;  // Tronco ereto
      }
      controller.leanTimer = 1.0 + Math.random() * 1.5;
    }

    // Disparo (com suporte a burst fire para armas automáticas)
    if (canSee && controller.reactionTimer <= 0) {
      controller.fireTimer -= dt;
      if (controller.fireTimer <= 0) {
        const weaponDef = WEAPONS[bot.weaponId];
        const isAuto = weaponDef?.auto === true;

        if (isAuto) {
          // Se estamos em andamento de uma rajada (burst fire)
          if (controller.burstShotsRemaining > 0) {
            controller._fire(player, dist);
            controller.burstShotsRemaining--;

            if (controller.burstShotsRemaining > 0) {
              // Próximo tiro dentro da mesma rajada (cadência rápida baseada no fireInterval da arma)
              const intraInterval = weaponDef?.fireInterval || 0.1;
              controller.fireTimer = intraInterval * (0.9 + Math.random() * 0.2);
            } else {
              // Rajada concluída: pausa/delay tático antes da próxima sequência
              controller.fireTimer = (CONFIG.BOTS.fireInterval || 0.85) * (0.7 + Math.random() * 0.7);
            }
          } else {
            // Chance de iniciar uma rajada (burst fire de 2 a 4 tiros) de vez em quando
            const doBurst = Math.random() < 0.65;
            if (doBurst) {
              controller.burstShotsRemaining = 2 + Math.floor(Math.random() * 3); // 2, 3 ou 4 tiros
              controller._fire(player, dist);
              controller.burstShotsRemaining--;

              const intraInterval = weaponDef?.fireInterval || 0.1;
              controller.fireTimer = intraInterval * (0.9 + Math.random() * 0.2);
            } else {
              // Disparo único / cadenciado
              controller._fire(player, dist);
              controller.fireTimer = (CONFIG.BOTS.fireInterval || 0.85) * (0.8 + Math.random() * 0.6);
            }
          }
        } else {
          // Arma semi-automática ou shotgun/sniper
          controller._fire(player, dist);
          const interval = Math.max(weaponDef?.fireInterval || 0.4, CONFIG.BOTS.fireInterval * 0.8);
          controller.fireTimer = interval * (0.85 + Math.random() * 0.5);
        }
      }
    } else if (controller.reactionTimer > 0) {
      controller.reactionTimer -= dt;
    }
  }

  exit(controller) {
    if (controller.bot) {
      controller.bot.targetLean = 0;
    }
  }
}
