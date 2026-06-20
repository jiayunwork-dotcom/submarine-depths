const HexMap = require('./HexMap');
const Player = require('./Player');
const CombatSystem = require('./CombatSystem');
const CONFIG = require('./config');
const { v4: uuidv4 } = require('uuid');

class Game {
  constructor(roomCode, playerCount) {
    this.id = uuidv4();
    this.roomCode = roomCode;
    this.playerCount = playerCount;
    this.turn = 0;
    this.phase = 'setup';
    this.players = [];
    this.map = null;
    this.combatLog = [];
    this.eventLog = [];
    this.winner = null;
    this.isFinished = false;
    
    this.planningTimer = CONFIG.PLANNING_TIME;
    this.currentDirection = 0;
  }

  initialize() {
    this.map = new HexMap(CONFIG.MAP_SIZE);
    const spawnPositions = this.map.getSpawnPositions(this.playerCount);
    
    for (let i = 0; i < this.playerCount; i++) {
      const pos = spawnPositions[i];
      const player = new Player(
        uuidv4(),
        `Player ${i + 1}`,
        CONFIG.COLORS[i],
        pos.q,
        pos.r
      );
      this.players.push(player);
      this.map.getTile(pos.q, pos.r).owner = player.id;
      this.updateVisibility(player);
    }
    
    this.phase = 'planning';
  }

  addPlayer(name) {
    if (this.players.length >= this.playerCount) return null;
    
    const index = this.players.length;
    const player = new Player(
      uuidv4(),
      name,
      CONFIG.COLORS[index],
      0,
      0
    );
    
    if (this.map) {
      const spawnPositions = this.map.getSpawnPositions(this.playerCount);
      const pos = spawnPositions[index];
      player.base.q = pos.q;
      player.base.r = pos.r;
      for (const sub of player.submarines) {
        sub.q = pos.q;
        sub.r = pos.r;
      }
    }
    
    this.players.push(player);
    return player;
  }

  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  updateVisibility(player) {
    for (const [key, tile] of this.map.tiles) {
      tile.visible.delete(player.id);
    }
    
    const baseRange = player.base.getSonarRange();
    const baseTiles = this.map.getTilesInRange(player.base.q, player.base.r, baseRange);
    for (const tile of baseTiles) {
      tile.explored.add(player.id);
      tile.visible.add(player.id);
    }
    
    for (const sub of player.submarines) {
      if (sub.status === 'sunk' || sub.status === 'adrift') continue;
      
      const range = sub.sonarMode === 'active' ? sub.sonarRange : Math.ceil(sub.sonarRange / 2);
      const tiles = this.map.getTilesInRange(sub.q, sub.r, range);
      for (const tile of tiles) {
        tile.explored.add(player.id);
        tile.visible.add(player.id);
      }
    }
    
    for (const buoy of player.sonarBuoys) {
      const buoyTiles = this.map.getTilesInRange(buoy.q, buoy.r, buoy.range);
      for (const tile of buoyTiles) {
        tile.explored.add(player.id);
        tile.visible.add(player.id);
      }
    }
  }

  startPlanningPhase() {
    this.phase = 'planning';
    this.planningTimer = CONFIG.PLANNING_TIME;
    
    for (const player of this.players) {
      for (const sub of player.submarines) {
        if (sub.status !== 'sunk') {
          sub.resetTurn();
        }
      }
    }
    
    for (const player of this.players) {
      if (player.isAI && !player.isDefeated) {
        this.executeAITurn(player);
      }
    }
  }

  executePhase() {
    this.phase = 'execution';
    this.eventLog = [];
    this.combatLog = [];
    
    this.processSubmarineMovements();
    this.processResourceGathering();
    this.processBaseProduction();
    this.processCombat();
    this.processPressureDamage();
    this.processRandomEvents();
    
    if (this.turn % CONFIG.CURRENT_CHANGE_INTERVAL === 0) {
      this.map.changeCurrents();
      this.eventLog.push({
        type: 'current_change',
        turn: this.turn,
        message: '洋流方向发生了变化'
      });
    }
    
    for (const player of this.players) {
      this.updateVisibility(player);
      player.calculateScore(this.map);
    }
  }

  getMovementCost(fromQ, fromR, toQ, toR) {
    const dq = toQ - fromQ;
    const dr = toR - fromR;
    const current = this.map.currentDirection;
    if (!current) return 1;
    const dot = dq * current.q + dr * current.r;
    if (dot > 0) return 0;
    if (dot < 0) return 2;
    return 1;
  }

