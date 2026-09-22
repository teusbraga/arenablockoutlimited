(function (Game) {
  'use strict';

  const { on } = Game.EventBus;

  class DamageIndicator {
    constructor() {
      this.canvas = document.getElementById('damage-indicator');
      this.ctx = this.canvas.getContext('2d');
      this.marks = [];
      this.player = null;
      this._bind();
    }

    setPlayer(player) { this.player = player; }

    _bind() {
      on('player:damaged', e => {
        if (!this.player || !e.source) return;
        const srcPos = e.source.pos;
        if (!srcPos) return;

        const dx = srcPos.x - this.player.pos.x;
        const dz = srcPos.z - this.player.pos.z;
        this.marks.push({ dx, dz, life: 1.0, maxLife: 1.0 });
      });
    }

    update(dt) {
      const w = this.canvas.width, h = this.canvas.height;
      const cx = w / 2, cy = h / 2, R = 82;
      this.ctx.clearRect(0, 0, w, h);

      if (!this.player || this.marks.length === 0) return;
      const yaw = this.player.yaw;
      const cosY = Math.cos(yaw), sinY = Math.sin(yaw);

      for (let i = this.marks.length - 1; i >= 0; i--) {
        const m = this.marks[i];
        m.life -= dt * 1.1;
        if (m.life <= 0) { this.marks.splice(i, 1); continue; }

        // Decompõe (dx, dz) nos eixos da câmera
        // forward = (-sin, -cos), right = (cos, -sin)
        const relRight   =  m.dx * cosY - m.dz * sinY;
        const relForward = -m.dx * sinY - m.dz * cosY;

        // Ângulo com 0 = topo da tela, positivo para a direita
        const canvasAngle = Math.atan2(relRight, relForward) - Math.PI / 2;

        const alpha = Math.min(m.life, 1);
        const arcHalf = 0.30;

        this.ctx.strokeStyle = `rgba(224, 87, 74, ${alpha})`;
        this.ctx.lineWidth = 8;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, R, canvasAngle - arcHalf, canvasAngle + arcHalf);
        this.ctx.stroke();
      }
    }
  }

  Game.DamageIndicator = DamageIndicator;

})(window.Game = window.Game || {});