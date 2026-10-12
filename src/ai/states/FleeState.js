import { AIState } from './AIState.js';
import { CONFIG } from '../../core/ConfigLoader.js';

export class FleeState extends AIState {
  constructor() {
    super('flee');
    this.fleeTimer = 0;
  }

  enter(controller) {
    this.fleeTimer = 3.0 + Math.random() * 2.0;
    const randomAngle = (Math.random() - 0.5) * Math.PI * 0.8;
    this.scatterAngleOffset = randomAngle;
    controller.fleeTarget = null;
  }

  _pickFleeTarget(controller, player) {
    const bot = controller.bot;
    let dx = bot.pos.x - player.pos.x;
    let dz = bot.pos.z - player.pos.z;
    if (Math.hypot(dx, dz) < 0.1) {
      dx = Math.sin(bot.yaw);
      dz = Math.cos(bot.yaw);
    }
    const baseAngle = Math.atan2(dx, dz) + (this.scatterAngleOffset || 0);

    if (controller.navGrid) {
      // Testa pontos no hemisfério oposto ao jogador (10m a 16m)
      const offsets = [0, 0.4, -0.4, 0.85, -0.85, 1.3, -1.3];
      for (let i = 0; i < offsets.length; i++) {
        const ang = baseAngle + offsets[i];
        const dist = 11.0 + Math.random() * 5.0;
        const tx = bot.pos.x + Math.sin(ang) * dist;
        const tz = bot.pos.z + Math.cos(ang) * dist;
        if (controller.navGrid.isWorldWalkable(tx, tz)) {
          return { x: tx, z: tz };
        }
      }
      return controller.navGrid.findRandomWalkablePoint(bot.pos, null, 8.0, 18.0);
    }

    return {
      x: bot.pos.x + Math.sin(baseAngle) * 14.0,
      z: bot.pos.z + Math.cos(baseAngle) * 14.0,
    };
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

    if (
      !controller.fleeTarget ||
      Math.hypot(controller.fleeTarget.x - bot.pos.x, controller.fleeTarget.z - bot.pos.z) < 1.5
    ) {
      controller.fleeTarget = this._pickFleeTarget(controller, player);
      controller.clearPath();
    }

    controller.navigateTo(
      controller.fleeTarget.x,
      controller.fleeTarget.z,
      CONFIG.BOTS.sprintSpeed,
      dt,
      7
    );
  }
}

