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
      if (controller.navGrid) {
        const pt = controller.navGrid.findRandomWalkablePoint(bot.pos, null, 7.0, 20.0);
        controller.patrolTarget.x = pt.x;
        controller.patrolTarget.z = pt.z;
      } else {
        controller.patrolTarget.x = (Math.random() * 2 - 1) * 16;
        controller.patrolTarget.z = (Math.random() * 2 - 1) * 16;
      }
      controller.hasPatrolTarget = true;
      controller.clearPath();
    }

    controller.navigateTo(
      controller.patrolTarget.x,
      controller.patrolTarget.z,
      CONFIG.BOTS.walkSpeed * 0.75,
      dt,
      4
    );
  }
}

