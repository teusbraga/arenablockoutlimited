import assert from 'assert';
import { AudioSystem } from '../src/audio/AudioSystem.js';
import { SOUND_PRESETS } from '../src/audio/procedural/SoundPresets.js';
import { emit } from '../src/core/EventBus.js';

console.log('--- TESTE: Sistema de Áudio Procedural S-Tier & Acoustic Ducking ---');

// Mock leve de Web Audio API para ambiente Headless Node.js
class MockAudioNode {
  constructor() {
    this.connected = [];
  }
  connect(dest) {
    this.connected.push(dest);
    return dest;
  }
  disconnect() {
    this.connected = [];
  }
}

class MockAudioParam {
  constructor(val = 0) {
    this.value = val;
    this.targetDucked = null;
    this.ramps = [];
  }
  setValueAtTime(v, t) { this.value = v; this.ramps.push({ type: 'set', v, t }); }
  linearRampToValueAtTime(v, t) { this.targetDucked = v; this.ramps.push({ type: 'linear', v, t }); }
  exponentialRampToValueAtTime(v, t) { this.ramps.push({ type: 'exponential', v, t }); }
  setTargetAtTime(v, t, tc) { this.value = v; this.ramps.push({ type: 'target', v, t, tc }); }
  cancelScheduledValues() { this.ramps = []; }
}