  processSubmarineMovements() {
    for (const player of this.players) {
      if (player.isDefeated) continue;
      
      for (const sub of player.submarines) {
        if (sub.status === 'sunk' || sub.status === 'adrift') continue;
        
        if (sub.waypoints && sub.waypoints.length > 0) {
          let totalMoved = 0;
          while (sub.waypoints.length > 0 && totalMoved < 100) {
            const next = sub.waypoints[0];
            const tile = this.map.getTile(next.q, next.r);
            
            if (!tile) {
              sub.waypoints.shift();
              continue;
            }
            
            if (!sub.canDive(tile.depth)) {
              this.eventLog.push({
                type: 'move_blocked',
                submarine: sub.id,
                reason: 'depth',
                message: `${CONFIG.SUBMARINE_TYPES[sub.type].name} 无法下潜至 ${tile.depth}m`
              });
              sub.waypoints = [];
              break;
            }

            const moveCost = this.getMovementCost(sub.q, sub.r, next.q, next.r);

            if (moveCost === 0) {
              sub.q = next.q;
              sub.r = next.r;
              sub.consumeEnergy(1);
              sub.waypoints.shift();
              this.eventLog.push({
                type: 'current_boost',
                submarine: sub.id,
                turn: this.turn,
                message: `${CONFIG.SUBMARINE_TYPES[sub.type].name} 顺流移动！额外前进2格`
              });
              totalMoved++;
            } else if (moveCost === 2) {
              if (sub.movementLeft < 2) {
                this.eventLog.push({
                  type: 'current_resist',
                  submarine: sub.id,
                  turn: this.turn,
                  message: `${CONFIG.SUBMARINE_TYPES[sub.type].name} 逆流移动受阻，移动力不足`
                });
                sub.waypoints = [];
                break;
              }
              sub.q = next.q;
              sub.r = next.r;
              sub.movementLeft -= 2;
              sub.consumeEnergy(1);
              sub.waypoints.shift();
              this.eventLog.push({
                type: 'current_resist',
                submarine: sub.id,
                turn: this.turn,
                message: `${CONFIG.SUBMARINE_TYPES[sub.type].name} 逆流移动，消耗2点移动力`
              });
              totalMoved++;
            } else {
              if (sub.movementLeft < 1) {
                sub.waypoints = [];
                break;
              }
              sub.q = next.q;
              sub.r = next.r;
              sub.movementLeft -= 1;
              sub.consumeEnergy(1);
              sub.waypoints.shift();
              totalMoved++;
            }
            
            if (sub.status === 'adrift') break;
          }
        }
        
        if (sub.status === 'adrift') {
          this.floatUp(sub);
        }
      }
    }
  }

  floatUp(sub) {
    const currentTile = this.map.getTile(sub.q, sub.r);
    if (!currentTile) return;
    
    if (currentTile.depthLevel === 'SHALLOW') {
      sub.status = 'idle';
      sub.energy = 10;
    }
  }

  processResourceGathering() {
    for (const player of this.players) {
      if (player.isDefeated) continue;
      
      for (const sub of player.submarines) {
        if (sub.status === 'sunk' || sub.status === 'adrift') continue;
        
        const tile = this.map.getTile(sub.q, sub.r);
        if (!tile) continue;
        
        if (tile.terrain === 'MINERAL' && tile.resources > 0 && sub.type === 'MINER') {
          const mineAmount = Math.min(10 * sub.miningEfficiency, tile.resources);
          const actualMined = sub.addCargo('mineral', mineAmount);
          tile.resources -= actualMined;
        }
        
        if (tile.terrain === 'BIOME' && tile.resources > 0 && sub.type === 'SCIENCE') {
          const sampleAmount = Math.min(5 * sub.scienceBonus, tile.resources);
          const actualSampled = sub.addCargo('bio_sample', sampleAmount);
          tile.resources -= actualSampled;
        }
        
        if (tile.terrain === 'WRECK' && tile.resources > 0 && sub.type === 'SCIENCE') {
          const relicAmount = Math.min(3 * sub.scienceBonus, tile.resources);
          const actualFound = sub.addCargo('relic', relicAmount);
          tile.resources -= actualFound;
        }
        
        const distToBase = this.map.getDistance(sub.q, sub.r, player.base.q, player.base.r);
        if (distToBase === 0 || distToBase === 1) {
          const unloaded = sub.unloadCargo();
          player.base.addResources(unloaded);
          
          if (sub.hull < sub.maxHull) {
            sub.repair(10);
          }
          sub.refuel(20);
        }
      }
    }
  }

