const CONFIG = require('./config');

const DEPTH_TECH_MAP = {
  DEPTH_1000: 1000,
  DEPTH_2000: 2000,
  DEPTH_3000: 3000
};

class Submarine {
  constructor(id, type, ownerId, q, r) {
    this.id = id;
    this.type = type;
    this.ownerId = ownerId;
    this.q = q;
    this.r = r;
    
    const template = CONFIG.SUBMARINE_TYPES[type];
    this._baseMaxHull = template.hull;
    this.maxHull = template.hull;
    this.hull = template.hull;
    this._baseMaxDepth = template.maxDepth;
    this.maxDepth = template.maxDepth;
    this._baseMovement = template.movement;
    this.movement = template.movement;
    this.movementLeft = template.movement;
    this.maxCargo = template.cargo;
    this.maxEnergy = template.energy;
    this.energy = template.energy;
    this._baseSonarRange = template.sonarRange;
    this.sonarRange = template.sonarRange;
    this.sonarMode = 'passive';
    this._baseMiningEfficiency = template.miningEfficiency || 1;
    this.miningEfficiency = template.miningEfficiency || 1;
    this.scienceBonus = template.scienceBonus || 1;
    this.torpedoDamage = template.torpedoDamage || 0;
    this.torpedoRange = template.torpedoRange || 0;
    this.torpedoes = template.torpedoRange > 0 ? 5 : 0;
    
    this.cargo = {
      mineral: 0,
      bio_sample: 0,
      relic: 0
    };
    
    this.status = 'idle';
    this.waypoints = [];
    this.actions = [];
  }

  applyTechEffects(effectiveTechs) {
    this.sonarRange = this._baseSonarRange;
    if (effectiveTechs && effectiveTechs.has('ADVANCED_SONAR')) {
      this.sonarRange += 2;
    }

    this.maxHull = this._baseMaxHull;
    if (effectiveTechs && effectiveTechs.has('REINFORCED_HULL')) {
      this.maxHull = Math.floor(this._baseMaxHull * 1.2);
    }
    if (this.hull > this.maxHull) {
      this.hull = this.maxHull;
    }

    this.maxDepth = this._baseMaxDepth;
    for (const [techId, depth] of Object.entries(DEPTH_TECH_MAP)) {
      if (effectiveTechs && effectiveTechs.has(techId) && depth > this.maxDepth) {
        this.maxDepth = depth;
      }
    }

    this.movement = this._baseMovement;
    if (effectiveTechs && effectiveTechs.has('ADVANCED_PROPULSION')) {
      this.movement += 1;
    }

    this.miningEfficiency = this._baseMiningEfficiency;
    if (effectiveTechs && effectiveTechs.has('EFFICIENT_MINING')) {
      this.miningEfficiency = this._baseMiningEfficiency * 1.3;
    }
  }

  canDive(depth) {
    return depth <= this.maxDepth;
  }

  getCargoTotal() {
    return this.cargo.mineral + this.cargo.bio_sample + this.cargo.relic;
  }

  addCargo(type, amount) {
    const available = this.maxCargo - this.getCargoTotal();
    const actual = Math.min(amount, available);
    this.cargo[type] += actual;
    return actual;
  }

  unloadCargo() {
    const unloaded = { ...this.cargo };
    this.cargo = { mineral: 0, bio_sample: 0, relic: 0 };
    return unloaded;
  }

  damage(amount) {
    this.hull = Math.max(0, this.hull - amount);
    if (this.hull === 0) {
      this.status = 'sunk';
    }
  }

  repair(amount) {
    this.hull = Math.min(this.maxHull, this.hull + amount);
  }

  refuel(amount) {
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
  }

  consumeEnergy(amount) {
    this.energy = Math.max(0, this.energy - amount);
    if (this.energy === 0) {
      this.status = 'adrift';
    }
  }

  resetTurn() {
    this.movementLeft = this.movement;
    this.actions = [];
  }

  toPublicState(isOwner) {
    const state = {
      id: this.id,
      type: this.type,
      ownerId: this.ownerId,
      q: this.q,
      r: this.r,
      status: this.status
    };
    
    if (isOwner) {
      state.hull = this.hull;
      state.maxHull = this.maxHull;
      state.energy = this.energy;
      state.maxEnergy = this.maxEnergy;
      state.movementLeft = this.movementLeft;
      state.movement = this.movement;
      state.cargo = { ...this.cargo };
      state.maxCargo = this.maxCargo;
      state.sonarRange = this.sonarRange;
      state.sonarMode = this.sonarMode;
      state.torpedoes = this.torpedoes;
      state.waypoints = [...this.waypoints];
    }
    
    return state;
  }
}

module.exports = Submarine;
