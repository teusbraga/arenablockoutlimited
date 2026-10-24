/**
 * Gerador de Buffers de Ruído Estocásticos (Paul Kellet Pink, Brownian Motion e White Noise)
 * Pré-gera buffers uma única vez no AudioContext para zero-garbage-collection em runtime.
 */
export class NoiseBuffers {
  constructor(ctx) {
    this.ctx = ctx;
    this.white = null;
    this.pink = null;
    this.brown = null;
    this._init();
  }

  _init() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate || 44100;
    const duration = 4.0;
    const frameCount = Math.floor(sampleRate * duration);

    // 1. Ruído Branco (Uniforme)
    this.white = this.ctx.createBuffer(1, frameCount, sampleRate);
    const wData = this.white.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      wData[i] = Math.random() * 2 - 1;
    }

    // 2. Ruído Rosa (Algoritmo de Paul Kellet / 1/f)
    this.pink = this.ctx.createBuffer(1, frameCount, sampleRate);
    const pData = this.pink.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < frameCount; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    // 3. Ruído Marrom / Browniano (Integração de Wiener / Queda 6dB/oitava)
    this.brown = this.ctx.createBuffer(1, frameCount, sampleRate);
    const brData = this.brown.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < frameCount; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + (0.02 * white)) / 1.02;
      brData[i] = lastOut * 3.5;
    }
  }

  createSource(type = 'white', loop = true) {
    if (!this.ctx) return null;
    const buf = this[type] || this.white;
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    return src;
  }
}
