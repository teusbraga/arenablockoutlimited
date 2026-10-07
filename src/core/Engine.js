export function startEngine({
  fixedUpdate,
  renderUpdate,
  update, // Fallback de retrocompatibilidade
  render, // Fallback de retrocompatibilidade
  fixedDt = 1 / 60,
  maxFrame = 0.1,
}) {
  const onFixed = fixedUpdate || update;
  const onRender = renderUpdate || render;

  let acc = 0;
  let last = performance.now() / 1000;

  function frame(nowMs) {
    requestAnimationFrame(frame);
    const now = nowMs / 1000;
    let dt = now - last;
    last = now;
    if (dt > maxFrame) dt = maxFrame;

    acc += dt;
    let steps = 0;
    while (acc >= fixedDt && steps < 5) {
      if (onFixed) onFixed(fixedDt);
      acc -= fixedDt;
      steps++;
    }

    const alpha = acc / fixedDt;
    if (onRender) onRender(alpha, dt);
  }
  requestAnimationFrame(frame);
}