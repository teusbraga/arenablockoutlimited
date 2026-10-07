import { AIState } from './AIState.js';
import { CONFIG } from '../../core/ConfigLoader.js';

export class PatrolState extends AIState {
  constructor() {
    super('patrol');
  }

  enter(controller) {
    if (!controller.patrolTarget) {
      controller.patrolTarget = { x: 0, z: 0 };
    }
    controller.hasPatrolTarget = false;
  }

  update(controller, dt, player, dist, canSee) {
    const bot = controller.bot;

    if (canSee) {
      controller.changeState('engage');
      return;
    }

    if (!controller.patrolTarget) {
      controller.patrolTarget = { x: 0, z: 0 };
      controller.hasPatrolTarget = false;
    }

    if (!controller.hasPatrolTarget || Math.hypot(controller.patrolTarget.x - bot.pos.x, controller.patrolTarget.z - bot.pos.z) < 1.5) {
      controller.patrolTarget.x = (Math.random() * 2 - 1) * 16;
      controller.patrolTarget.z = (Math.random() * 2 - 1) * 16;
      controller.hasPatrolTarget = true;
    }

    const dx = controller.patrolTarget.x - bot.pos.x;
    const dz = controller.patrolTarget.z - bot.pos.z;
    const yaw = Math.atan2(dx, dz);
    controller._faceTowards(yaw, dt, 4);

    controller.desiredMove.x = Math.sin(yaw) * CONFIG.BOTS.walkSpeed * 0.7;
    controller.desiredMove.z = Math.cos(yaw) * CONFIG.BOTS.walkSpeed * 0.7;
  }
}
