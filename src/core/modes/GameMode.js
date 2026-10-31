/**
 * GameMode (Strategy Pattern Base)
 * Define a interface e o contrato canônico para todos os modos de jogo em Arena Blockout.
 * Novos modos (ex: TeamDeathmatch 5v5, Defusal, Campanha Co-op) devem herdar desta classe.
 */
export class GameMode {
  constructor(options = {}) {
    this.id = options.id || 'base';
    this.name = options.name || 'Base Mode';
    this.options = options;
    this.scores = new Map(); // entity -> { id, name, badge, kills, deaths, isPlayer }
  }

  /**
   * Registra uma entidade (Player ou Bot) no sistema de pontuação do modo.
   * @param {Object} entity
   */
  registerCombatant(entity) {
    if (!entity) return;
    if (!this.scores.has(entity)) {
      const isPlayer = !!(entity.isPlayer || entity.rig);
      const name = entity.name || (isPlayer ? 'VOCÊ' : (entity.callsign ? `#${String(entity.id || 1).padStart(2, '0')} ${entity.callsign}` : `Bot_${entity.id || 1}`));
      const badge = entity.badge || (isPlayer ? '🌟' : (entity.skinBadge || '🪖'));
      this.scores.set(entity, {
        entity,
        id: entity.id ?? (isPlayer ? 0 : 1),
        name,
        badge,
        kills: 0,
        deaths: 0,
        isPlayer
      });
    }
  }

  /**
   * Retorna se duas entidades são inimigas entre si sob a regra deste modo.
   * @param {Object} entityA
   * @param {Object} entityB
   * @returns {boolean}
   */
  isEnemy(entityA, entityB) {
    if (!entityA || !entityB) return false;
    if (entityA === entityB) return false;
    return (entityA.alive !== false) && (entityB.alive !== false);
  }

  /**
   * Retorna se um projétil ou golpe de 'attacker' pode ferir 'victim'.
   * @param {Object} attacker
   * @param {Object} victim
   * @returns {boolean}
   */
  canDamage(attacker, victim) {
    if (!attacker || !victim) return true;
    return attacker !== victim;
  }

  /**
   * Calcula o melhor ponto de spawn para a entidade considerando o contexto da partida.
   * @param {Object} entity
   * @param {Object} context
   * @returns {{x: number, y: number, z: number}}
   */
  getSpawnPoint(entity, context = {}) {
    return { x: 0, y: 0.6, z: 0 };
  }

  /**
   * Registra um abate no modo de jogo.
   * @param {Object} killer
   * @param {Object} victim
   * @param {boolean} headshot
   * @param {Object} extra
   * @returns {Object} Dados do kill para o evento match:kill
   */
  onKill(killerOrPayload, victimArg, headshotArg = false, extraArg = {}) {
    let killer = killerOrPayload;
    let victim = victimArg;
    let headshot = headshotArg;
    let extra = extraArg;

    if (killerOrPayload && typeof killerOrPayload === 'object' && ('killer' in killerOrPayload || 'victim' in killerOrPayload)) {
      killer = killerOrPayload.killer;
      victim = killerOrPayload.victim;
      headshot = !!killerOrPayload.headshot;
      extra = killerOrPayload.extra || killerOrPayload;
    }

    if (victim) {
      this.registerCombatant(victim);
      const vicData = this.scores.get(victim);
      if (vicData) vicData.deaths++;
    }

    let isPlayerKiller = false;
    let isPlayerVictim = false;

    if (killer && killer !== victim) {
      this.registerCombatant(killer);
      const killData = this.scores.get(killer);
      if (killData) killData.kills++;
      isPlayerKiller = !!(killer.isPlayer || killer === extra.player || killData?.isPlayer);
    }

    if (victim) {
      const vicData = this.scores.get(victim);
      isPlayerVictim = !!(victim.isPlayer || victim === extra.player || vicData?.isPlayer);
    }

    return {
      killer,
      victim,
      headshot: !!headshot,
      attackerName: this.getCombatantName(killer),
      victimName: this.getCombatantName(victim),
      attackerBadge: this.getCombatantBadge(killer),
      victimBadge: this.getCombatantBadge(victim),
      weaponId: extra.weaponId || killer?.weaponId || 'ar15',
      isPlayerKiller,
      isPlayerAttacker: isPlayerKiller,
      isPlayerVictim
    };
  }

  getCombatantName(entity) {
    if (!entity) return 'Desconhecido';
    const data = this.scores.get(entity);
    return data?.name || entity.name || (entity.isPlayer ? 'VOCÊ' : `Bot_${entity.id || 1}`);
  }

  getCombatantBadge(entity) {
    if (!entity) return '⚔️';
    const data = this.scores.get(entity);
    return data?.badge || entity.badge || (entity.isPlayer ? '🌟' : (entity.skinBadge || '🪖'));
  }

  /**
   * Retorna a lista de combatentes ordenada para exibição no Scoreboard (TAB).
   * @returns {Array<Object>}
   */
  getScoreboard() {
    const list = [];
    for (const data of this.scores.values()) {
      const kd = data.deaths === 0
        ? (data.kills > 0 ? data.kills.toFixed(2) : '0.00')
        : (data.kills / data.deaths).toFixed(2);
      list.push({
        id: data.id,
        name: data.name,
        badge: data.badge,
        kills: data.kills,
        deaths: data.deaths,
        kd,
        isPlayer: data.isPlayer,
        alive: data.entity ? data.entity.alive !== false : true
      });
    }

    // Ordenação decrescente: Kills -> K/D -> menos mortes
    list.sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      const kdDiff = parseFloat(b.kd) - parseFloat(a.kd);
      if (Math.abs(kdDiff) > 0.001) return kdDiff;
      return a.deaths - b.deaths;
    });

    return list.map((item, idx) => ({ rank: idx + 1, ...item }));
  }

  reset() {
    for (const data of this.scores.values()) {
      data.kills = 0;
      data.deaths = 0;
    }
  }
}