  processBaseProduction() {
    for (const player of this.players) {
      if (player.isDefeated) continue;
      
      const completedTech = player.base.processResearch();
      if (completedTech) {
        this.eventLog.push({
          type: 'research_complete',
          player: player.id,
          tech: completedTech,
          message: `${player.name} 完成了 ${CONFIG.RESEARCH_TECHS[completedTech].name} 研究`
        });
      }
      
      if (player.base.modules.ECO_POD) {
        player.base.storage.bio_sample += player.base.modules.ECO_POD * 5;
      }
      
      if (player.base.buildQueue.length > 0 && player.base.modules.DOCK > 0) {
        const currentBuild = player.base.buildQueue[0];
        currentBuild.progress += player.base.modules.DOCK;
        
        if (currentBuild.progress >= currentBuild.buildTime) {
          player.addSubmarine(currentBuild.type);
          player.base.buildQueue.shift();
          
          this.eventLog.push({
            type: 'submarine_built',
            player: player.id,
            submarineType: currentBuild.type,
            message: `${player.name} 建造了新的 ${CONFIG.SUBMARINE_TYPES[currentBuild.type].name}`
          });
        }
      }
    }
  }

  processCombat() {
    const combatEvents = CombatSystem.processCombat(this.players, this.map);
    this.combatLog.push(...combatEvents);
    
    for (const player of this.players) {
      player.submarines = player.submarines.filter(s => s.status !== 'sunk');
    }
    
    for (const player of this.players) {
      if (player.isDefeated) continue;
      if (player.base.coreHealth <= 0) {
        player.isDefeated = true;
        this.eventLog.push({
          type: 'player_defeated',
          player: player.id,
          message: `${player.name} 的基地被摧毁了！`
        });
      }
    }
  }

  processPressureDamage() {
    for (const player of this.players) {
      for (const sub of player.submarines) {
        if (sub.status === 'sunk') continue;
        
        const tile = this.map.getTile(sub.q, sub.r);
        if (!tile) continue;
        
        if (sub.hull < sub.maxHull * 0.5 && tile.depthLevel !== 'SHALLOW') {
          const pressureDamage = CONFIG.DEPTH_LEVELS[tile.depthLevel].pressure * 2;
          sub.damage(pressureDamage);
        }
      }
    }
  }

  processRandomEvents() {
    const eventChance = 0.15;
    if (Math.random() > eventChance) return;
    
    const events = [
      { type: 'earthquake', message: '海底地震！部分潜艇受到冲击' },
      { type: 'giant_creature', message: '巨型生物出没！声呐受到干扰' },
      { type: 'volcanic_eruption', message: '海底火山喷发！' }
    ];
    
    const event = events[Math.floor(Math.random() * events.length)];
    event.turn = this.turn;
    this.eventLog.push(event);
    
    if (event.type === 'earthquake') {
      for (const player of this.players) {
        for (const sub of player.submarines) {
          if (sub.status !== 'sunk' && Math.random() < 0.3) {
            sub.damage(5);
          }
        }
      }
    }
  }

  endTurn() {
    this.turn++;
    
    const alivePlayers = this.players.filter(p => !p.isDefeated);
    if (alivePlayers.length <= 1) {
      this.endGame(alivePlayers[0] || null);
      return;
    }
    
    if (this.turn >= CONFIG.MAX_TURNS) {
      const winner = this.players.reduce((best, p) => 
        p.score > best.score ? p : best
      , this.players[0]);
      this.endGame(winner);
      return;
    }
    
    this.startPlanningPhase();
  }

  endGame(winner) {
    this.isFinished = true;
    this.winner = winner;
    this.phase = 'ended';
  }

  executeAITurn(player) {
    for (const sub of player.submarines) {
      if (sub.status === 'sunk' || sub.status === 'adrift') continue;
      
      if (sub.type === 'MINER' || sub.type === 'TRANSPORT') {
        if (sub.getCargoTotal() >= sub.maxCargo * 0.8) {
          this.navigateToBase(sub, player);
        } else {
          this.navigateToNearestResource(sub, player);
        }
      } else if (sub.type === 'SCOUT') {
        this.randomScout(sub, player);
      }
    }
  }

  navigateToBase(sub, player) {
    sub.waypoints = this.findPath(sub.q, sub.r, player.base.q, player.base.r);
  }

