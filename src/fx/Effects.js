import * as THREE from 'three';
import { on } from '../core/EventBus.js';
import { SMOKE_TEX } from '../weapons/models/RiflePrototype.js';
import { WEAPONS } from '../weapons/WeaponDefs.js';

const MAX_TRACERS = 120;
const MAX_SPARKS = 80;
const MAX_SMOKE = 40;
const MAX_CASINGS = 24;
const MAX_BLOOD_VOXELS = 80;
const MAX_GHOST_SMOKE = 60;

const _dummy = new THREE.Object3D();
const _tempColor = new THREE.Color();
const _bloodPalette = [
  0xd90429, // Carmine red
  0xef233c, // Vivid arcade crimson
  0xa4161a, // Dark arterial red
  0x800f2f, // Deep blood ruby
  0xba181b, // Punchy red
  0xff4d6d  // Bright arcade splash
];
const _ghostPalette = [
  0xffffff, // Pure white
  0xf5f7fa, // Soft white cloud
  0xe4e7eb, // Light puff
  0xd0d5dd, // Ghost grey
  0x9aa4b2  // Cartoon shadow grey
];

const _tracerUp = new THREE.Vector3(0, 1, 0);
const _tracerDir = new THREE.Vector3();
const _tempHead = new THREE.Vector3();
const _tempTail = new THREE.Vector3();
const _tempV = new THREE.Vector3();

export const DEFAULT_SWIPE_PROFILE = {
  style: 'swipe',     // Padrão CS2 FlashTracer instantâneo
  ttl: 0.055,         // Tempo de vida total em segundos (~3-4 frames a 60fps)
  headSpeed: 0.35,    // % do ttl para a cabeça atingir o alvo (ex: ~19ms)
  streakLength: 0.45, // 'swipe': atraso relativo da cauda | 'streak': comprimento fixo (15-45%)
  fadeInEnd: 0.10,    // % do ttl para fade-in suave sem pop-in seco
  fadeOutStart: 0.65, // % do ttl onde começa o fade out
  width: 1.0,         // Multiplicador de espessura (1.0 = padrão do cylinderGeo)
  color: 0xffd27f,    // Cor padrão
  maxOpacity: 0.95,   // Opacidade máxima

  // Propriedades Core + Glow
  coreRadius: 0.007,
  glowRadius: 0.038,
  coreBrightness: 1.0,
  glowBrightness: 0.85,
  coreColor: 0xffffff,
  glowColor: 0xffd27f,
  exposureTime: 0.026,
  persistenceTime: 0.045,
  trackOrigin: false
};

export const DEFAULT_PHOTOGRAPHIC_PROFILE = {
  style: 'photographic',
  exposureTime: 0.026,    // Janela temporal do obturador/retina (s) -> Comprimento L = speed * exposureTime
  persistenceTime: 0.045, // Persistência retinal / tempo de dissipação pós-impacto (s)
  coreRadius: 0.007,      // Raio do filamento incandescente central (m)
  coreBrightness: 1.0,    // Intensidade do filamento (branco incandescente)
  coreColor: 0xffffff,    // Cor do filamento (plasma / alta temperatura)
  glowRadius: 0.038,      // Raio do halo difuso / dispersão atmosférica e retinal (m)
  glowBrightness: 0.45,   // Intensidade do halo colorido
  glowColor: 0xffd27f,    // Cor espectral da queima do traçante
  falloffGamma: 1.6,      // Curvatura do degradê de resfriamento ao longo da cauda
  trackOrigin: true,      // Sincroniza frame-a-frame com o bocal da arma
  width: 1.0,
  ttl: 0.055,
  headSpeed: 0.35,
  streakLength: 0.45,
  fadeInEnd: 0.10,
  fadeOutStart: 0.65,
  maxOpacity: 0.95
};

export const DEFAULT_TRACER_PROFILE = DEFAULT_SWIPE_PROFILE;