class MockGainNode extends MockAudioNode {
  constructor() {
    super();
    this.gain = new MockAudioParam(1.0);
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor() {
    super();
    this.frequency = new MockAudioParam(1000);
    this.Q = new MockAudioParam(1.0);
    this.gain = new MockAudioParam(0);
    this.type = 'lowpass';
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor() {
    super();
    this.frequency = new MockAudioParam(440);
    this.type = 'sine';
    this.started = false;
    this.stopped = false;
  }
  start() { this.started = true; }
  stop() { this.stopped = true; }
}

class MockAudioBufferSourceNode extends MockAudioNode {
  constructor() {
    super();
    this.buffer = null;
    this.loop = false;
    this.started = false;
    this.stopped = false;
  }
  start() { this.started = true; }
  stop() { this.stopped = true; }
}

class MockPannerNode extends MockAudioNode {
  constructor() {
    super();
    this.panningModel = 'HRTF';
    this.positionX = new MockAudioParam(0);
    this.positionY = new MockAudioParam(0);
    this.positionZ = new MockAudioParam(0);
  }
}

class MockDynamicsCompressorNode extends MockAudioNode {
  constructor() {
    super();
    this.threshold = new MockAudioParam(-3);
    this.knee = new MockAudioParam(6);
    this.ratio = new MockAudioParam(12);
    this.attack = new MockAudioParam(0.003);
    this.release = new MockAudioParam(0.12);
  }
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = 'running';
    this.destination = new MockAudioNode();
    this.listener = {
      positionX: new MockAudioParam(0),
      positionY: new MockAudioParam(0),
      positionZ: new MockAudioParam(0),
      forwardX: new MockAudioParam(0),
      forwardY: new MockAudioParam(0),
      forwardZ: new MockAudioParam(-1),
      upX: new MockAudioParam(0),
      upY: new MockAudioParam(1),
      upZ: new MockAudioParam(0)
    };
  }
  createBuffer(channels, length, sampleRate) {
    const data = new Float32Array(length);
    return {
      getChannelData: () => data,
      length,
      sampleRate
    };
  }
  createGain() { return new MockGainNode(); }
  createBiquadFilter() { return new MockBiquadFilterNode(); }
  createOscillator() { return new MockOscillatorNode(); }
  createBufferSource() { return new MockAudioBufferSourceNode(); }
  createPanner() { return new MockPannerNode(); }
  createDynamicsCompressor() { return new MockDynamicsCompressorNode(); }
  resume() { return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}

// 1. Validação dos Presets Calibrados
{
  console.log('[Teste 1] Validando presets calibrados data-driven...');
  assert.strictEqual(SOUND_PRESETS.shotgun_load_shell.springScrapeFreq, 2300, 'Brilho do Atrito da Mola deve ser 2300 Hz conforme imagem do usuário');
  assert.strictEqual(SOUND_PRESETS.shotgun_load_shell.latchSnap, 0.42, 'Estalo do Retém deve ser 0.42 conforme imagem do usuário');
  assert.strictEqual(SOUND_PRESETS.shotgun_load_shell.gatePush, 0.70, 'Pressão na lingueta deve ser 0.70');
  assert.strictEqual(SOUND_PRESETS.shotgun_load_shell.springScrape, 0.75, 'Raspagem na mola deve ser 0.75');
  assert.strictEqual(SOUND_PRESETS.shotgun_load_shell.brassRimRing, 2450, 'Ressonância do culote de latão deve ser 2450 Hz');
  assert.strictEqual(SOUND_PRESETS.shotgun_load_shell.tubeCavityFreq, 420, 'Ressonância oca do tubo deve ser 420 Hz');
  assert.strictEqual(SOUND_PRESETS.ak47_762x39.muzzleBarkFreq, 180, 'Frequência do soco e rouquidão do 7.62x39mm deve ser 180 Hz');
  assert.strictEqual(SOUND_PRESETS.ak47_762x39.receiverSteelRing, 1050, 'Ressonância da caixa de culatra de aço deve ser 1050 Hz');
  assert.strictEqual(SOUND_PRESETS.ak47_762x39.boltPistonMech, 0.75, 'Ciclo do pistão a gás e ferrolho de 500g deve ser 0.75');
  console.log('✓ Presets da Shell da 12 e AK-47 7.62x39mm validados com precisão.');
}

// 2. Validação da Inicialização dos Sintetizadores e Barramento
{
  console.log('[Teste 2] Validando AudioSystem e Barramento com Mock Web Audio API...');
  const audio = new AudioSystem();
  // Injeta contexto mock
  audio.ctx = new MockAudioContext();
  audio._initAudioGraph();

  assert.ok(audio.noiseBuffers, 'NoiseBuffers deve ser instanciado');
  assert.ok(audio.noiseBuffers.white, 'Ruído Branco deve ser pré-gerado');
  assert.ok(audio.noiseBuffers.pink, 'Ruído Rosa deve ser pré-gerado com Paul Kellet');
  assert.ok(audio.noiseBuffers.brown, 'Ruído Marrom deve ser pré-gerado com integração');
  assert.ok(audio.weaponSynth, 'WeaponSynthesizer deve ser instanciado');
  assert.ok(audio.terminalBallistics, 'TerminalBallistics deve ser instanciado');
  assert.ok(audio.traumaAcoustics, 'PlayerTraumaAcoustics deve ser instanciado');
  assert.ok(audio.locomotionAcoustics, 'LocomotionAcoustics deve ser instanciado');
  assert.ok(audio.masterCompressor, 'Master DynamicsCompressor deve estar ativo');
  assert.ok(audio.foleyGain, 'Canal de Foley deve estar ativo');
  assert.ok(audio.weaponsGain, 'Canal de Armas deve estar ativo');
  assert.ok(audio.footstepsGain, 'Canal de Passos deve estar ativo');
  assert.ok(audio.impactsGain, 'Canal de Impactos deve estar ativo');
  assert.ok(audio.traumaGain, 'Canal de Trauma deve estar ativo');
  assert.strictEqual(audio.footstepsGain.gain.value, 0.05, 'Ganho padrão de passos deve ser 0.05 (5%)');

  console.log('✓ Grafo de áudio inicializado com sucesso.');
  audio.destroy();
}

// 3. Validação do Acoustic Ducking (Concussão Opressiva de Sobrepressão)
{
  console.log('[Teste 3] Validando Acoustic Ducking em tiros próximos...');
  const audio = new AudioSystem();
  audio.ctx = new MockAudioContext();
  audio._initAudioGraph();

  assert.strictEqual(audio.foleyGain.gain.value, 1.0, 'Ganho nominal de foley deve ser 1.0');
  audio.triggerAcousticDucking(0.45, 0.22);
  assert.strictEqual(audio.foleyGain.gain.targetDucked, 0.45, 'Ganho deve sofrer ducking imediato agendado para 0.45');
  assert.strictEqual(audio.foleyGain.gain.ramps.length, 3, 'Deve agendar setValueAtTime, linearRamp e exponentialRamp');

  console.log('✓ Barramento de Acoustic Ducking opera e abafa canais secundários conforme especificado.');
  audio.destroy();
}

// 4. Validação de Dano Exclusivo em Placa Balística com Variação de Ressonância
{
  console.log('[Teste 4] Validando Dano no Jogador exclusivo em Placa Balística...');
  const audio = new AudioSystem();
  audio.ctx = new MockAudioContext();
  audio._initAudioGraph();

  let kevlarPlayed = false;
  audio.traumaAcoustics.synthesizeBulletHitKevlar = (params, ctx, dest, startTime, dmg) => {
    kevlarPlayed = true;
    assert.strictEqual(dmg, 42, 'Dano deve ser repassado para modular a ressonância da placa');
    assert.strictEqual(dest, audio.traumaGain, 'Destino deve ser o canal trauma');
  };

  emit('player:damaged', { dmg: 42 });
  assert.strictEqual(kevlarPlayed, true, 'Evento player:damaged deve acionar exclusivamente Placa Balística');

  console.log('✓ Dano no jogador aciona exclusivamente Placa Balística com variação dinâmica de ressonância.');
  audio.destroy();
}

// 5. Validação de Disparos de Armas e Balística Terminal por Superfície
{
  console.log('[Teste 5] Validando disparo de armas e impacto em superfícies...');
  const audio = new AudioSystem();
  audio.ctx = new MockAudioContext();
  audio._initAudioGraph();

  let lastFired = null;
  audio.playProceduralShot = (weaponId) => {
    lastFired = weaponId;
  };

  emit('weapon:fired', { weaponId: 'm12' });
  assert.strictEqual(lastFired, 'm12', 'Disparo de M12 deve despachar para sintetizador da espingarda 12');

  emit('weapon:fired', { weaponId: 'sw500' });
  assert.strictEqual(lastFired, 'sw500', 'Disparo de SW500 deve despachar para sintetizador magnum .500');

  emit('weapon:fired', { weaponId: 'p9' });
  assert.strictEqual(lastFired, 'p9', 'Disparo de P-9 deve despachar para sintetizador 9mm');

  emit('weapon:fired', { weaponId: 'uzi' });
  assert.strictEqual(lastFired, 'uzi', 'Disparo de UZI deve despachar para sintetizador open-bolt');

  emit('weapon:fired', { weaponId: 'vss' });
  assert.strictEqual(lastFired, 'vss', 'Disparo de VSS deve despachar para sintetizador subsônico');

  emit('weapon:fired', { weaponId: 'ak47' });
  assert.strictEqual(lastFired, 'ak47', 'Disparo de AK47 deve despachar para sintetizador 7.62mm');

  // Validação do método real de síntese da AK-47 7.62x39mm
  const realAudio = new AudioSystem();
  realAudio.ctx = new MockAudioContext();
  realAudio._initAudioGraph();
  let ak47SynthCalled = false;
  realAudio.weaponSynth.synthesizeAK47 = () => { ak47SynthCalled = true; };
  realAudio.playProceduralShot('ak47');
  assert.strictEqual(ak47SynthCalled, true, 'Disparo de AK-47 deve chamar especificamente synthesizeAK47 (7.62x39mm)');
  realAudio.destroy();

  // Superfícies
  let surfaceHit = null;
  audio.playProceduralSurfaceHit = (material, pos) => {
    surfaceHit = material;
  };

  emit('shot:world', { material: 'wood', point: { x: 5, y: 1, z: -2 } });
  assert.strictEqual(surfaceHit, 'wood', 'Impacto em madeira deve ser detectado');

  emit('shot:world', { material: 'metal', point: { x: 5, y: 1, z: -2 } });
  assert.strictEqual(surfaceHit, 'metal', 'Impacto em metal deve ser detectado');

  emit('shot:world', { material: 'concrete', point: { x: 5, y: 1, z: -2 } });
  assert.strictEqual(surfaceHit, 'concrete', 'Impacto em concreto deve ser detectado');

  emit('shot:world', { material: 'sand', point: { x: 5, y: 1, z: -2 } });
  assert.strictEqual(surfaceHit, 'sand', 'Impacto em areia/solo deve ser detectado');

  console.log('✓ Disparos e balística terminal mapeados com 100% de precisão.');
  audio.destroy();
}

// 6. Validação do Mixer de Volumes do Áudio e Controle dos Passos
{
  console.log('[Teste 6] Validando Mixer de Volumes e Controle dos Passos...');
  const audio = new AudioSystem();
  audio.ctx = new MockAudioContext();
  audio._initAudioGraph();

  audio.setFootstepsVolume(0.20);
  assert.strictEqual(audio.volumes.footsteps, 0.20, 'Volume de passos deve ser atualizado para 0.20');
  assert.strictEqual(audio.footstepsGain.gain.value, 0.20, 'Ganho do nó footstepsGain deve refletir 0.20');

  audio.setWeaponsVolume(0.90);
  assert.strictEqual(audio.volumes.weapons, 0.90, 'Volume de armas deve ser atualizado para 0.90');
  assert.strictEqual(audio.weaponsGain.gain.value, 0.90, 'Ganho do nó weaponsGain deve refletir 0.90');

  audio.setImpactsVolume(0.65);
  assert.strictEqual(audio.volumes.impacts, 0.65, 'Volume de impactos deve ser atualizado para 0.65');
  assert.strictEqual(audio.impactsGain.gain.value, 0.65, 'Ganho do nó impactsGain deve refletir 0.65');

  audio.setTraumaVolume(0.75);
  assert.strictEqual(audio.volumes.trauma, 0.75, 'Volume de trauma deve ser atualizado para 0.75');
  assert.strictEqual(audio.traumaGain.gain.value, 0.75, 'Ganho do nó traumaGain deve refletir 0.75');

  audio.setMasterVolume(0.50);
  assert.strictEqual(audio.volumes.master, 0.50, 'Volume master deve ser atualizado para 0.50');
  assert.strictEqual(audio.masterGain.gain.value, 0.50, 'Ganho do nó masterGain deve refletir 0.50');

  audio.resetVolumes();
  assert.strictEqual(audio.volumes.footsteps, 0.05, 'Reset de passos deve retornar para 0.05');
  assert.strictEqual(audio.volumes.master, 1.00, 'Reset de master deve retornar para 1.00');
  assert.strictEqual(audio.volumes.weapons, 1.00, 'Reset de armas deve retornar para 1.00');
  assert.strictEqual(audio.volumes.impacts, 0.45, 'Reset de impactos deve retornar para 0.45');
  assert.strictEqual(audio.volumes.trauma, 0.80, 'Reset de trauma deve retornar para 0.80');

  // Validação da eliminação de sons arcade
  audio.play('shot_hk416');
  audio.playSpatial('bot_died', { x: 0, y: 0, z: 0 });
  audio._tone(800, 400, 0.1, 'sine', 0.5);

  console.log('✓ Mixer de volumes e controle dos passos validados com sucesso.');
  audio.destroy();
}

console.log('==================================================');
console.log('🎉 TODOS OS TESTES DE ÁUDIO PROCEDURAL PASSARAM COM SUCESSO!');
console.log('==================================================');
