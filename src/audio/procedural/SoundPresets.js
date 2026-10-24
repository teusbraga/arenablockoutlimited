/**
 * Configurações Data-Driven dos Presets Acústicos Calibrados
 * Valores extraídos da bancada Procedural Audio Lab e calibrados com a imagem do usuário.
 */
export const SOUND_PRESETS = {
  // --- ARMAS DE FOGO (DISPAROS) ---
  rifle_556: {
    supersonicCrack: 0.95,
    muzzleBlastFreq: 290,
    muzzleDecay: 85, // ms
    bcgCycle: 0.65,
    barrelRing: 780,
    overpressureBody: 0.75,
    acousticTail: 0.60,
    airAbsorption: 3500
  },
  rifle_308: {
    supersonicCrack: 0.98,
    muzzleConcussionFreq: 190,
    muzzleDecay: 130, // ms
    overpressureBlast: 0.90,
    heavyBarrelRing: 540,
    boltActionMech: 0.72,
    valleyEcho: 0.75,
    airDamping: 2800
  },
  ak_suppressed: {
    supersonicCrack: 1.00,
    muzzleBarkFreq: 240,
    blastDecay: 85, // ms (seco e contundente)
    boltPistonMech: 0.85,
    receiverSteelRing: 1650,
    dramaticEcho: 0.25, // curto e seco, sem eco distante
    airAbsorption: 9000 // aberto e estridente, zero abafamento
  },
  get ak_supressed() { return this.ak_suppressed; },
  get ak47_762x39() { return this.ak_suppressed; },
  gunshot_9mm: {
    muzzleCrack: 0.90,
    powderPunch: 230,
    powderDecay: 55, // ms
    slideCycle: 0.45,
    barrelResonance: 1100,
    reverbTail: 0.50,
    airDamping: 2400
  },
  smg_uzi_9mm: {
    snappyCrack: 0.92,
    powderBodyFreq: 260,
    powderDecay: 42, // ms
    openBoltSlam: 0.78,
    stampedMetalRing: 1450,
    burstRateRpm: 600,
    tailAcoustics: 0.45,
    airDamping: 3400
  },
  vss_vintorez_9x39: {
    suppressorPuff: 0.88,
    subsonicThumpFreq: 135,
    thumpDecay: 38, // ms
    gasJetHiss: 0.65,
    internalActionVol: 0.82,
    heavySlugDisplace: 0.55,
    burstRpm: 750,
    muffledAirCut: 1600
  },
  sw500_magnum: {
    supersonicCrack: 1.00,
    subBassThumpFreq: 180,
    blastDecay: 90, // ms (seco e sem ressonancia lenta de bumbo)
    cylinderGapBlast: 0.95,
    xframeRingFreq: 1850,
    dramaticTail: 0.25, // seco e focado
    airAbsorption: 9500 // estridente e cortante
  },
  shotgun_blast_12g: {
    muzzleUncork: 0.95,
    boreThumpFreq: 165,
    blastDecay: 190, // ms
    barrelVibration: 0.70,
    barrelResFreq: 920,
    dramaticTail: 0.85,
    airAbsorption: 2400
  },

  // --- RECARGAS & MANIPULAÇÃO MECÂNICA ---
  // Calibração exata da imagem do usuário para inserção do cartucho 12g:
  shotgun_load_shell: {
    gatePush: 0.70,
    springScrape: 0.75,
    springScrapeFreq: 2300, // Imagem do usuário
    latchSnap: 0.42,        // Imagem do usuário
    brassRimRing: 2450,
    tubeCavityFreq: 420
  },
  shotgun_pump_back: {
    tchSnap: 0.85,
    scrapeBite: 0.75,
    scrapeFreq: 3200,
    lickStop: 0.95,
    searClick: 0.80,
    tubeChamberRing: 1450
  },
  shotgun_pump_forward: {
    forwardRush: 0.75,
    rushSweepFreq: 2800,
    breachSlam: 0.95,
    lockingSnap: 0.90,
    brightRingFreq: 3400,
    barrelResonance: 1850
  },
  pistol_slide_pull: {
    unlockClick: 0.70,
    railFriction: 0.60,
    springTension: 1150,
    rearStopClack: 0.88,
    hammerCock: 0.72,
    metalRing: 1850
  },
  pistol_slide_release: {
    releaseCatch: 0.75,
    forwardRush: 0.50,
    batterySlam: 0.98,
    extractorSnap: 0.78,
    chamberRingFreq: 620,
    highMetallicClatter: 2100
  },
  mag_stanag_insert: {
    magwellFriction: 0.65,
    seatSlap: 0.85,
    catchClick: 0.95,
    receiverRingFreq: 2100,
    bodyThudFreq: 380
  },
  mag_ak_metal_insert: {
    frontLugHook: 0.70,
    paddleSnap: 1.00,
    sheetMetalRing: 1350,
    heavyRearThud: 0.90,
    steelClatter: 820
  },

  // --- BALÍSTICA TERMINAL POR SUPERFÍCIE ---
  bullet_hit_sand: {
    groundThud: 0.95,
    thudFreq: 120,
    sandSpray: 0.85,
    sprayFreq: 1400
  },
  bullet_hit_wood: {
    fiberCrack: 0.95,
    cavityThump: 0.80,
    woodResFreq: 240,
    splinters: 0.70
  },
  bullet_hit_masonry: {
    mineralCrack: 1.00,
    solidKnock: 0.90,
    debrisSpall: 0.85,
    debrisFreq: 2600
  },
  bullet_hit_metal: {
    leadSpatterSnap: 1.00,
    steelPlateThud: 0.85,
    plateVibration: 0.80,
    plateFreq: 1800
  },

  // --- DANO NO JOGADOR (EXCLUSIVO PLACA BALÍSTICA / KEVLAR) ---
  bullet_hit_kevlar: {
    plateCrack: 1.00,
    sternumImpact: 0.95,
    plateResonance: 3400,
    breathKnock: 0.70,
    compositeBite: 0.75
  },

  // --- LOCOMOÇÃO (PASSOS) ---
  footstep_default: {
    heelFrequency: 130,
    heelDecay: 38,
    toeDelay: 85,
    toePitch: 220,
    woodResonance: 180,
    surfaceQ: 4.5,
    scuffAmount: 0.28,
    bodyWeight: 0.85
  }
};
