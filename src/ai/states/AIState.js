export class AIState {
  constructor(name) {
    this.name = name;
  }

  enter(controller) {}
  update(controller, dt, player, dist, canSee) {}
  exit(controller) {}
}
