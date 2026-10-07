import { AIState } from './AIState.js';
import { CONFIG } from '../../core/ConfigLoader.js';

export class FleeState extends AIState {
  constructor() {
    super('flee');
    this.fleeTimer = 0;
  }

  enter(controller) {
    this.fleeTimer = 2.5 + Math.random() * 1.5;
  }

  update(controller, dt, player, dist, canSee) {
    const bot = controller.bot;
    this.fleeTimer -= dt;

    if (this.fleeTimer <= 0 || dist > 25) {
      if (canSee) {
        controller.changeState('engage');
      } else {
        controller.changeState('patrol');
      }
      return;
    }

    // Foge na direção oposta ao jogador
    const dx = bot.pos.x - player.pos.x;
    const dz = bot.pos.z - player.pos.z;
    const yaw = Math.atan2(dx, dz);
    controller._faceTowards(yaw, dt, 7);

    // Corre em velocidade de sprint
    controller.desiredMove.x = Math.sin(yaw) * CONFIG.BOTS.sprintSpeed;
    controller.desiredMove.z = Math.cos(yaw) * CONFIG.BOTS.sprintSpeed;
  }
}
