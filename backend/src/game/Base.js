const CONFIG = require('./config');

class Base {
  constructor(playerId, q, r) {
    this.playerId = playerId;
    this.q = q;
    this.r = r;
    
    this.modules = {
      DOCK: 1,
      LAB: 1,
      STORAGE: 1,
      POWER: 1
    };
    
    this.coreHealth = 100;
    this.maxCoreHealth = 100;
    this.energy = 50;
    this.maxEnergy = 100;
    
    this.buildQueue = [];
    this.researchQueue = [];
    
    this.storage = {
      mineral: 200,
      bio_sample: 20,
      relic: 0
    };
    
    this.storageCapacity = 500;
    this.torpedoes = 10;
    this.maxTorpedoes = 20;
    
    this.techPoints = 50;
    this.researched = new Set();
    this.researchProgress = {};
  }

  getStorageUsed() {
    return this.storage.mineral + this.storage.bio_sample + this.storage.relic;
  }

  getStorageCapacity() {
    return this.storageCapacity * (this.modules.STORAGE || 0);
  }

  canAfford(cost) {
    if (cost.mineral && this.storage.mineral < cost.mineral) return false;
    if (cost.tech && this.techPoints < cost.tech) return false;
    if (cost.bio_sample && this.storage.bio_sample < cost.bio_sample) return false;
    return true;
  }

  payCost(cost) {
    if (cost.mineral) this.storage.mineral -= cost.mineral;
    if (cost.tech) this.techPoints -= cost.tech;
    if (cost.bio_sample) this.storage.bio_sample -= cost.bio_sample;
  }

  addResources(resources) {
    const capacity = this.getStorageCapacity();
    let currentUsed = this.getStorageUsed();
    
    for (const [type, amount] of Object.entries(resources)) {
      const available = capacity - currentUsed;
      const actual = Math.min(amount, available);
      this.storage[type] = (this.storage[type] || 0) + actual;
      currentUsed += actual;
    }
  }

  buildModule(moduleType) {
    const module = CONFIG.BASE_MODULES[moduleType];
    if (!module) return false;
    if (!this.canAfford(module.cost)) return false;
    
    this.payCost(module.cost);
    this.modules[moduleType] = (this.modules[moduleType] || 0) + 1;
    
    if (moduleType === 'STORAGE') {
      this.storageCapacity += module.capacity;
    }
    if (moduleType === 'POWER') {
      this.maxEnergy += module.energyOutput;
    }
    if (moduleType === 'TORPEDO_BAY') {
      this.maxTorpedoes += module.torpedoCapacity;
    }
    
    return true;
  }

  canResearch(techId) {
    const tech = CONFIG.RESEARCH_TECHS[techId];
    if (!tech) return false;
    if (this.researched.has(techId)) return false;
    if (tech.prerequisite && !this.researched.has(tech.prerequisite)) return false;
    if (this.techPoints < tech.cost) return false;
    return true;
  }

  startResearch(techId) {
    if (!this.canResearch(techId)) return false;
    this.researchQueue.push(techId);
    return true;
  }

  processResearch() {
    if (this.researchQueue.length === 0) return null;
    
    const labCount = this.modules.LAB || 0;
    if (labCount === 0) return null;
    
    const progressPerTurn = labCount * 5;
    const currentTech = this.researchQueue[0];
    const tech = CONFIG.RESEARCH_TECHS[currentTech];
    
    if (!this.researchProgress[currentTech]) {
      this.researchProgress[currentTech] = 0;
    }
    
    this.researchProgress[currentTech] += progressPerTurn;
    
    if (this.researchProgress[currentTech] >= tech.cost) {
      this.researched.add(currentTech);
      this.researchQueue.shift();
      delete this.researchProgress[currentTech];
      return currentTech;
    }
    
    return null;
  }

  getSonarRange() {
    const baseRange = 3;
    const arrayBonus = (this.modules.SONAR_ARRAY || 0) * 5;
    return baseRange + arrayBonus;
  }

  getMaxSubmarines() {
    return (this.modules.DOCK || 0) * 2;
  }

  damageCore(amount) {
    this.coreHealth = Math.max(0, this.coreHealth - amount);
    return this.coreHealth === 0;
  }

  repairCore(amount) {
    this.coreHealth = Math.min(this.maxCoreHealth, this.coreHealth + amount);
  }

  toPublicState() {
    return {
      playerId: this.playerId,
      q: this.q,
      r: this.r,
      modules: { ...this.modules },
      coreHealth: this.coreHealth,
      maxCoreHealth: this.maxCoreHealth
    };
  }

  toPrivateState() {
    return {
      ...this.toPublicState(),
      energy: this.energy,
      maxEnergy: this.maxEnergy,
      storage: { ...this.storage },
      storageCapacity: this.getStorageCapacity(),
      techPoints: this.techPoints,
      researched: Array.from(this.researched),
      researchQueue: [...this.researchQueue],
      researchProgress: { ...this.researchProgress },
      buildQueue: [...this.buildQueue],
      torpedoes: this.torpedoes,
      maxTorpedoes: this.maxTorpedoes
    };
  }
}

module.exports = Base;
