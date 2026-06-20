const CONFIG = require('./config');

class Submarine {
  constructor(id, type, ownerId, q, r) {
    this.id = id;
    this.type = type;
    this.ownerId = ownerId;
    this.q = q;
    this.r = r;
    
    const template = CONFIG.SUBMARINE_TYPES[type];
    this.maxHull = template.hull;
    this.hull = template.hull;
    this.maxDepth = template.maxDepth;
    this.movement = template.movement;
    this.movementLeft = template.movement;
    this.maxCargo = template.cargo;
    this.maxEnergy = template.energy;
    this.energy = template.energy;
    this.sonarRange = template.sonarRange;
    this.sonarMode = 'passive';
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
