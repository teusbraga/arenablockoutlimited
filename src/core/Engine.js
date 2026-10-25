function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function showCrashScreen(err) {
  if (typeof document === 'undefined') return;
  let crashEl = document.getElementById('engine-crash-screen');
  if (!crashEl) {
    crashEl = document.createElement('div');
    crashEl.id = 'engine-crash-screen';
    crashEl.style.cssText = `
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(15, 18, 24, 0.96);
      color: #ff5555;
      font-family: monospace;
      padding: 30px;
      box-sizing: border-box;
      z-index: 999999;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
    `;
    document.body.appendChild(crashEl);
  }

  const errName = err?.name || 'Error';
  const errMessage = err?.message || String(err);
  const errStack = err?.stack || 'Sem stack trace disponível.';

  crashEl.innerHTML = `
    <h2 style="margin: 0; color: #ff4757; font-size: 20px; font-weight: bold;">⚠️ [Engine Crash Boundary] Exceção Fatal no Loop Principal</h2>
    <p style="margin: 0; color: #ced6e0; font-size: 13px;">A simulação física e a renderização foram congeladas para proteger o estado do jogo.</p>
    <div style="background: #1e222d; border-left: 4px solid #ff4757; padding: 14px; width: 100%; box-sizing: border-box; border-radius: 4px;">
      <div style="color: #ffffff; font-size: 14px; font-weight: bold;">${escapeHtml(errName)}: ${escapeHtml(errMessage)}</div>
      <pre style="margin: 10px 0 0 0; color: #a4b0be; font-size: 11px; white-space: pre-wrap; word-break: break-all; line-height: 1.4;">${escapeHtml(errStack)}</pre>
    </div>
    <button id="engine-crash-restart-btn" style="
      background: #ff4757; color: #ffffff; border: none; padding: 10px 22px;
      font-size: 13px; font-weight: bold; border-radius: 4px; cursor: pointer;
      font-family: inherit; margin-top: 4px;
    ">Reiniciar Partida</button>
  `;

  document.getElementById('engine-crash-restart-btn')?.addEventListener('click', () => {
    if (typeof location !== 'undefined' && location.reload) {
      location.reload();
    }
  });
}

export function startEngine({
  fixedUpdate,
  renderUpdate,
  update, // Fallback de retrocompatibilidade
  render, // Fallback de retrocompatibilidade
  fixedDt = 1 / 60,
  maxFrame = 0.1,
  onError,
}) {
  const onFixed = fixedUpdate || update;
  const onRender = renderUpdate || render;

  let acc = 0;
  let last = 0;
  let isCrashed = false;
  let frameId = null;

  function frame(nowMs) {
    if (isCrashed) return;

    try {
      const now = nowMs / 1000;
      if (last === 0) {
        last = now;
        frameId = requestAnimationFrame(frame);
        return;
      }
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

      frameId = requestAnimationFrame(frame);
    } catch (err) {
      isCrashed = true;
      if (frameId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(frameId);
      }
      console.error('[Engine Crash Boundary] Erro fatal no loop principal:', err);
      if (onError) {
        onError(err);
      }
      showCrashScreen(err);
      if (typeof document === 'undefined') {
        throw err;
      }
    }
  }

  frameId = requestAnimationFrame(frame);

  return {
    stop() {
      isCrashed = true;
      if (frameId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(frameId);
      }
    }
  };
}
