import { AIState } from './AIState.js';
import { CONFIG } from '../../core/ConfigLoader.js';

export class SearchState extends AIState {
  constructor() {
    super('search');
  }

  enter(controller) {
    controller.searchTimer = CONFIG.BOTS.searchTime;
  }

  update(controller, dt, player, dist, canSee) {
    const bot = controller.bot;

    if (canSee) {
      controller.changeState('engage');
      return;
    }

    controller.searchTimer -= dt;
    if (controller.searchTimer <= 0 || !controller.hasKnownPlayerPos) {
      controller.changeState('patrol');
      return;
    }

    const dx = controller.lastKnownPlayerPos.x - bot.pos.x;
    const dz = controller.lastKnownPlayerPos.z - bot.pos.z;
    const d = Math.hypot(dx, dz);

    if (d < 1.2) {
      controller.desiredMove.set(0, 0, 0);
      return;
    }

    const yaw = Math.atan2(dx, dz);
    controller._faceTowards(yaw, dt, 5);
    controller.desiredMove.x = Math.sin(yaw) * CONFIG.BOTS.walkSpeed;
    controller.desiredMove.z = Math.cos(yaw) * CONFIG.BOTS.walkSpeed;
  }
}
