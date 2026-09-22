export function startEngine({ update, render, fixedDt = 1/120, maxFrame = 0.1 }) {
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
      update(fixedDt);
      acc -= fixedDt;
      steps++;
    }
    render(acc / fixedDt, dt);
  }
  requestAnimationFrame(frame);
}