const Base = require('./Base');
const Submarine = require('./Submarine');
const CONFIG = require('./config');
const { v4: uuidv4 } = require('uuid');

class Player {
  constructor(id, name, color, spawnQ, spawnR) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.isAI = false;
    this.isConnected = true;
    this.disconnectTimer = 0;
    
    this.base = new Base(id, spawnQ, spawnR);
    this.submarines = [];
    this.sonarBuoys = [];
    
    this.score = 0;
    this.isDefeated = false;
    
    this.initializeSubmarines(spawnQ, spawnR);
  }

  initializeSubmarines(q, r) {
    const scout = new Submarine(uuidv4(), 'SCOUT', this.id, q, r);
    const miner = new Submarine(uuidv4(), 'MINER', this.id, q, r);
    
    this.submarines.push(scout, miner);
  }

  getSubmarine(subId) {
    return this.submarines.find(s => s.id === subId);
  }

  addSubmarine(type) {
    const template = CONFIG.SUBMARINE_TYPES[type];
    if (!template) return null;
    if (this.submarines.length >= this.base.getMaxSubmarines()) return null;
    
    const sub = new Submarine(uuidv4(), type, this.id, this.base.q, this.base.r);
    this.submarines.push(sub);
    return sub;
  }

  removeSubmarine(subId) {
    const index = this.submarines.findIndex(s => s.id === subId);
    if (index !== -1) {
      const sub = this.submarines[index];
      this.submarines.splice(index, 1);
      return sub;
    }
    return null;
  }

  calculateScore(map) {
    let score = 0;
    
    score += this.base.techPoints * 2;
    
    score += this.base.storage.mineral * 0.5;
    score += this.base.storage.bio_sample * 2;
    score += this.base.storage.relic * 5;
    
    for (const sub of this.submarines) {
      score += sub.getCargoTotal() * 0.3;
    }
    
    let controlPoints = 0;
    for (const [key, tile] of map.tiles) {
      if (tile.owner === this.id && tile.controlPoints > 0) {
        controlPoints += tile.controlPoints;
      }
    }
    score += controlPoints * 3;
    
    this.score = Math.floor(score);
    return this.score;
  }

  toPublicState() {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      isAI: this.isAI,
      isConnected: this.isConnected,
      base: this.base.toPublicState(),
      submarines: this.submarines.map(s => s.toPublicState(false)),
      score: this.score,
      isDefeated: this.isDefeated
    };
  }

  toPrivateState() {
    return {
      ...this.toPublicState(),
      base: this.base.toPrivateState(),
      submarines: this.submarines.map(s => s.toPublicState(true)),
      sonarBuoys: [...this.sonarBuoys]
    };
  }
}

module.exports = Player;
