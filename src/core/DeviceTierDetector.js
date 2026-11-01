/**
 * DeviceTierDetector.js
 * Detecção e classificação de hardware para calibração automática de presets gráficos.
 * Avalia memória de dispositivo (RAM), concorrência de CPU (hardwareConcurrency) e capacidades de toque.
 */

export class DeviceTierDetector {
  /**
   * Avalia as especificações do ambiente e retorna o tier recomendado:
   * 'potato' | 'low' | 'medium' | 'high'
   *
   * @param {Object} [env] Ambiente opcional para injeção em testes headless
   * @returns {'potato'|'low'|'medium'|'high'}
   */
  static detect(env = null) {
    const nav = env?.navigator || (typeof navigator !== 'undefined' ? navigator : null);
    const win = env?.window || (typeof window !== 'undefined' ? window : null);

    if (!nav) return 'high';

    const isTouch = ('ontouchstart' in (win || {})) || (nav.maxTouchPoints > 0);
    const mem = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null;
    const cores = typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null;

    // Desktop tradicional (mouse/teclado)
    if (!isTouch) {
      if (mem !== null && mem <= 4) return 'medium';
      if (cores !== null && cores <= 4) return 'medium';
      return 'high';
    }

    // Dispositivos Móveis / Touch:
    // Potato: RAM <= 2GB ou núcleos <= 4 (aparelhos de entrada com baixa taxa de preenchimento)
    if ((mem !== null && mem <= 2) || (cores !== null && cores <= 4)) {
      return 'potato';
    }

    // Low: RAM <= 4GB ou núcleos <= 6 (aparelhos intermediários padrão)
    if ((mem !== null && mem <= 4) || (cores !== null && cores <= 6)) {
      return 'low';
    }

    // Medium: Aparelhos móveis topo de linha (iPhones Pro, Galaxy S, iPad Pro)
    return 'medium';
  }
}
