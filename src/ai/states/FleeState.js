import { AIState } from './AIState.js';
import { CONFIG } from '../../core/ConfigLoader.js';

export class FleeState extends AIState {
  constructor() {
    super('flee');
    this.fleeTimer = 0;
  }

  enter(controller) {
    this.fleeTimer = 3.0 + Math.random() * 2.0;
    // Direção aleatória de dispersão (caso jogador tenha morrido ou para dispersar em leque)
    const randomAngle = (Math.random() - 0.5) * Math.PI * 0.8;
    this.scatterAngleOffset = randomAngle;
  }

  update(controller, dt, player, dist, canSee) {
    const bot = controller.bot;
    this.fleeTimer -= dt;

    if (this.fleeTimer <= 0 || (!player.alive && this.fleeTimer <= 0) || (player.alive && dist > 28)) {
      if (player.alive && canSee) {
        controller.changeState('engage');
      } else {
        controller.changeState('patrol');
      }
      return;
    }

    // Foge na direção oposta ao jogador (com ângulo de dispersão)
    let dx = bot.pos.x - player.pos.x;
    let dz = bot.pos.z - player.pos.z;
    if (Math.hypot(dx, dz) < 0.1) {
      dx = Math.sin(bot.yaw);
      dz = Math.cos(bot.yaw);
    }
    const baseAngle = Math.atan2(dx, dz);
    const yaw = baseAngle + (this.scatterAngleOffset || 0);
    controller._faceTowards(yaw, dt, 7);

    // Corre em velocidade de sprint para dispersar
    controller.desiredMove.x = Math.sin(yaw) * CONFIG.BOTS.sprintSpeed;
    controller.desiredMove.z = Math.cos(yaw) * CONFIG.BOTS.sprintSpeed;
  }
}
