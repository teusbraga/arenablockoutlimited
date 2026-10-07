import { AIState } from './AIState.js';
import { CONFIG } from '../../core/ConfigLoader.js';

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

    // Disparo
    if (canSee && controller.reactionTimer <= 0) {
      controller.fireTimer -= dt;
      if (controller.fireTimer <= 0) {
        controller.fireTimer = CONFIG.BOTS.fireInterval * (0.8 + Math.random() * 0.6);
        controller._fire(player, dist);
      }
    } else if (controller.reactionTimer > 0) {
      controller.reactionTimer -= dt;
    }
  }
}
