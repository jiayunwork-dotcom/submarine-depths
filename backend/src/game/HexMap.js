const CONFIG = require('./config');

class HexMap {
  constructor(size) {
    this.size = size;
    this.tiles = new Map();
    this.generateMap();
  }

  generateMap() {
    for (let q = -this.size / 2; q < this.size / 2; q++) {
      for (let r = -this.size / 2; r < this.size / 2; r++) {
        const s = -q - r;
        if (Math.abs(s) < this.size / 2) {
          const tile = this.generateTile(q, r);
          this.tiles.set(this.key(q, r), tile);
        }
      }
    }
    this.placeSpecialTerrain();
    this.generateCurrents();
  }

  key(q, r) {
    return `${q},${r}`;
  }

  getTile(q, r) {
    return this.tiles.get(this.key(q, r));
  }

  generateTile(q, r) {
    const distanceFromCenter = Math.sqrt(q * q + r * r + (q + r) * (q + r)) / this.size;
    let depth = Math.floor(distanceFromCenter * 3500 + Math.random() * 500);
    depth = Math.max(0, Math.min(5000, depth));

    let depthLevel;
    if (depth <= 200) depthLevel = 'SHALLOW';
    else if (depth <= 1000) depthLevel = 'MID';
    else if (depth <= 3000) depthLevel = 'DEEP';
    else depthLevel = 'ABYSS';

    return {
      q,
      r,
      s: -q - r,
      depth,
      depthLevel,
      terrain: 'FLAT',
      explored: new Set(),
      visible: new Set(),
      resources: 0,
      owner: null,
      controlPoints: 0
    };
  }

  placeSpecialTerrain() {
    const tileKeys = Array.from(this.tiles.keys());
    
    for (let i = 0; i < 25; i++) {
      const key = tileKeys[Math.floor(Math.random() * tileKeys.length)];
      const tile = this.tiles.get(key);
      if (tile.depthLevel !== 'SHALLOW' && tile.terrain === 'FLAT') {
        tile.terrain = 'MINERAL';
        tile.resources = 200 + Math.floor(Math.random() * 300);
      }
    }

    for (let i = 0; i < 15; i++) {
      const key = tileKeys[Math.floor(Math.random() * tileKeys.length)];
      const tile = this.tiles.get(key);
      if (tile.depthLevel === 'MID' || tile.depthLevel === 'DEEP') {
        tile.terrain = 'HYDROTHERMAL';
      }
    }

    for (let i = 0; i < 10; i++) {
      const key = tileKeys[Math.floor(Math.random() * tileKeys.length)];
      const tile = this.tiles.get(key);
      if (tile.terrain === 'FLAT' && tile.depthLevel !== 'ABYSS') {
        tile.terrain = 'BIOME';
        tile.resources = 50 + Math.floor(Math.random() * 100);
      }
    }

    for (let i = 0; i < 8; i++) {
      const key = tileKeys[Math.floor(Math.random() * tileKeys.length)];
      const tile = this.tiles.get(key);
      if (tile.depthLevel !== 'SHALLOW') {
        tile.terrain = 'WRECK';
        tile.resources = 30 + Math.floor(Math.random() * 70);
      }
    }

    for (let i = 0; i < 5; i++) {
      const key = tileKeys[Math.floor(Math.random() * tileKeys.length)];
      const tile = this.tiles.get(key);
      if (tile.depthLevel === 'DEEP' || tile.depthLevel === 'ABYSS') {
        tile.terrain = 'RUIN';
        tile.controlPoints = 100;
      }
    }

    for (let i = 0; i < 20; i++) {
      const key = tileKeys[Math.floor(Math.random() * tileKeys.length)];
      const tile = this.tiles.get(key);
      if (tile.terrain === 'FLAT') {
        tile.terrain = 'ROCKY';
      }
    }

    for (let i = 0; i < 6; i++) {
      const key = tileKeys[Math.floor(Math.random() * tileKeys.length)];
      const tile = this.tiles.get(key);
      if (tile.terrain === 'FLAT' && tile.depthLevel !== 'SHALLOW') {
        tile.terrain = 'VOLCANO';
      }
    }
  }

  generateCurrents() {
    const directions = [
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 }
    ];
    
    this.currentDirection = directions[Math.floor(Math.random() * 6)];
    this.currentStrength = 1 + Math.random();
  }

  changeCurrents() {
    const directions = [
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 }
    ];
    this.currentDirection = directions[Math.floor(Math.random() * 6)];
    this.currentStrength = 1 + Math.random();
  }

  getNeighbors(q, r) {
    const directions = [
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 }
    ];
    
    const neighbors = [];
    for (const dir of directions) {
      const key = this.key(q + dir.q, r + dir.r);
      const tile = this.tiles.get(key);
      if (tile) neighbors.push(tile);
    }
    return neighbors;
  }

  getDistance(q1, r1, q2, r2) {
    return Math.max(Math.abs(q1 - q2), Math.abs(r1 - r2), Math.abs((q1 + r1) - (q2 + r2)));
  }

  getTilesInRange(q, r, range) {
    const tiles = [];
    for (let dq = -range; dq <= range; dq++) {
      for (let dr = Math.max(-range, -dq - range); dr <= Math.min(range, -dq + range); dr++) {
        const tile = this.getTile(q + dq, r + dr);
        if (tile) tiles.push(tile);
      }
    }
    return tiles;
  }

  getSpawnPositions(playerCount) {
    const positions = [];
    const angleStep = (2 * Math.PI) / playerCount;
    const radius = Math.floor(this.size * 0.3);

    for (let i = 0; i < playerCount; i++) {
      const angle = i * angleStep;
      const q = Math.round(Math.cos(angle) * radius);
      const r = Math.round(Math.sin(angle) * radius);
      
      let tile = this.getTile(q, r);
      if (!tile || tile.depthLevel !== 'SHALLOW' || tile.terrain !== 'FLAT') {
        const nearby = this.getTilesInRange(q, r, 3);
        const shallowFlats = nearby.filter(t => t.depthLevel === 'SHALLOW' && t.terrain === 'FLAT');
        if (shallowFlats.length > 0) {
          tile = shallowFlats[0];
        }
      }
      positions.push({ q: tile.q, r: tile.r });
    }
    return positions;
  }

  getPublicState(playerId) {
    const publicTiles = {};
    for (const [key, tile] of this.tiles) {
      if (tile.explored.has(playerId) || tile.visible.has(playerId)) {
        publicTiles[key] = {
          q: tile.q,
          r: tile.r,
          depth: tile.depth,
          depthLevel: tile.depthLevel,
          terrain: tile.terrain,
          explored: tile.explored.has(playerId),
          visible: tile.visible.has(playerId),
          resources: tile.resources,
          owner: tile.owner,
          controlPoints: tile.controlPoints
        };
      }
    }
    return publicTiles;
  }
}

module.exports = HexMap;