export class Effects {
  constructor(scene, world = null) {
    this.scene = scene;
    this.world = world;

    // Constantes
    this.TRACER_LIFE = 0.15;
    
    // Geometrias reutilizáveis
    this.sparkGeo = new THREE.SphereGeometry(0.02, 4, 4);
    // Cartucho 3D cilíndrico de latão (escala 1:1 estojo de munição)
    this.casingGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.026, 8);
    this.casingMat = new THREE.MeshStandardMaterial({
      color: 0xdfb850,
      metalness: 0.90,
      roughness: 0.28
    });
    // Cartucho de escopeta Calibre 12 Vermelho com base em latão
    this.shotgunCasingGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.038, 10);
    this.shotgunCasingMat = new THREE.MeshStandardMaterial({
      color: 0xd61818, // Vermelho vívido de cartucho calibre 12
      metalness: 0.20,
      roughness: 0.45
    });

    // Pools
    this.tracers = [];
    this.tracerIdx = 0;

    this.sparks = [];
    this.sparkIdx = 0;

    this.smokes = [];
    this.smokeIdx = 0;

    this.casings = [];
    this.casingIdx = 0;

    this._initPools();
    this._bind();
  }

  _sanitizeProfile(rawProfile, fallbackColor) {
    if (!rawProfile) rawProfile = {};
    const base = rawProfile.style === 'photographic' ? DEFAULT_PHOTOGRAPHIC_PROFILE : DEFAULT_SWIPE_PROFILE;
    const p = Object.assign({}, base, rawProfile);

    if (fallbackColor && !rawProfile?.color && !rawProfile?.glowColor) {
      p.glowColor = fallbackColor;
      p.color = fallbackColor;
    } else if (rawProfile?.color) {
      p.glowColor = rawProfile.color;
      p.color = rawProfile.color;
    }

    // Invariantes de estilo e TTL
    p.style = p.style || 'swipe';
    p.ttl = Math.max(0.01, p.ttl ?? 0.055);
    p.headSpeed = Math.max(0.01, Math.min(p.headSpeed ?? 0.35, 1.0));
    p.streakLength = Math.max(0, Math.min(p.streakLength ?? 0.45, 0.99));
    p.fadeInEnd = Math.max(0, Math.min(p.fadeInEnd ?? 0.10, 0.95));
    p.fadeOutStart = Math.max(p.fadeInEnd + 0.01, Math.min(p.fadeOutStart ?? 0.65, 1.0));
    p.maxOpacity = Math.max(0.01, Math.min(p.maxOpacity ?? 0.95, 1.0));

    // Invariantes matemáticas e limites seguros
    p.exposureTime = Math.max(0.005, Math.min(p.exposureTime ?? 0.026, 0.2));
    p.persistenceTime = Math.max(0.005, Math.min(p.persistenceTime ?? 0.045, 0.2));
    p.coreRadius = Math.max(0.001, p.coreRadius ?? 0.007);
    p.coreBrightness = Math.max(0.01, Math.min(p.coreBrightness ?? 1.0, 2.5));
    p.glowRadius = Math.max(0.005, p.glowRadius ?? 0.038);
    p.glowBrightness = Math.max(0.01, Math.min(p.glowBrightness ?? 0.85, 2.0));
    p.width = Math.max(0.05, p.width ?? 1.0);
    p.trackOrigin = p.trackOrigin === true;
    if (rawProfile?.beamLength !== undefined) {
      p.beamLength = Math.max(0.5, Math.min(rawProfile.beamLength, 50.0));
      p.realSpeed = true;
    }
    if (rawProfile?.realSpeed !== undefined) {
      p.realSpeed = rawProfile.realSpeed === true;
    }

    return p;
  }

  _spawnFlashTracer(e) {
    const t = this.tracers[this.tracerIdx];
    this.tracerIdx = (this.tracerIdx + 1) % MAX_TRACERS;

    t.active = true;
    t.mode = 'flash';
    t.life = 0;
    t.proj = null;
    t.isDummy = false;
    t.origin.copy(e.origin);
    t.originInitial.copy(e.origin);
    t.end.copy(e.end);

    t.speed = e.speed || 700;
    t.distanceToTarget = Math.max(0.1, t.origin.distanceTo(t.end));
    t.dir.subVectors(t.end, t.origin).normalize();

    t.profile = this._sanitizeProfile(e.profile, e.color);
    if (e.isPellet) {
      t.profile.coreRadius = Math.max(0.005, t.profile.coreRadius * 0.9);
      t.profile.glowRadius = Math.max(0.022, t.profile.glowRadius * 0.9);
      t.profile.width = Math.max(0.85, t.profile.width * 0.9);
    }

    t.originTracker = (e.originTracker && t.profile.trackOrigin) ? e.originTracker : null;

    if (t.profile.style === 'laser') {
      if (t.profile.beamLength || t.profile.realSpeed) {
        const beamLen = t.profile.beamLength || 6.0;
        const spd = t.speed || 850;
        const flightTime = (t.distanceToTarget + beamLen) / spd;
        t.ttl = flightTime + (t.profile.persistenceTime || 0.02);
      } else {
        t.ttl = t.profile.ttl || (t.profile.exposureTime || 0.04) + (t.profile.persistenceTime || 0.02);
      }
    } else if (t.profile.style === 'swipe' || t.profile.style === 'streak') {
      t.ttl = t.profile.ttl || 0.055;
    } else {
      const impactTime = t.distanceToTarget / t.speed;
      const photographicDuration = impactTime + t.profile.exposureTime + t.profile.persistenceTime;
      t.ttl = e.profile?.ttl ? Math.min(e.profile.ttl, photographicDuration * 1.5) : photographicDuration;
    }

    // Inicializa Ring Buffer N=8
    t.sampleCount = 1;
    t.sampleHead = 0;
    t.samples[0].pos.copy(t.origin);
    t.samples[0].time = 0;

    // Aplica cores do profile
    t.coreMat.color.set(t.profile.coreColor || 0xffffff);
    t.glowMat.color.set(t.profile.glowColor || t.profile.color || 0xffd27f);
    t.coreMat.opacity = 0.01;
    t.glowMat.opacity = 0.01;

    t.group.visible = true;
  }

  _spawnTracer(p) {
    const t = this.tracers[this.tracerIdx];
    this.tracerIdx = (this.tracerIdx + 1) % MAX_TRACERS;
    t.active = true;
    t.mode = 'phys';
    t.life = 0;
    t.proj = p;
    t.isDummy = p.isDummy;
    if (t.isDummy) {
       t.dummyPos = p.startPos.clone();
       t.dummyDistance = 0;
    }
    t.coreMat.color.set(0xffffff);
    t.glowMat.color.set(p.color || 0xffd27f);
    t.group.visible = true;
  }

  _initPools() {
    // 1. Tracers Fotográficos Volumétricos (Concentric Core + Glow Envelope com PSF e Ring Buffer N=8)
    this.tracerGeo = new THREE.CylinderGeometry(0.05, 0.006, 1.0, 6, 1, true);
    const vertCount = this.tracerGeo.attributes.position.count;
    const colors = new Float32Array(vertCount * 3);
    const posArr = this.tracerGeo.attributes.position.array;
    for (let j = 0; j < vertCount; j++) {
      const y = posArr[j * 3 + 1]; // -0.5 na cauda, +0.5 na cabeça
      const t = Math.max(0.0, Math.min(1.0, y + 0.5));
      const intensity = Math.pow(Math.max(0.04, t), 1.4);
      colors[j * 3] = intensity;
      colors[j * 3 + 1] = intensity;
      colors[j * 3 + 2] = intensity;
    }
    this.tracerGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    for (let i = 0; i < MAX_TRACERS; i++) {
      const group = new THREE.Group();

      // Layer 0: Filamento Central Incandescente (Core - Alta Temperatura/Branco)
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const coreMesh = new THREE.Mesh(this.tracerGeo, coreMat);
      group.add(coreMesh);

      // Layer 1: Halo Difuso / PSF Retinal (Glow - Cor Espectral Saturada)
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffd27f,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const glowMesh = new THREE.Mesh(this.tracerGeo, glowMat);
      group.add(glowMesh);

      group.visible = false;
      this.scene.add(group);

      // Ring Buffer pré-alocado de 8 amostras de histórico temporal
      const samples = Array.from({ length: 8 }, () => ({
        pos: new THREE.Vector3(),
        time: 0
      }));

      this.tracers.push({
        group,
        mesh: glowMesh, // compatibilidade para testes que leem tracer.mesh.scale
        coreMesh,
        glowMesh,
        coreMat,
        glowMat,
        mat: glowMat,   // compatibilidade
        samples,
        sampleHead: 0,
        sampleCount: 0,
        life: 0,
        active: false,
        mode: 'flash',
        origin: new THREE.Vector3(),
        originInitial: new THREE.Vector3(),
        end: new THREE.Vector3(),
        dir: new THREE.Vector3(),
        speed: 700,
        distanceToTarget: 0,
        profile: null,
        originTracker: null,
        ttl: 0.055,
        proj: null,
        isDummy: false
      });
    }

    // 2. Sparks (Faíscas / Sangue / Impacto)
    for (let i = 0; i < MAX_SPARKS; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(this.sparkGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.sparks.push({ mesh, vel: new THREE.Vector3(), life: 0, maxLife: 0.35, active: false });
    }

    // 3. Smokes (Fumaça do tiro)
    for (let i = 0; i < MAX_SMOKE; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xb8bcc2, transparent: true, opacity: 0.6, depthWrite: false });
      const mesh = new THREE.Mesh(this.sparkGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.smokes.push({ mesh, vel: new THREE.Vector3(), life: 0, maxLife: 0.7, startScale: 1, growth: 1, active: false });
    }

    // 4. Faíscas da boca do cano (THREE.Points do protótipo)
    this.SPARK_MAX = 90;
    this.sparkPos = new Float32Array(this.SPARK_MAX * 3);
    this.sparkVel = new Float32Array(this.SPARK_MAX * 3);
    this.sparkLife = new Float32Array(this.SPARK_MAX);
    for (let i = 0; i < this.SPARK_MAX; i++) this.sparkPos[i * 3 + 1] = -999;

    this.sparkPointsGeo = new THREE.BufferGeometry();
    this.sparkPointsGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
    this.sparkPointsMat = new THREE.PointsMaterial({
      color: 0xffc061,
      size: 0.017,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    this.sparkPoints = new THREE.Points(this.sparkPointsGeo, this.sparkPointsMat);
    this.sparkPoints.frustumCulled = false;
    this.scene.add(this.sparkPoints);

    // 5. Fumaça de tiro com textura procedural radial do protótipo
    this.protoSmokePool = [];
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: SMOKE_TEX,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        color: 0x9aa2ad
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), mat);
      m.visible = false;
      m.renderOrder = 2;
      this.scene.add(m);
      this.protoSmokePool.push({ mesh: m, life: 0, max: 1, vel: new THREE.Vector3(), spin: 0 });
    }

    // 6. Cartuchos vazios ejetados (Brass Casings com física e rotação)
    for (let i = 0; i < MAX_CASINGS; i++) {
      const mesh = new THREE.Mesh(this.casingGeo, this.casingMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.casings.push({
        mesh,
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        life: 0,
        maxLife: 1.2,
        active: false
      });
    }

    // 7. Explosão de Sangue 2D Flipbook "Zoada" + Adesivo de Poça 2D (Zero Física / Zero Lag)
    this.blood2DGeo = new THREE.PlaneGeometry(1, 1);
    this.bloodPuddleGeo = new THREE.PlaneGeometry(1.25, 1.25);
    this.bloodPuddleGeo.rotateX(-Math.PI / 2);

    this.bloodFlipMats = [0, 1, 2, 3].map(frame => this._createBloodFlipbookMat(frame));
    this.bloodPuddleMat = this._createBloodPuddleMat();

    this.bloodVoxels = [];
    this.bloodIdx = 0;
    const MAX_BLOOD_2D = 8;
    for (let i = 0; i < MAX_BLOOD_2D; i++) {
      const burstMesh = new THREE.Mesh(this.blood2DGeo, this.bloodFlipMats[i % 4]);
      burstMesh.position.set(0, -999, 0);
      burstMesh.scale.setScalar(0.001);
      burstMesh.frustumCulled = false;
      this.scene.add(burstMesh);

      const puddleMesh = new THREE.Mesh(this.bloodPuddleGeo, this.bloodPuddleMat);
      puddleMesh.position.set(0, -999, 0);
      puddleMesh.scale.setScalar(0.001);
      puddleMesh.frustumCulled = false;
      this.scene.add(puddleMesh);

      this.bloodVoxels.push({
        active: false,
        burstMesh,
        puddleMesh,
        life: 0,
        maxLife: 2.2,
        burstDuration: 0.28,
        baseScale: 1.8,
        puddleScale: 1.0,
        rotZ: 0
      });
    }

    // 8. Fumaça de Fantasma (Explosão poof cartoon cinza/branca)
    this.ghostSmokeGeo = new THREE.SphereGeometry(0.18, 7, 7);
    this.ghostSmokePool = [];
    this.ghostSmokeIdx = 0;
    for (let i = 0; i < MAX_GHOST_SMOKE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(this.ghostSmokeGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.ghostSmokePool.push({
        mesh,
        active: false,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1.0,
        startScale: 0.5,
        growth: 3.0
      });
    }
  }
  setWorld(world) {
    this.world = world;
  }

  setGameManager(gm) {
    this.gameManager = gm;
  }

  _bind() {
    this._unsubs = [
      on('tracer:fire', e => this._spawnFlashTracer(e)),
      on('projectile:spawned', e => {
        // Projéteis com física (lentos ou estilo parabola) usam tracer físico acoplado
        const tp = e.projectile?.tracerProfile || e.projectile?.weaponDef?.tracerProfile;
        if (e.projectile && (e.projectile.speed < 200 || tp?.style === 'parabola' || tp?.physical)) {
          this._spawnTracer(e.projectile);
        }
      }),
      on('shot:tracer', e => {
        // Disparo de bots: herda fielmente o tracerProfile e cor da arma/munição em uso
        const wep = e.weaponId ? WEAPONS[e.weaponId] : null;
        this._spawnFlashTracer({
          origin: e.from,
          end: e.to,
          color: e.color || wep?.tracerColor || 0xffd27f,
          profile: e.profile || wep?.tracerProfile || DEFAULT_TRACER_PROFILE,
          speed: e.speed || wep?.ballistics?.terminal?.bulletSpeed || 700
        });
      }),
        on('shot:world', e => this._spawnImpact(e.point, 0xd9c79b, 5)),
      on('shot:ricochet', e => {
        if (e?.point) {
          this._spawnImpact(e.point, 0xffe680, 8); // Faíscas brilhantes de ricochete
        }
      }),
      on('shot:penetration', e => {
        if (e?.entryPoint) {
          const col = e.material?.includes('wood') ? 0x8b5a2b : 0xcccccc;
          this._spawnImpact(e.entryPoint, col, 4); // Lascas/poeira na entrada
        }
        if (e?.exitPoint) {
          const col = e.material?.includes('wood') ? 0xb58950 : 0xe0e0e0;
          this._spawnImpact(e.exitPoint, col, 6);  // Estilhaços na saída
        }
      }),
      on('shot:bot', e => this._spawnImpact(e.point, e.headshot ? 0xffd166 : 0xc4504a, 6)),
      on('bot:died', e => {
        if (!e?.bot) return;
        const pos = e.bot.pos;
        const isGhost = e.bot.skinType === 'ghost';
        const isHeadshot = !!e.headshot;

        if (isGhost) {
          this._spawnGhostDeathSmoke(pos, isHeadshot);
        } else {
          this._spawnSoldierBloodVoxels(pos, isHeadshot);
        }
      }),
      on('weapon:fired', e => {
        // Ejeção do cartucho vazio em todas as armas (Ignora m12 que tem ejeção manual)
        if (e.ejectWorld && e.right && e.up && e.weapon?.id !== 'm12') {
          const isShotgun = (e.weapon?.casingType === 'shotgun' || e.weapon?.id === 'm12');
          this._spawnCasing(e.ejectWorld, e.right, e.up, e.forward, isShotgun);
        }

        if (!e.muzzleWorld) return;
        if (e.weapon?.id === 'rifle_proto') {
          this._spawnProtoSparks(e.muzzleWorld, e.forward, 9);
        }
        const opacity = e.weapon?.smokeConeOpacity ?? 0.28;
        const scaleMul = e.weapon?.smokeConeScale ?? 1.2;
        this._spawnMuzzleSmoke(e.muzzleWorld, e.forward, opacity, scaleMul);
      }),
      on('weapon:manual_eject_fx', e => {
        if (e.ejectWorld && e.right && e.up) {
          this._spawnCasing(e.ejectWorld, e.right, e.up, e.forward, e.isShotgun);
        }
      }),
      on('weapon:smoke:residual', e => {
        if (!e.muzzleWorld || !e.count) return;
        this._spawnBarrelHeatSmoke(e.muzzleWorld, e.count, e.color);
      }),
    ];
  }

  destroy() {
    if (this._unsubs) {
      for (const unsub of this._unsubs) unsub();
      this._unsubs = [];
    }

    // Libera geometrias base
    if (this.sparkGeo) this.sparkGeo.dispose();
    if (this.casingGeo) this.casingGeo.dispose();
    if (this.shotgunCasingGeo) this.shotgunCasingGeo.dispose();
    if (this.casingMat) this.casingMat.dispose();
    if (this.shotgunCasingMat) this.shotgunCasingMat.dispose();

    // Libera tracers
    if (this.tracerGeo) this.tracerGeo.dispose();
    if (this.beamGeo) this.beamGeo.dispose();
    for (const t of this.tracers) {
      if (t.group) {
        if (t.group.parent) t.group.parent.remove(t.group);
      } else if (t.mesh && t.mesh.parent) {
        t.mesh.parent.remove(t.mesh);
      }
      if (t.coreMat) t.coreMat.dispose();
      if (t.glowMat) t.glowMat.dispose();
      t.originTracker = null;
    }
    this.tracers = [];

    // Libera sparks
    for (const s of this.sparks) {
      if (s.mesh) {
        if (s.mesh.parent) s.mesh.parent.remove(s.mesh);
        s.mesh.material.dispose();
      }
    }
    this.sparks = [];

    // Libera smokes
    for (const sm of this.smokes) {
      if (sm.mesh) {
        if (sm.mesh.parent) sm.mesh.parent.remove(sm.mesh);
        sm.mesh.material.dispose();
      }
    }
    this.smokes = [];

    // Libera casings
    for (const c of this.casings) {
      if (c.mesh && c.mesh.parent) c.mesh.parent.remove(c.mesh);
    }
    this.casings = [];

    // Libera proto sparks e smoke
    if (this.sparkPoints) {
      if (this.sparkPoints.parent) this.sparkPoints.parent.remove(this.sparkPoints);
      this.sparkPointsGeo.dispose();
      this.sparkPointsMat.dispose();
    }
    for (const ps of this.protoSmokePool) {
      if (ps.mesh) {
        if (ps.mesh.parent) ps.mesh.parent.remove(ps.mesh);
        ps.mesh.geometry.dispose();
        ps.mesh.material.dispose();
      }
    }
    this.protoSmokePool = [];

    // Libera blood 2D flipbook
    for (const b of this.bloodVoxels) {
      if (b.burstMesh?.parent) b.burstMesh.parent.remove(b.burstMesh);
      if (b.puddleMesh?.parent) b.puddleMesh.parent.remove(b.puddleMesh);
    }
    if (this.blood2DGeo) this.blood2DGeo.dispose();
    if (this.bloodPuddleGeo) this.bloodPuddleGeo.dispose();
    if (this.bloodFlipMats) {
      for (const m of this.bloodFlipMats) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    }
    if (this.bloodPuddleMat) {
      if (this.bloodPuddleMat.map) this.bloodPuddleMat.map.dispose();
      this.bloodPuddleMat.dispose();
    }
    this.bloodVoxels = [];

    // Libera ghost smoke
    for (const g of this.ghostSmokePool) {
      if (g.mesh) {
        if (g.mesh.parent) g.mesh.parent.remove(g.mesh);
        g.mesh.material.dispose();
      }
    }
    if (this.ghostSmokeGeo) this.ghostSmokeGeo.dispose();
    this.ghostSmokePool = [];
  }

  _spawnProtoSparks(pos, dir, count = 9) {
    for (let n = 0; n < count; n++) {
      let idx = -1;
      for (let j = 0; j < this.SPARK_MAX; j++) {
        if (this.sparkLife[j] <= 0) { idx = j; break; }
      }
      if (idx < 0) return;

      this.sparkLife[idx] = 0.14 + Math.random() * 0.24;
      this.sparkPos[idx * 3 + 0] = pos.x;
      this.sparkPos[idx * 3 + 1] = pos.y;
      this.sparkPos[idx * 3 + 2] = pos.z;

      const spread = 0.95;
      const sp = 2.0 + Math.random() * 3.0;
      this.sparkVel[idx * 3 + 0] = (dir.x + (Math.random() - 0.5) * spread) * sp;
      this.sparkVel[idx * 3 + 1] = (dir.y + (Math.random() - 0.5) * spread) * sp + 0.5;
      this.sparkVel[idx * 3 + 2] = (dir.z + (Math.random() - 0.5) * spread) * sp;
    }
    this.sparkPointsGeo.attributes.position.needsUpdate = true;
  }

  _spawnProtoSmoke(pos, dir, count = 2) {
    for (let n = 0; n < count; n++) {
      const s = this.protoSmokePool.find(x => x.life <= 0);
      if (!s) return;
      s.max = 0.75 + Math.random() * 0.6;
      s.life = s.max;
      s.mesh.visible = true;
      s.mesh.position.copy(pos);
      s.mesh.position.x += (Math.random() - 0.5) * 0.04;
      s.mesh.position.y += (Math.random() - 0.5) * 0.04;
      s.mesh.position.z += (Math.random() - 0.5) * 0.04;
      s.mesh.rotation.z = Math.random() * Math.PI;
      s.spin = (Math.random() - 0.5) * 1.4;
      s.vel.set(
        dir.x * (0.25 + Math.random() * 0.45) + (Math.random() - 0.5) * 0.20,
        0.16 + Math.random() * 0.22,
        dir.z * (0.25 + Math.random() * 0.45) + (Math.random() - 0.5) * 0.20
      );
      s.mesh.scale.setScalar(0.55 + Math.random() * 0.4);
    }
  }

  _spawnCasing(pos, right, up, forward, isShotgun = false) {
    if (!pos || !right) return;
    const c = this.casings[this.casingIdx];
    this.casingIdx = (this.casingIdx + 1) % MAX_CASINGS;

    c.mesh.geometry = isShotgun ? this.shotgunCasingGeo : this.casingGeo;
    c.mesh.material = isShotgun ? this.shotgunCasingMat : this.casingMat;
    c.mesh.position.copy(pos);
    c.mesh.visible = true;
    c.active = true;
    c.life = c.maxLife;

    // Orientação inicial aleatória
    c.mesh.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );

    // Vetor de velocidade física:
    // Ejetado com força para a direita (+right), ligeiramente para cima (+up) e para trás (-forward)
    const rightForce = 1.6 + Math.random() * 0.9;
    const upForce    = 1.1 + Math.random() * 0.7;
    const backForce  = -0.4 - Math.random() * 0.5;

    c.vel.set(0, 0, 0)
      .addScaledVector(right, rightForce)
      .addScaledVector(up, upForce)
      .addScaledVector(forward, backForce);

    // Velocidade angular de rotação rápida no ar (tumble)
    c.rotVel.set(
      (Math.random() - 0.5) * 28,
      (Math.random() - 0.5) * 24,
      (Math.random() - 0.5) * 28
    );
  }

  _spawnImpact(pos, color, count) {
    for (let i = 0; i < count; i++) {
      const p = this.sparks[this.sparkIdx];
      this.sparkIdx = (this.sparkIdx + 1) % MAX_SPARKS;

      p.mesh.position.copy(pos);
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      p.mesh.visible = true;
      p.vel.set((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3);
      p.life = p.maxLife;
      p.active = true;
    }
  }

  // 1. Cone de fumaça frontal durante o disparo (proporcional ao flash e cano da arma)
  _spawnMuzzleSmoke(muzzlePos, forward, maxOpacity = 0.28, scaleMul = 1.0) {
    const count = Math.max(3, Math.min(6, Math.round(3 * scaleMul)));
    for (let i = 0; i < count; i++) {
      const p = this.smokes[this.smokeIdx];
      this.smokeIdx = (this.smokeIdx + 1) % MAX_SMOKE;

      p.mesh.position.copy(muzzlePos);
      p.startScale = (0.7 + Math.random() * 0.5) * scaleMul;
      p.mesh.scale.setScalar(p.startScale);
      p.maxOpacity = maxOpacity;
      p.mesh.material.opacity = maxOpacity;
      p.mesh.visible = true;
      
      // Projeção em cone para frente com leve abertura proporcional ao calibre/cano
      const spread = 0.35 * Math.min(1.4, scaleMul);
      p.vel.copy(forward).multiplyScalar((2.4 + Math.random() * 1.6) * Math.min(1.3, scaleMul)).add(new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread + 0.08,
        (Math.random() - 0.5) * spread
      ));
      
      p.growth = 2.4 + Math.random() * 1.2;
      p.maxLife = 0.38 + Math.random() * 0.20; // Duração equilibrada para formar o cone sem poluir
      p.life = p.maxLife;
      p.active = true;
    }
  }

  // 2. Fumaça de calor residual do cano quente ao término de spray (flutua suavemente para cima)
  _spawnBarrelHeatSmoke(muzzlePos, count = 3, color = null) {
    const total = Math.min(count, 6);
    for (let i = 0; i < total; i++) {
      const p = this.smokes[this.smokeIdx];
      this.smokeIdx = (this.smokeIdx + 1) % MAX_SMOKE;

      // Leve atraso e deslocamento natural ao redor da boca do cano
      const jitter = 0.015;
      p.mesh.position.set(
        muzzlePos.x + (Math.random() - 0.5) * jitter,
        muzzlePos.y + (Math.random() - 0.5) * jitter,
        muzzlePos.z + (Math.random() - 0.5) * jitter
      );

      if (color) p.mesh.material.color.set(color);

      p.startScale = 0.4 + Math.random() * 0.3;
      p.mesh.scale.setScalar(p.startScale);
      p.maxOpacity = 0.18 + Math.random() * 0.10; // translúcida, perceptível e graciosa
      p.mesh.material.opacity = p.maxOpacity;
      p.mesh.visible = true;

      // Flutuação ascendente (corrente térmica de ar quente)
      p.vel.set(
        (Math.random() - 0.5) * 0.15,
        0.35 + Math.random() * 0.30, // sobe em Y
        (Math.random() - 0.5) * 0.15
      );

      p.growth = 3.0 + Math.random() * 1.5;
      p.maxLife = 0.70 + Math.random() * 0.40; // persiste suavemente
      p.life = p.maxLife;
      p.active = true;
    }
  }

  _getFloorY(x, y, z) {
    if (!this.world) return 0.01;
    let floorY = 0.01;
    const boxes = this.world.getNearbyBoxes
      ? this.world.getNearbyBoxes(x - 0.5, x + 0.5, z - 0.5, z + 0.5)
      : (this.world.boxes || []);
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (!b.solid) continue;
      if (x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z) {
        if (b.max.y <= y + 0.15 && b.max.y > floorY) {
          floorY = b.max.y;
        }
      }
    }
    return floorY;
  }

  _createBloodFlipbookMat(frame = 0) {
    if (typeof document === 'undefined') {
      return new THREE.MeshBasicMaterial({ color: 0xd90429, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    }
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext && c.getContext('2d');
    if (!ctx || typeof ctx.clearRect !== 'function') {
      return new THREE.MeshBasicMaterial({ color: 0xd90429, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    }
    ctx.clearRect(0, 0, 128, 128);

    const cx = 64, cy = 64;
    // Semente determinística por frame para respingos "zoados" estilo MS-Paint / Doom 2D
    const blobs = [
      { a: 0.2, d: 18, r: 16, col: '#d90429' },
      { a: 1.1, d: 24, r: 14, col: '#9b0014' },
      { a: 2.0, d: 20, r: 18, col: '#ef233c' },
      { a: 2.9, d: 26, r: 13, col: '#800f2f' },
      { a: 3.7, d: 22, r: 17, col: '#d90429' },
      { a: 4.5, d: 25, r: 14, col: '#a4161a' },
      { a: 5.4, d: 21, r: 16, col: '#ef233c' },
      { a: 0.7, d: 34, r: 9,  col: '#ba181b' },
      { a: 2.4, d: 36, r: 10, col: '#d90429' },
      { a: 4.1, d: 35, r: 9,  col: '#800f2f' },
      { a: 5.8, d: 33, r: 11, col: '#ef233c' },
    ];

    if (frame === 0) {
      // Frame 0: Impacto estrelado violento + miolo vermelho vivo
      ctx.fillStyle = '#800f2f';
      ctx.strokeStyle = '#1a0004';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const spikes = 10;
      for (let i = 0; i < spikes * 2; i++) {
        const rad = i % 2 === 0 ? 48 : 20;
        const ang = (i / (spikes * 2)) * Math.PI * 2;
        const x = cx + Math.cos(ang) * rad;
        const y = cy + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ff1e38';
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.fill();
    } else if (frame === 1) {
      // Frame 1: Explosão de respingos grossos + texto zoeiro "SPLAT!"
      for (const b of blobs) {
        const bx = cx + Math.cos(b.a) * (b.d * 1.15);
        const by = cy + Math.sin(b.a) * (b.d * 1.15);
        ctx.fillStyle = b.col;
        ctx.strokeStyle = '#1f0004';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(bx, by, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#fff0f3';
      ctx.strokeStyle = '#110002';
      ctx.lineWidth = 4;
      ctx.font = 'bold 24px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText('SPLAT!', cx, cy);
      ctx.fillText('SPLAT!', cx, cy);
    } else if (frame === 2) {
      // Frame 2: Anel de gotas e blocos 2D se espalhando rápido
      for (const b of blobs) {
        const bx = cx + Math.cos(b.a + 0.2) * (b.d * 1.55);
        const by = cy + Math.sin(b.a + 0.2) * (b.d * 1.55);
        ctx.fillStyle = b.col;
        ctx.strokeStyle = '#1f0004';
        ctx.lineWidth = 2;
        ctx.fillRect(bx - b.r * 0.65, by - b.r * 0.65, b.r * 1.3, b.r * 1.3);
        ctx.strokeRect(bx - b.r * 0.65, by - b.r * 0.65, b.r * 1.3, b.r * 1.3);
      }
    } else {
      // Frame 3: Gotículas finais dissipando no ar
      ctx.globalAlpha = 0.65;
      for (const b of blobs) {
        const bx = cx + Math.cos(b.a + 0.35) * (b.d * 1.72);
        const by = cy + Math.sin(b.a + 0.35) * (b.d * 1.72);
        ctx.fillStyle = b.col;
        ctx.fillRect(bx - 5, by - 5, 10, 10);
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
  }

  _createBloodPuddleMat() {
    if (typeof document === 'undefined') {
      return new THREE.MeshBasicMaterial({ color: 0x800f2f, transparent: true, depthWrite: false });
    }
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext && c.getContext('2d');
    if (!ctx || typeof ctx.clearRect !== 'function') {
      return new THREE.MeshBasicMaterial({ color: 0x800f2f, transparent: true, depthWrite: false });
    }
    ctx.clearRect(0, 0, 128, 128);

    ctx.fillStyle = '#800f2f';
    ctx.strokeStyle = '#2b020c';
    ctx.lineWidth = 3;
    const drops = [
      [64, 64, 34], [42, 54, 20], [86, 58, 22], [58, 86, 21],
      [78, 82, 16], [30, 76, 11], [96, 40, 10], [46, 32, 12]
    ];
    for (const [x, y, r] of drops) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#a4161a';
    ctx.beginPath();
    ctx.arc(62, 62, 22, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1
    });
  }

  _spawnSoldierBloodVoxels(pos, isHeadshot = false) {
    if (!this.bloodVoxels || this.bloodVoxels.length === 0) return;
    const idx = this.bloodIdx;
    this.bloodIdx = (this.bloodIdx + 1) % this.bloodVoxels.length;
    const v = this.bloodVoxels[idx];

    v.active = true;
    v.maxLife = 2.0;
    v.life = v.maxLife;
    v.burstDuration = isHeadshot ? 0.30 : 0.24;
    v.baseScale = isHeadshot ? 2.25 : 1.70;
    v.puddleScale = isHeadshot ? 1.25 : 0.95;
    v.rotZ = (Math.random() - 0.5) * 0.5;

    const floorY = this._getFloorY(pos.x, pos.y + 0.5, pos.z);
    v.burstMesh.material = this.bloodFlipMats[0];
    v.burstMesh.position.set(pos.x, pos.y + (isHeadshot ? 1.25 : 0.95), pos.z);
    v.burstMesh.scale.setScalar(v.baseScale * 0.7);

    v.puddleMesh.position.set(pos.x, floorY + 0.015, pos.z);
    v.puddleMesh.rotation.z = Math.random() * Math.PI * 2;
    v.puddleMesh.scale.setScalar(v.puddleScale);
  }

  _spawnGhostDeathSmoke(pos, isHeadshot = false) {
    const count = isHeadshot ? 26 : 20;
    const baseY = pos.y + 0.9;

    for (let i = 0; i < count; i++) {
      const idx = this.ghostSmokeIdx;
      this.ghostSmokeIdx = (this.ghostSmokeIdx + 1) % MAX_GHOST_SMOKE;
      const s = this.ghostSmokePool[idx];

      s.active = true;
      s.mesh.visible = true;
      s.mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.4,
        baseY + (Math.random() - 0.5) * 0.5,
        pos.z + (Math.random() - 0.5) * 0.4
      );

      const hex = _ghostPalette[Math.floor(Math.random() * _ghostPalette.length)];
      s.mesh.material.color.setHex(hex);
      s.startScale = 0.4 + Math.random() * 0.35;
      s.mesh.scale.setScalar(s.startScale);
      s.mesh.material.opacity = 0.85;

      const spd = 1.4 + Math.random() * 2.5;
      const theta = Math.random() * Math.PI * 2;
      s.vel.set(
        Math.cos(theta) * spd,
        1.2 + Math.random() * 2.8,
        Math.sin(theta) * spd
      );

      s.growth = 2.5 + Math.random() * 1.5;
      s.maxLife = 0.85 + Math.random() * 0.40;
      s.life = s.maxLife;
    }
  }

  update(dt, camera) {
    // ══════════════════════════════════════════════════════════════════════
    // 1. TRACERS — Sistema Fotográfico Data-Driven por Arma
    //    Todos os parâmetros visuais são lidos de t.profile (weapons.json).
    //
    //    ESTILOS  ("style" no tracerProfile da arma):
    //    • "photographic" (padrão) — traço de luz emergindo do bocal,
    //      comprimento = speed * exposureTime. Persistência retinal.
    //    • "laser" — linha instantânea bocal→alvo. Parece um raio laser.
    //    • "streak" — ponto brilhante voando pelo ray (bala visível).
    //    • "swipe" — cresce até o alvo e encolhe (CS2 style).
    // ══════════════════════════════════════════════════════════════════════
    for (let i = 0; i < MAX_TRACERS; i++) {
      const t = this.tracers[i];
      if (!t.active) {
        if (t.group && t.group.visible) t.group.visible = false;
        continue;
      }

      // ─── MODO FLASH: tracer desacoplado da física (armas rápidas) ───
      if (t.mode === 'flash') {
        t.life += dt;

        const p = t.profile;
        const style = p.style || 'swipe';

        // TTL / expiração
        const ttl = t.ttl || p.ttl || 0.055;
        if (t.life >= ttl || t.life > 4.0) {
          t.active = false;
          if (t.group) t.group.visible = false;
          t.originTracker = null;
          continue;
        }

        // ═══════════════════════════════════════════════════════════
        // STYLE: "laser"
        // Linha instantânea da boca do cano ao ponto de impacto.
        // Parece um raio laser. Sem animação de viagem da bala.
        // ═══════════════════════════════════════════════════════════
        // STYLE: "laser"
        // Feixe instantâneo de energia/plasma no algoritmo FlashTracer:
        // A cabeça emerge do cano e atinge o alvo em velocidade de choque (~11ms),
        // formando um feixe luminoso puro entre a boca da arma e o ponto de impacto,
        // que dissolve com elegância e ZERO descompasso no strafe ou giro do mouse.
        // ═══════════════════════════════════════════════════════════


        if (style === 'laser') {

          // Sub-modo B: Feixe instantâneo de energia/plasma no algoritmo FlashTracer (ex: Proto Rifle)
          const laserTtl = t.ttl || p.ttl || 0.045;
          const k = Math.min(t.life / laserTtl, 1.0);
          const headSpeed = p.headSpeed || 0.25;
          const streakLength = p.streakLength || 0.70;
          const headT = Math.min(k / headSpeed, 1.0);
          const tailStart = headSpeed * (1.0 - streakLength);
          const tailDuration = Math.max(0.001, 1.0 - tailStart);
          const tailT = k <= tailStart ? 0 : Math.min((k - tailStart) / tailDuration, 1.0);

          let hx = t.originInitial.x + (t.end.x - t.originInitial.x) * headT;
          let hy = t.originInitial.y + (t.end.y - t.originInitial.y) * headT;
          let hz = t.originInitial.z + (t.end.z - t.originInitial.z) * headT;
          let tx = t.originInitial.x + (t.end.x - t.originInitial.x) * tailT;
          let ty = t.originInitial.y + (t.end.y - t.originInitial.y) * tailT;
          let tz = t.originInitial.z + (t.end.z - t.originInitial.z) * tailT;

          const maskOffset = p.flashProfile?.maskElasticOffset ?? 0;
          if (maskOffset > 0 && tailT < 0.05) {
            _tracerDir.subVectors(t.end, t.originInitial).normalize();
            tx += _tracerDir.x * maskOffset;
            ty += _tracerDir.y * maskOffset;
            tz += _tracerDir.z * maskOffset;
          }

          const dx = hx - tx, dy = hy - ty, dz = hz - tz;
          const realLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (realLen < 0.05) { if (t.group) t.group.visible = false; continue; }
          _tracerDir.set(dx, dy, dz).normalize();

          let laserOpacity = p.maxOpacity || 1.0;
          if (k < 0.10) laserOpacity *= (k / 0.10);
          else if (k > 0.55) laserOpacity *= (1.0 - (k - 0.55) / 0.45);

          const midX = (hx + tx) * 0.5;
          const midY = (hy + ty) * 0.5;
          const midZ = (hz + tz) * 0.5;

          if (t.group) {
            if (t.coreMesh.geometry !== this.tracerGeo) {
              t.coreMesh.geometry = this.tracerGeo;
              t.glowMesh.geometry = this.tracerGeo;
            }
            t.group.position.set(midX, midY, midZ);
            t.group.quaternion.setFromUnitVectors(_tracerUp, _tracerDir);
            const glowR     = p.glowRadius || 0.038;
            const coreRatio = Math.min(0.85, (p.coreRadius || 0.007) / glowR);
            const w = p.width || 1.0;
            t.coreMesh.scale.set(w * coreRatio, realLen, w * coreRatio);
            t.glowMesh.scale.set(w, realLen, w);
            t.coreMat.color.set(p.coreColor || 0xe0ffff);
            t.glowMat.color.set(p.glowColor || p.color || 0x00ffff);
            t.coreMat.opacity = Math.max(0, laserOpacity * (p.coreBrightness ?? 1.5));
            t.glowMat.opacity = Math.max(0, laserOpacity * (p.glowBrightness ?? 0.90));
            t.group.visible   = t.glowMat.opacity > 0.005;
          }
          continue;
        }

        // ═══════════════════════════════════════════════════════════
        // STYLE: "photographic"
        // Exposição ótica emergindo do bocal. Comprimento = speed * exposureTime.
        // Persistência retinal após impacto. Parece um traço de luz borrando.
        // Parâmetros: exposureTime, persistenceTime, coreRadius, glowRadius,
        //   coreBrightness, glowBrightness, coreColor, glowColor, width, maxOpacity
        // ═══════════════════════════════════════════════════════════
        if (style === 'photographic') {
          const spd              = t.speed || 700;
          const impactTime       = t.distanceToTarget / spd;
          const tailDepartureTime = p.exposureTime || 0.026;
          const tailArrivalTime  = impactTime + tailDepartureTime;

          // Head: posição instantânea da bala no ray
          const headDist = Math.min(t.distanceToTarget, spd * t.life);
          _tempHead.copy(t.originInitial).addScaledVector(t.dir, headDist);

          // Atualiza Ring Buffer N=8
          const nextHead = (t.sampleHead + 1) % 8;
          t.samples[nextHead].pos.copy(_tempHead);
          t.samples[nextHead].time = t.life;
          t.sampleHead = nextHead;
          if (t.sampleCount < 8) t.sampleCount++;

          // Tail: borda posterior da janela de obturador (100% colinear no ray)
          if (t.life <= tailDepartureTime) {
            _tempTail.copy(t.originInitial);
            const maskOffset = p.flashProfile?.maskElasticOffset ?? 0;
            if (maskOffset > 0) {
              _tempTail.addScaledVector(t.dir, maskOffset);
            }
          } else {
            const tailTime = t.life - tailDepartureTime;
            if (tailTime >= impactTime) {
              _tempTail.copy(t.end);
            } else {
              let sampled = false;
              let curr = t.sampleHead;
              for (let s = 0; s < t.sampleCount - 1; s++) {
                const prev  = (curr - 1 + 8) % 8;
                const sCurr = t.samples[curr];
                const sPrev = t.samples[prev];
                if (sPrev.time <= tailTime && sCurr.time >= tailTime) {
                  const denom = Math.max(1e-5, sCurr.time - sPrev.time);
                  const alpha = Math.max(0, Math.min(1, (tailTime - sPrev.time) / denom));
                  _tempTail.lerpVectors(sPrev.pos, sCurr.pos, alpha);
                  sampled = true;
                  break;
                }
                curr = prev;
              }
              if (!sampled) {
                const tailDist = Math.min(t.distanceToTarget, spd * tailTime);
                _tempTail.copy(t.originInitial).addScaledVector(t.dir, tailDist);
              }
            }
          }

          const dx = _tempHead.x - _tempTail.x;
          const dy = _tempHead.y - _tempTail.y;
          const dz = _tempHead.z - _tempTail.z;
          const realLen = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (realLen < 0.03) { if (t.group) t.group.visible = false; continue; }

          _tracerDir.set(dx, dy, dz).divideScalar(realLen);
          const midX = (_tempHead.x + _tempTail.x) * 0.5;
          const midY = (_tempHead.y + _tempTail.y) * 0.5;
          const midZ = (_tempHead.z + _tempTail.z) * 0.5;

          // Curva de opacidade: fade-in curto, plano, fade-out quadrático
          let exposureOpacity = 1.0;
          const fadeInTime = p.fadeInTime !== undefined ? p.fadeInTime : Math.max(0.004, tailDepartureTime * 0.20);
          if (t.life < fadeInTime && fadeInTime > 0) {
            exposureOpacity = t.life / fadeInTime;
          } else if (t.life > tailArrivalTime) {
            const fadeOutT = (t.life - tailArrivalTime) / Math.max(0.001, p.persistenceTime || 0.045);
            exposureOpacity = Math.max(0, Math.pow(Math.max(0, 1.0 - fadeOutT), 2));
          }
          exposureOpacity *= (p.maxOpacity ?? 0.95);

          if (t.group) {
            if (t.coreMesh.geometry !== this.tracerGeo) {
              t.coreMesh.geometry = this.tracerGeo;
              t.glowMesh.geometry = this.tracerGeo;
            }
            t.group.position.set(midX, midY, midZ);
            t.group.quaternion.setFromUnitVectors(_tracerUp, _tracerDir);
            const glowR     = p.glowRadius || 0.038;
            const coreRatio = Math.min(0.85, (p.coreRadius || 0.007) / glowR);
            const w = p.width || 1.0;
            t.coreMesh.scale.set(w * coreRatio, realLen, w * coreRatio);
            t.glowMesh.scale.set(w, realLen, w);
            t.coreMat.color.set(p.coreColor || 0xffffff);
            t.glowMat.color.set(p.glowColor || p.color || 0xffd27f);
            t.coreMat.opacity = Math.max(0, exposureOpacity * (p.coreBrightness ?? 1.0));
            t.glowMat.opacity = Math.max(0, exposureOpacity * (p.glowBrightness ?? 0.45));
            t.group.visible   = t.glowMat.opacity > 0.005;
          }
          continue;
        }

        // ═══════════════════════════════════════════════════════════
        // STYLE: "streak" — ponto brilhante voando pelo ray (bala visível)
        // STYLE: "swipe" — cresce até o alvo e encolhe (CS2 style)
        // Parâmetros: headSpeed, streakLength, fadeInEnd, fadeOutStart,
        //   maxOpacity, width, glowColor, coreColor, glowBrightness
        // ═══════════════════════════════════════════════════════════
        {
          const k = Math.min(t.life / (t.ttl || p.ttl || 0.055), 1.0);
          let headT = 0, tailT = 0;

          if (style === 'streak' || style === 'parabola') {
            const travelK = Math.min(k / (p.headSpeed || 0.35), 1.0);
            headT = travelK;
            tailT = Math.max(0, travelK - (p.streakLength || 0.45));
          } else {
            // swipe (default CS2 style)
            headT = Math.min(k / (p.headSpeed || 0.35), 1.0);
            const tailStart    = (p.headSpeed || 0.35) * (1.0 - (p.streakLength || 0.45));
            const tailDuration = Math.max(0.001, 1.0 - tailStart);
            tailT = k <= tailStart ? 0 : Math.min((k - tailStart) / tailDuration, 1.0);
          }

          let hx  = t.originInitial.x + (t.end.x - t.originInitial.x) * headT;
          let hy  = t.originInitial.y + (t.end.y - t.originInitial.y) * headT;
          let hz  = t.originInitial.z + (t.end.z - t.originInitial.z) * headT;
          let tx2 = t.originInitial.x + (t.end.x - t.originInitial.x) * tailT;
          let ty2 = t.originInitial.y + (t.end.y - t.originInitial.y) * tailT;
          let tz2 = t.originInitial.z + (t.end.z - t.originInitial.z) * tailT;

          if (style === 'parabola') {
            const arcHeight = p.arcHeight || 0.6;
            const gravityDrop = p.gravityDrop || 1.2;
            hy += Math.sin(headT * Math.PI) * arcHeight - (headT * headT) * gravityDrop;
            ty2 += Math.sin(tailT * Math.PI) * arcHeight - (tailT * tailT) * gravityDrop;
          }

          const maskOffset = p.flashProfile?.maskElasticOffset ?? 0;
          if (maskOffset > 0 && tailT < 0.05) {
            _tracerDir.subVectors(t.end, t.originInitial).normalize();
            tx2 += _tracerDir.x * maskOffset;
            ty2 += _tracerDir.y * maskOffset;
            tz2 += _tracerDir.z * maskOffset;
          }

          const dx = hx - tx2, dy = hy - ty2, dz = hz - tz2;
          let realLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (realLen < 0.05) { if (t.group) t.group.visible = false; continue; }
          _tracerDir.set(dx, dy, dz).normalize();

          const lengthMul = p.lengthMultiplier || 1.0;
          if (lengthMul > 1.0) {
            const headDistFromMuzzle = _tempV.set(hx - t.originInitial.x, hy - t.originInitial.y, hz - t.originInitial.z).dot(_tracerDir);
            const targetLen = realLen * lengthMul;
            realLen = Math.min(targetLen, Math.max(realLen, headDistFromMuzzle));
            tx2 = hx - _tracerDir.x * realLen;
            ty2 = hy - _tracerDir.y * realLen;
            tz2 = hz - _tracerDir.z * realLen;
          }

          let opacity = p.maxOpacity || 0.95;
          const fadeInEnd    = p.fadeInEnd || 0.10;
          const fadeOutStart = p.fadeOutStart || 0.65;
          if (k < fadeInEnd)         opacity *= (k / fadeInEnd);
          else if (k > fadeOutStart) opacity *= (1.0 - (k - fadeOutStart) / (1.0 - fadeOutStart));

          const midX = (hx + tx2) * 0.5;
          const midY = (hy + ty2) * 0.5;
          const midZ = (hz + tz2) * 0.5;

          if (t.group) {
            if (t.coreMesh.geometry !== this.tracerGeo) {
              t.coreMesh.geometry = this.tracerGeo;
              t.glowMesh.geometry = this.tracerGeo;
            }
            t.group.position.set(midX, midY, midZ);
            t.group.quaternion.setFromUnitVectors(_tracerUp, _tracerDir);
            const glowR     = p.glowRadius || 0.038;
            const coreRatio = Math.min(0.85, (p.coreRadius || 0.007) / glowR);
            const w = p.width || 1.0;
            t.coreMesh.scale.set(w * coreRatio, realLen, w * coreRatio);
            t.glowMesh.scale.set(w, realLen, w);
            t.coreMat.color.set(p.coreColor || 0xffffff);
            t.glowMat.color.set(p.glowColor || p.color || 0xffd27f);
            t.coreMat.opacity = Math.max(0, opacity * (p.coreBrightness ?? 1.0));
            t.glowMat.opacity = Math.max(0, opacity * (p.glowBrightness ?? 0.85));
            t.group.visible   = t.glowMat.opacity > 0.005;
          }
          continue;
        }
      }

      // ─── MODO PHYS: tracer físico acoplado a projéteis lentos ───
      t.life += dt;
      const p = t.proj;

      if (t.isDummy) {
         if (p.active) {
            t.dummyDistance += p.speed * dt;
            t.dummyPos.addScaledVector(p.vel, dt);
            if (t.dummyDistance >= p.distanceToTarget) {
               p.active = false;
               t.dummyPos.copy(p.startPos).addScaledVector(p.vel, p.distanceToTarget / p.speed);
            }
         }
      }

      if (!p || (!p.active && t.life > 0.05)) {
         t.active = false;
         if (t.group) t.group.visible = false;
         continue;
      }

      if (t.life > 2.0) {
         t.active = false;
         if (t.group) t.group.visible = false;
         continue;
      }

      const speed = p.speed || 700;
      const tp = p.tracerProfile;
      const visualTime = tp?.exposureTime ?? (p.isPellet ? 0.020 : 0.028);
      let tracerLen = speed * visualTime;
      tracerLen = Math.max(1.2, Math.min(12.0, tracerLen));

      const traveled = t.isDummy ? t.dummyDistance : p.distanceTraveled;
      if (traveled < tracerLen) tracerLen = Math.max(0.05, traveled);

      _tracerDir.copy(p.vel).normalize();

      const headX = t.isDummy ? t.dummyPos.x : p.pos.x;
      const headY = t.isDummy ? t.dummyPos.y : p.pos.y;
      const headZ = t.isDummy ? t.dummyPos.z : p.pos.z;

      let opacity = 0.95;
      if (!p.active) {
          const fade = Math.max(0, 1 - (t.life / 0.05));
          tracerLen *= fade;
          opacity *= fade;
      }

      let tailX, tailY, tailZ;
      const hasMuzzlePin = !t.isDummy && p.spawnOrigin;
      if (hasMuzzlePin) {
        const pinDistance = Math.max(tracerLen * 2, 4.0);
        const pinT = Math.min(traveled / pinDistance, 1.0);
        const stdTailX = headX - _tracerDir.x * tracerLen;
        const stdTailY = headY - _tracerDir.y * tracerLen;
        const stdTailZ = headZ - _tracerDir.z * tracerLen;
        tailX = p.spawnOrigin.x + (stdTailX - p.spawnOrigin.x) * pinT;
        tailY = p.spawnOrigin.y + (stdTailY - p.spawnOrigin.y) * pinT;
        tailZ = p.spawnOrigin.z + (stdTailZ - p.spawnOrigin.z) * pinT;
      } else {
        tailX = headX - _tracerDir.x * tracerLen;
        tailY = headY - _tracerDir.y * tracerLen;
        tailZ = headZ - _tracerDir.z * tracerLen;
      }

      const realLen = Math.sqrt(
        (headX - tailX) ** 2 + (headY - tailY) ** 2 + (headZ - tailZ) ** 2
      );

      if (realLen < 0.05) { if (t.group) t.group.visible = false; continue; }

      _tracerDir.set(headX - tailX, headY - tailY, headZ - tailZ).normalize();

      const glowColor = tp?.glowColor || p.color || 0xffd27f;
      const coreColor = tp?.coreColor || 0xffffff;
      const physW     = tp?.width || 1.0;
      const coreR     = tp?.coreRadius || 0.007;
      const glowR     = tp?.glowRadius || 0.038;

      if (t.group) {
        t.group.position.set((headX + tailX) * 0.5, (headY + tailY) * 0.5, (headZ + tailZ) * 0.5);
        t.group.quaternion.setFromUnitVectors(_tracerUp, _tracerDir);
        const coreRatio = Math.min(0.85, coreR / glowR);
        t.coreMesh.scale.set(physW * coreRatio, realLen, physW * coreRatio);
        t.glowMesh.scale.set(physW, realLen, physW);
        t.coreMat.color.set(coreColor);
        t.glowMat.color.set(glowColor);
        t.coreMat.opacity = opacity * (tp?.coreBrightness || 1.0);
        t.glowMat.opacity = opacity * (tp?.glowBrightness || 0.6);
        t.group.visible   = opacity > 0.005;
      }
    }


    // 2. Sparks
    for (let i = 0; i < MAX_SPARKS; i++) {
      const p = this.sparks[i];
      if (!p.active) continue;
      
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      
      p.vel.y -= 12 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.02) {
        p.mesh.position.y = 0.02;
        p.vel.y *= -0.3;
        p.vel.x *= 0.7; p.vel.z *= 0.7;
      }
      p.mesh.material.opacity = p.life / p.maxLife;
    }

    // 3. Smokes
    for (let i = 0; i < MAX_SMOKE; i++) {
      const p = this.smokes[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      const t = p.life / p.maxLife; // 1 -> 0
      p.vel.y += 0.9 * dt; // empuxo
      p.vel.x *= (1 - 2.2 * dt); // drag
      p.vel.z *= (1 - 2.2 * dt);
      
      p.mesh.position.addScaledVector(p.vel, dt);
      const grow = 1 + (1 - t) * p.growth;
      p.mesh.scale.setScalar(p.startScale * grow);
      p.mesh.material.opacity = Math.pow(t, 1.25) * (p.maxOpacity || 0.6);
    }

    // 4. Faíscas do Protótipo (simulação física com gravidade e arrasto)
    if (this.sparkPointsGeo) {
      let anyProtoSpark = false;
      for (let i = 0; i < this.SPARK_MAX; i++) {
        if (this.sparkLife[i] <= 0) continue;
        anyProtoSpark = true;
        this.sparkLife[i] -= dt;
        if (this.sparkLife[i] <= 0) {
          this.sparkPos[i * 3 + 1] = -999;
          continue;
        }
        this.sparkVel[i * 3 + 1] -= 7.0 * dt;
        this.sparkPos[i * 3 + 0] += this.sparkVel[i * 3 + 0] * dt;
        this.sparkPos[i * 3 + 1] += this.sparkVel[i * 3 + 1] * dt;
        this.sparkPos[i * 3 + 2] += this.sparkVel[i * 3 + 2] * dt;
      }
      if (anyProtoSpark) this.sparkPointsGeo.attributes.position.needsUpdate = true;
    }

    // 5. Fumaça do Protótipo (billboard face-camera, giro e flutuação térmica)
    if (this.protoSmokePool) {
      for (const s of this.protoSmokePool) {
        if (s.life <= 0) continue;
        s.life -= dt;
        if (s.life <= 0) {
          s.mesh.visible = false;
          s.mesh.material.opacity = 0;
          continue;
        }
        const k = s.life / s.max;
        s.mesh.material.opacity = 0.42 * k;
        s.mesh.position.addScaledVector(s.vel, dt);
        s.vel.multiplyScalar(1 - 1.6 * dt);
        s.vel.y += 0.16 * dt;
        s.mesh.scale.setScalar(0.55 + (1 - k) * 2.1);
        s.mesh.rotation.z += s.spin * dt;
        if (camera) s.mesh.quaternion.copy(camera.quaternion);
      }
    }

    // 6. Cartuchos vazios ejetados (gravidade, quique no chão e rotação tumbling)
    for (let i = 0; i < MAX_CASINGS; i++) {
      const c = this.casings[i];
      if (!c.active) continue;

      c.life -= dt;
      if (c.life <= 0) {
        c.active = false;
        c.mesh.visible = false;
        continue;
      }

      // Gravidade acelerada
      c.vel.y -= 13.0 * dt;
      // Arrasto do ar leve
      c.vel.x *= Math.max(0, 1 - 0.5 * dt);
      c.vel.z *= Math.max(0, 1 - 0.5 * dt);

      // Movimento linear
      c.mesh.position.addScaledVector(c.vel, dt);

      // Rotação dinâmica no ar
      c.mesh.rotation.x += c.rotVel.x * dt;
      c.mesh.rotation.y += c.rotVel.y * dt;
      c.mesh.rotation.z += c.rotVel.z * dt;

      // Colisão / quique suave no solo (y = 0.01)
      if (c.mesh.position.y < 0.012) {
        c.mesh.position.y = 0.012;
        // Amortecimento elástico de quique de latão
        c.vel.y = Math.abs(c.vel.y) * 0.35;
        c.vel.x *= 0.65;
        c.vel.z *= 0.65;
        c.rotVel.multiplyScalar(0.45);
      }
    }

    // 7. Explosão de Sangue 2D Flipbook + Poça 2D no Chão (Zero Física)
    for (let i = 0; i < this.bloodVoxels.length; i++) {
      const v = this.bloodVoxels[i];
      if (!v.active) continue;

      v.life -= dt;
      if (v.life <= 0) {
        v.active = false;
        v.burstMesh.position.set(0, -999, 0);
        v.burstMesh.scale.setScalar(0.001);
        v.puddleMesh.position.set(0, -999, 0);
        v.puddleMesh.scale.setScalar(0.001);
        continue;
      }

      const elapsed = v.maxLife - v.life;
      if (elapsed < v.burstDuration) {
        const k = elapsed / v.burstDuration; // 0 -> 1
        const frameIdx = Math.min(3, Math.floor(k * 4));
        if (v.burstMesh.material !== this.bloodFlipMats[frameIdx]) {
          v.burstMesh.material = this.bloodFlipMats[frameIdx];
        }
        v.burstMesh.scale.setScalar(v.baseScale * (0.75 + k * 0.55));
        if (camera) {
          v.burstMesh.quaternion.copy(camera.quaternion);
          v.burstMesh.rotateZ(v.rotZ);
        }
      } else if (v.burstMesh.position.y > -500) {
        v.burstMesh.position.set(0, -999, 0);
        v.burstMesh.scale.setScalar(0.001);
      }

      if (v.life < 0.4) {
        v.puddleMesh.scale.setScalar(Math.max(0.001, v.puddleScale * (v.life / 0.4)));
      }
    }

    // 8. Fumaça de Fantasma (Explosão poof cinza/branca que expande e dissipa)
    for (let i = 0; i < MAX_GHOST_SMOKE; i++) {
      const s = this.ghostSmokePool[i];
      if (!s.active) continue;

      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        s.mesh.visible = false;
        continue;
      }

      const t = s.life / s.maxLife; // 1 -> 0
      s.vel.y += 0.85 * dt; // sustentação térmica ascendente
      s.vel.x *= Math.max(0, 1 - 2.8 * dt);
      s.vel.z *= Math.max(0, 1 - 2.8 * dt);

      s.mesh.position.addScaledVector(s.vel, dt);
      const grow = 1 + (1 - t) * s.growth;
      s.mesh.scale.setScalar(s.startScale * grow);
      s.mesh.material.opacity = t * t * 0.85;
    }
  }
}






