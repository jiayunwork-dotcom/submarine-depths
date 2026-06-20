const HexMap = require('./HexMap');
const Player = require('./Player');
const CombatSystem = require('./CombatSystem');
const AllianceManager = require('./AllianceManager');
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
    this.ruins = [];
    this.scoreRankings = [];
    this.allianceManager = null;
    
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
    }

    this.allianceManager = new AllianceManager(this);

    for (const player of this.players) {
      this.updateVisibility(player);
    }

    this.ruins = [];
    for (const [key, tile] of this.map.tiles) {
      if (tile.terrain === 'RUIN' && tile.ruin) {
        this.ruins.push({ q: tile.q, r: tile.r });
      }
    }
    
    this.updateScoreRankings();
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
    
    this.addVisibilityForPlayer(player);

    if (this.allianceManager) {
      const alliance = this.allianceManager.getPlayerAlliance(player.id);
      if (alliance) {
        for (const allyId of alliance.members) {
          if (allyId !== player.id) {
            const ally = this.getPlayer(allyId);
            if (ally && !ally.isDefeated) {
              this.addVisibilityForPlayer(ally, player.id);
            }
          }
        }
      }
    }
  }

  addVisibilityForPlayer(sourcePlayer, targetPlayerId = null) {
    const playerId = targetPlayerId || sourcePlayer.id;
    
    const baseRange = sourcePlayer.base.getSonarRange();
    const baseTiles = this.map.getTilesInRange(sourcePlayer.base.q, sourcePlayer.base.r, baseRange);
    for (const tile of baseTiles) {
      tile.explored.add(playerId);
      tile.visible.add(playerId);
    }
    
    for (const sub of sourcePlayer.submarines) {
      if (sub.status === 'sunk' || sub.status === 'adrift') continue;
      
      const range = sub.sonarMode === 'active' ? sub.sonarRange : Math.ceil(sub.sonarRange / 2);
      const tiles = this.map.getTilesInRange(sub.q, sub.r, range);
      for (const tile of tiles) {
        tile.explored.add(playerId);
        tile.visible.add(playerId);
      }
    }
    
    for (const buoy of sourcePlayer.sonarBuoys) {
      const buoyTiles = this.map.getTilesInRange(buoy.q, buoy.r, buoy.range);
      for (const tile of buoyTiles) {
        tile.explored.add(playerId);
        tile.visible.add(playerId);
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
    this.processRuinExcavation();
    this.processCombat();
    this.processRuinExcavationInterrupt();
    this.processRuinProduction();
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

    this.updateScoreRankings();
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
    const combatEvents = CombatSystem.processCombat(this.players, this.map, this.allianceManager);
    this.combatLog.push(...combatEvents);
    
    for (const event of combatEvents) {
      if (event.type === 'torpedo_hit' && this.allianceManager) {
        const alertedAllies = this.allianceManager.checkAllyUnderAttack(
          event.targetPlayerId,
          event.attackerPlayerId
        );
        for (const allyId of alertedAllies) {
          this.eventLog.push({
            type: 'ally_under_attack',
            targetPlayerId: event.targetPlayerId,
            attackerPlayerId: event.attackerPlayerId,
            alertFor: allyId,
            turn: this.turn,
            message: `你的盟友遭到攻击！`
          });
        }
      }
    }
    
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

  processRuinExcavation() {
    const excavationCandidates = [];

    for (const player of this.players) {
      if (player.isDefeated) continue;
      for (const sub of player.submarines) {
        if (sub.status === 'sunk' || sub.status === 'adrift') continue;
        if (sub.type !== 'SCIENCE') continue;

        const tile = this.map.getTile(sub.q, sub.r);
        if (!tile || tile.terrain !== 'RUIN' || !tile.ruin) continue;

        excavationCandidates.push({ sub, player, tile, order: excavationCandidates.length });
      }
    }

    for (const { sub, player, tile } of excavationCandidates) {
      const ruin = tile.ruin;

      if (ruin.status === 'excavating' && ruin.excavatorId === sub.id) {
        if (ruin.excavatorPlayerId !== player.id) continue;
        ruin.progress += 1;
        if (ruin.progress >= CONFIG.RUIN_EXCAVATION_TURNS) {
          ruin.status = 'captured';
          ruin.ownerId = player.id;
          ruin.excavatorId = null;
          ruin.excavatorPlayerId = null;
          ruin.progress = 0;
          tile.owner = player.id;
          this.eventLog.push({
            type: 'ruin_captured',
            player: player.id,
            q: tile.q,
            r: tile.r,
            turn: this.turn,
            message: `${player.name} 成功占领了深海遗迹 (${tile.q}, ${tile.r})！`
          });
        } else {
          this.eventLog.push({
            type: 'ruin_excavating',
            player: player.id,
            q: tile.q,
            r: tile.r,
            progress: ruin.progress,
            turn: this.turn,
            message: `${player.name} 正在发掘遗迹 (${tile.q}, ${tile.r})：${ruin.progress}/${CONFIG.RUIN_EXCAVATION_TURNS}`
          });
        }
        continue;
      }

      if (ruin.status === 'idle' || (ruin.status === 'captured' && ruin.ownerId !== player.id)) {
        if (ruin.status === 'excavating') continue;

        const existingExcavator = excavationCandidates.find(
          c => c.tile === tile && c.sub !== sub && c.player !== player
        );
        if (existingExcavator && existingExcavator.order < excavationCandidates.findIndex(c => c.sub === sub)) {
          continue;
        }

        ruin.status = 'excavating';
        ruin.excavatorId = sub.id;
        ruin.excavatorPlayerId = player.id;
        ruin.progress = 1;
        if (ruin.ownerId && ruin.ownerId !== player.id) {
          ruin.ownerId = null;
          tile.owner = null;
        }
        this.eventLog.push({
          type: 'ruin_excavation_start',
          player: player.id,
          q: tile.q,
          r: tile.r,
          turn: this.turn,
          message: `${player.name} 开始发掘遗迹 (${tile.q}, ${tile.r})`
        });
      }
    }
  }

  processRuinExcavationInterrupt() {
    const sunkSubIds = new Set();
    for (const event of this.combatLog) {
      if (event.type === 'torpedo_hit' && event.targetDestroyed) {
        sunkSubIds.add(event.target);
      }
    }

    for (const ruinInfo of this.ruins) {
      const tile = this.map.getTile(ruinInfo.q, ruinInfo.r);
      if (!tile || !tile.ruin) continue;
      const ruin = tile.ruin;

      if (ruin.status === 'excavating' && ruin.excavatorId) {
        if (sunkSubIds.has(ruin.excavatorId)) {
          this.eventLog.push({
            type: 'ruin_excavation_interrupted',
            player: ruin.excavatorPlayerId,
            q: tile.q,
            r: tile.r,
            turn: this.turn,
            message: `遗迹 (${tile.q}, ${tile.r}) 的发掘因科考艇被击毁而中断！`
          });
          ruin.status = ruin.ownerId ? 'captured' : 'idle';
          ruin.excavatorId = null;
          ruin.excavatorPlayerId = null;
          ruin.progress = 0;
          continue;
        }

        const excavatorPlayer = this.getPlayer(ruin.excavatorPlayerId);
        let excavatorStillThere = false;
        if (excavatorPlayer) {
          const sub = excavatorPlayer.getSubmarine(ruin.excavatorId);
          if (sub && sub.status !== 'sunk' && sub.status !== 'adrift' && sub.q === tile.q && sub.r === tile.r) {
            excavatorStillThere = true;
          }
        }
        if (!excavatorStillThere) {
          this.eventLog.push({
            type: 'ruin_excavation_interrupted',
            player: ruin.excavatorPlayerId,
            q: tile.q,
            r: tile.r,
            turn: this.turn,
            message: `遗迹 (${tile.q}, ${tile.r}) 的发掘因科考艇离开而中断`
          });
          ruin.status = ruin.ownerId ? 'captured' : 'idle';
          ruin.excavatorId = null;
          ruin.excavatorPlayerId = null;
          ruin.progress = 0;
        }
      }
    }
  }

  processRuinProduction() {
    for (const ruinInfo of this.ruins) {
      const tile = this.map.getTile(ruinInfo.q, ruinInfo.r);
      if (!tile || !tile.ruin) continue;
      const ruin = tile.ruin;

      if (ruin.status === 'captured' && ruin.ownerId) {
        const player = this.getPlayer(ruin.ownerId);
        if (player && !player.isDefeated) {
          player.base.techPoints += CONFIG.RUIN_TECH_PER_TURN;
          this.eventLog.push({
            type: 'ruin_tech_production',
            player: player.id,
            q: tile.q,
            r: tile.r,
            techPoints: CONFIG.RUIN_TECH_PER_TURN,
            turn: this.turn,
            message: `${player.name} 从遗迹 (${tile.q}, ${tile.r}) 获得 ${CONFIG.RUIN_TECH_PER_TURN} 科技点`
          });
        }
      }
    }
  }

  calculatePlayerTechScore(player) {
    return player.base.techPoints;
  }

  calculatePlayerResourceScore(player) {
    const mineralScore = Math.floor(player.base.storage.mineral / 10);
    const bioScore = Math.floor(player.base.storage.bio_sample / 5);
    return mineralScore + bioScore;
  }

  calculatePlayerRuinScore(player) {
    let count = 0;
    for (const ruinInfo of this.ruins) {
      const tile = this.map.getTile(ruinInfo.q, ruinInfo.r);
      if (tile && tile.ruin && tile.ruin.status === 'captured' && tile.ruin.ownerId === player.id) {
        count++;
      }
    }
    return count * CONFIG.RUIN_SCORE_PER_RUIN;
  }

  updateScoreRankings() {
    const rankings = this.players.map(player => {
      const techScore = this.calculatePlayerTechScore(player);
      const resourceScore = this.calculatePlayerResourceScore(player);
      const ruinScore = this.calculatePlayerRuinScore(player);
      const totalScore = techScore + resourceScore + ruinScore;

      return {
        playerId: player.id,
        name: player.name,
        color: player.color,
        techScore,
        resourceScore,
        ruinScore,
        totalScore,
        isDefeated: player.isDefeated,
        baseQ: player.base.q,
        baseR: player.base.r
      };
    });

    rankings.sort((a, b) => b.totalScore - a.totalScore);
    this.scoreRankings = rankings;
  }

  getAllRuinsState() {
    return this.ruins.map(ruinInfo => {
      const tile = this.map.getTile(ruinInfo.q, ruinInfo.r);
      if (!tile || !tile.ruin) return null;
      return {
        q: tile.q,
        r: tile.r,
        status: tile.ruin.status,
        ownerId: tile.ruin.ownerId,
        excavatorPlayerId: tile.ruin.excavatorPlayerId,
        progress: tile.ruin.progress,
        maxProgress: CONFIG.RUIN_EXCAVATION_TURNS
      };
    }).filter(Boolean);
  }

  endTurn() {
    this.turn++;
    
    if (this.allianceManager) {
      this.allianceManager.processTurnEnd();
    }
    
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
    
    const getPlayerAllianceInfo = (pid) => {
      if (!this.allianceManager) return null;
      const alliance = this.allianceManager.getPlayerAlliance(pid);
      if (!alliance) return null;
      return {
        allianceId: alliance.id,
        allianceName: alliance.name,
        allianceColor: alliance.color
      };
    };
    
    return {
      gameId: this.id,
      roomCode: this.roomCode,
      turn: this.turn,
      phase: this.phase,
      planningTimer: this.planningTimer,
      playerCount: this.playerCount,
      currentPlayer: {
        ...player.toPrivateState(),
        ...getPlayerAllianceInfo(playerId)
      },
      players: this.players.map(p => ({
        ...p.toPublicState(),
        ...getPlayerAllianceInfo(p.id)
      })),
      map: this.map.getPublicState(playerId),
      combatLog: this.combatLog,
      eventLog: this.eventLog,
      winner: this.winner ? this.winner.id : null,
      isFinished: this.isFinished,
      currentDirection: this.map ? this.map.currentDirection : null,
      ruins: this.getAllRuinsState(),
      scoreRankings: this.scoreRankings,
      alliances: this.allianceManager ? this.allianceManager.getStateForPlayer(playerId) : null
    };
  }

  createAlliance(playerId, name) {
    if (!this.allianceManager) return { success: false, message: '联盟系统未初始化' };
    const result = this.allianceManager.createAlliance(playerId, name);
    if (result.success) {
      for (const p of this.players) {
        this.updateVisibility(p);
      }
    }
    return result;
  }

  applyToAlliance(playerId, allianceId) {
    if (!this.allianceManager) return { success: false, message: '联盟系统未初始化' };
    return this.allianceManager.applyToAlliance(playerId, allianceId);
  }

  acceptApplication(leaderId, allianceId, applicantId) {
    if (!this.allianceManager) return { success: false, message: '联盟系统未初始化' };
    const result = this.allianceManager.acceptApplication(leaderId, allianceId, applicantId);
    if (result.success) {
      for (const p of this.players) {
        this.updateVisibility(p);
      }
    }
    return result;
  }

  rejectApplication(leaderId, allianceId, applicantId) {
    if (!this.allianceManager) return { success: false, message: '联盟系统未初始化' };
    return this.allianceManager.rejectApplication(leaderId, allianceId, applicantId);
  }

  leaveAlliance(playerId) {
    if (!this.allianceManager) return { success: false, message: '联盟系统未初始化' };
    const result = this.allianceManager.leaveAlliance(playerId);
    if (result.success) {
      for (const p of this.players) {
        this.updateVisibility(p);
      }
    }
    return result;
  }

  kickMember(leaderId, allianceId, memberId) {
    if (!this.allianceManager) return { success: false, message: '联盟系统未初始化' };
    const result = this.allianceManager.kickMember(leaderId, allianceId, memberId);
    if (result.success) {
      for (const p of this.players) {
        this.updateVisibility(p);
      }
    }
    return result;
  }

  transferResources(fromPlayerId, toPlayerId, resources) {
    if (!this.allianceManager) return { success: false, message: '联盟系统未初始化' };
    return this.allianceManager.createTransportMission(fromPlayerId, toPlayerId, resources);
  }
}

module.exports = Game;