  navigateToNearestResource(sub, player) {
    let nearest = null;
    let nearestDist = Infinity;
    
    for (const [key, tile] of this.map.tiles) {
      if (tile.terrain === 'MINERAL' && tile.resources > 0) {
        const dist = this.map.getDistance(sub.q, sub.r, tile.q, tile.r);
        if (dist < nearestDist && sub.canDive(tile.depth)) {
          nearestDist = dist;
          nearest = tile;
        }
      }
    }
    
    if (nearest) {
      sub.waypoints = this.findPath(sub.q, sub.r, nearest.q, nearest.r);
    }
  }

  randomScout(sub, player) {
    const neighbors = this.map.getNeighbors(sub.q, sub.r);
    const valid = neighbors.filter(t => sub.canDive(t.depth));
    if (valid.length > 0) {
      const target = valid[Math.floor(Math.random() * valid.length)];
      sub.waypoints = [{ q: target.q, r: target.r }];
    }
  }

  findPath(q1, r1, q2, r2) {
    const path = [];
    let currentQ = q1;
    let currentR = r1;
    
    while (currentQ !== q2 || currentR !== r2) {
      const dq = Math.sign(q2 - currentQ);
      const dr = Math.sign(r2 - currentR);
      
      if (dq !== 0) currentQ += dq;
      else if (dr !== 0) currentR += dr;
      
      path.push({ q: currentQ, r: currentR });
      
      if (path.length > 50) break;
    }
    
    return path;
  }

  setSubmarineWaypoints(playerId, subId, waypoints) {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    
    const sub = player.getSubmarine(subId);
    if (!sub || sub.status === 'sunk') return false;
    
    sub.waypoints = waypoints;
    return true;
  }

  buildSubmarine(playerId, type) {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    
    const template = CONFIG.SUBMARINE_TYPES[type];
    if (!template) return false;
    
    if (!player.base.canAfford(template.cost)) return false;
    if (player.submarines.length >= player.base.getMaxSubmarines()) return false;
    
    player.base.payCost(template.cost);
    player.base.buildQueue.push({
      type,
      buildTime: template.buildTime,
      progress: 0
    });
    
    return true;
  }

  buildModule(playerId, moduleType) {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    return player.base.buildModule(moduleType);
  }

  startResearch(playerId, techId) {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    return player.base.startResearch(techId);
  }

  fireTorpedo(playerId, subId, targetId) {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    
    const sub = player.getSubmarine(subId);
    if (!sub || sub.type !== 'COMBAT' || sub.status === 'sunk') return false;
    
    if (!sub.actions) sub.actions = [];
    sub.actions.push({ type: 'fire_torpedo', targetId });
    
    return true;
  }

  setSonarMode(playerId, subId, mode) {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    
    const sub = player.getSubmarine(subId);
    if (!sub || sub.status === 'sunk') return false;
    
    sub.sonarMode = mode;
    return true;
  }

  deploySonarBuoy(playerId, q, r) {
    const player = this.getPlayer(playerId);
    if (!player) return false;
    
    const tile = this.map.getTile(q, r);
    if (!tile) return false;
    
    if (player.sonarBuoys.length >= 10) return false;
    
    if (player.base.storage.mineral < 15) return false;
    
    let subNearby = false;
    for (const sub of player.submarines) {
      const dist = this.map.getDistance(sub.q, sub.r, q, r);
      if (dist <= 2 && sub.status !== 'sunk' && sub.status !== 'adrift') {
        subNearby = true;
        break;
      }
    }
    if (!subNearby) return false;
    
    player.base.storage.mineral -= 15;
    
    player.sonarBuoys.push({
      id: uuidv4(),
      q,
      r,
      range: 3,
      placedTurn: this.turn
    });
    
    this.updateVisibility(player);
    
    return true;
  }

  getGameState(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) return null;
    
    return {
      gameId: this.id,
      roomCode: this.roomCode,
      turn: this.turn,
      phase: this.phase,
      planningTimer: this.planningTimer,
      playerCount: this.playerCount,
      currentPlayer: player.toPrivateState(),
      players: this.players.map(p => p.toPublicState()),
      map: this.map.getPublicState(playerId),
      combatLog: this.combatLog,
      eventLog: this.eventLog,
      winner: this.winner ? this.winner.id : null,
      isFinished: this.isFinished,
      currentDirection: this.map ? this.map.currentDirection : null
    };
  }
}

module.exports = Game;
