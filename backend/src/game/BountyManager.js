const { v4: uuidv4 } = require('uuid');
const CONFIG = require('./config');

const BOUNTY_TYPES = {
  MINING: {
    name: '采矿任务',
    icon: '⛏️',
    description: '在指定坐标采集{amount}单位矿物'
  },
  SCOUT: {
    name: '侦察任务',
    icon: '🔍',
    description: '让潜艇到达指定未探索坐标({q},{r})'
  },
  COMBAT: {
    name: '战斗任务',
    icon: '⚔️',
    description: '击沉任意1艘敌方潜艇'
  },
  RUIN: {
    name: '遗迹任务',
    icon: '🏛️',
    description: '占领指定遗迹点({q},{r})'
  }
};

const REWARD_TYPES = ['mineral', 'bio_sample', 'techPoints'];

const REWARD_NAMES = {
  mineral: '矿物',
  bio_sample: '生物样本',
  techPoints: '科技点'
};

const DIFFICULTY_LEVELS = [
  { name: '简单', multiplier: 1.0, timeLimit: 8 },
  { name: '普通', multiplier: 1.5, timeLimit: 6 },
  { name: '困难', multiplier: 2.0, timeLimit: 5 }
];

class BountyManager {
  constructor(game) {
    this.game = game;
    this.taskPool = [];
    this.playerTasks = new Map();
    this.playerTaskAssists = new Map();
    this.lastRefreshTurn = 0;
    this.mineralSnapshots = new Map();
    this.submarinePreStates = new Map();
    this.subTaskMinerals = new Map();
  }

  snapshotMinerals() {
    this.mineralSnapshots.clear();
    for (const player of this.game.players) {
      this.mineralSnapshots.set(player.id, player.base.storage.mineral);
    }
  }

  snapshotSubmarines() {
    this.submarinePreStates.clear();
    for (const player of this.game.players) {
      for (const sub of player.submarines) {
        this.submarinePreStates.set(sub.id, {
          q: sub.q,
          r: sub.r,
          cargoMineral: sub.cargo.mineral
        });
      }
    }
  }

  refreshTaskPool() {
    const poolSize = this.taskPool.filter(t => t.status === 'available').length;
    const slotsAvailable = CONFIG.BOUNTY.MAX_POOL_SIZE - poolSize;

    if (slotsAvailable <= 0) return;

    const toGenerate = Math.min(CONFIG.BOUNTY.TASKS_PER_REFRESH, slotsAvailable);
    const newTasks = [];

    for (let i = 0; i < toGenerate; i++) {
      const task = this.generateTask();
      if (task) {
        newTasks.push(task);
      }
    }

    this.taskPool.push(...newTasks);

    while (this.taskPool.filter(t => t.status === 'available').length > CONFIG.BOUNTY.MAX_POOL_SIZE) {
      const oldestAvailable = this.taskPool
        .filter(t => t.status === 'available')
        .sort((a, b) => a.createdTurn - b.createdTurn)[0];
      if (oldestAvailable) {
        oldestAvailable.status = 'expired';
      } else {
        break;
      }
    }

    if (newTasks.length > 0) {
      this.game.eventLog.push({
        type: 'bounty_refreshed',
        turn: this.game.turn,
        count: newTasks.length,
        message: `深海悬赏任务已刷新！新增${newTasks.length}个任务`
      });
    }
  }

  generateTask() {
    const typeKeys = Object.keys(BOUNTY_TYPES);
    const typeKey = typeKeys[Math.floor(Math.random() * typeKeys.length)];
    const difficulty = DIFFICULTY_LEVELS[Math.floor(Math.random() * DIFFICULTY_LEVELS.length)];

    let targetQ = null;
    let targetR = null;
    let targetAmount = 1;
    let description = '';

    switch (typeKey) {
      case 'MINING': {
        const mineralTiles = [];
        for (const [key, tile] of this.game.map.tiles) {
          if (tile.terrain === 'MINERAL' && tile.resources > 0) {
            mineralTiles.push(tile);
          }
        }
        if (mineralTiles.length === 0) return null;
        const target = mineralTiles[Math.floor(Math.random() * mineralTiles.length)];
        targetQ = target.q;
        targetR = target.r;
        targetAmount = Math.floor(10 + 10 * difficulty.multiplier);
        description = `在坐标(${targetQ},${targetR})附近采集${targetAmount}单位矿物并运回基地`;
        break;
      }
      case 'SCOUT': {
        const unexploredTiles = [];
        for (const [key, tile] of this.game.map.tiles) {
          if (tile.terrain !== 'FLAT' && tile.depthLevel !== 'ABYSS') {
            unexploredTiles.push(tile);
          }
        }
        if (unexploredTiles.length === 0) return null;
        const target = unexploredTiles[Math.floor(Math.random() * unexploredTiles.length)];
        targetQ = target.q;
        targetR = target.r;
        description = `派遣潜艇到达坐标(${targetQ},${targetR})进行侦察`;
        break;
      }
      case 'COMBAT': {
        targetAmount = 1;
        description = '击沉任意1艘敌方潜艇';
        break;
      }
      case 'RUIN': {
        const ruinTiles = this.game.ruins.filter(r => {
          const tile = this.game.map.getTile(r.q, r.r);
          return tile && tile.ruin;
        });
        if (ruinTiles.length === 0) return null;
        const target = ruinTiles[Math.floor(Math.random() * ruinTiles.length)];
        targetQ = target.q;
        targetR = target.r;
        description = `占领位于坐标(${targetQ},${targetR})的遗迹点`;
        break;
      }
    }

    const rewardType = REWARD_TYPES[Math.floor(Math.random() * REWARD_TYPES.length)];
    const baseReward = CONFIG.BOUNTY.BASE_REWARDS[rewardType];
    const rewardAmount = Math.floor(baseReward * difficulty.multiplier);

    const task = {
      id: uuidv4(),
      type: typeKey,
      typeName: BOUNTY_TYPES[typeKey].name,
      typeIcon: BOUNTY_TYPES[typeKey].icon,
      description,
      difficulty: difficulty.name,
      difficultyMultiplier: difficulty.multiplier,
      targetQ,
      targetR,
      targetAmount,
      reward: {
        type: rewardType,
        typeName: REWARD_NAMES[rewardType],
        amount: rewardAmount
      },
      timeLimit: difficulty.timeLimit,
      status: 'available',
      createdTurn: this.game.turn,
      acceptedTurn: null,
      deadlineTurn: null,
      progress: 0,
      acceptedBy: null,
      assistants: []
    };

    return task;
  }

  acceptTask(playerId, taskId) {
    const task = this.taskPool.find(t => t.id === taskId && t.status === 'available');
    if (!task) {
      return { success: false, message: '任务不存在或已被接取' };
    }

    const playerTasks = this.getPlayerActiveTasks(playerId);
    if (playerTasks.length >= CONFIG.BOUNTY.MAX_PLAYER_TASKS) {
      return { success: false, message: `最多同时持有${CONFIG.BOUNTY.MAX_PLAYER_TASKS}个任务` };
    }

    task.status = 'in_progress';
    task.acceptedBy = playerId;
    task.acceptedTurn = this.game.turn;
    task.deadlineTurn = this.game.turn + task.timeLimit;

    if (!this.playerTasks.has(playerId)) {
      this.playerTasks.set(playerId, []);
    }
    this.playerTasks.get(playerId).push(task);

    const player = this.game.getPlayer(playerId);
    this.game.eventLog.push({
      type: 'bounty_accepted',
      playerId,
      playerName: player ? player.name : 'Unknown',
      taskId: task.id,
      taskType: task.typeName,
      turn: this.game.turn,
      message: `${player ? player.name : 'Unknown'} 接取了悬赏任务：${task.description}`
    });

    return { success: true, task };
  }

  assistTask(playerId, taskId) {
    const task = this.taskPool.find(t => t.id === taskId && t.status === 'in_progress');
    if (!task) {
      return { success: false, message: '任务不存在或不在进行中' };
    }

    if (task.acceptedBy === playerId) {
      return { success: false, message: '不能协助自己的任务' };
    }

    if (!this.game.allianceManager) {
      return { success: false, message: '联盟系统未初始化' };
    }

    const areAllied = this.game.allianceManager.areAllied(playerId, task.acceptedBy);
    if (!areAllied) {
      return { success: false, message: '只能协助盟友的任务' };
    }

    if (task.assistants.includes(playerId)) {
      return { success: false, message: '你已在协助此任务' };
    }

    task.assistants.push(playerId);

    if (!this.playerTaskAssists.has(playerId)) {
      this.playerTaskAssists.set(playerId, []);
    }
    this.playerTaskAssists.get(playerId).push(taskId);

    const player = this.game.getPlayer(playerId);
    const taskOwner = this.game.getPlayer(task.acceptedBy);
    this.game.eventLog.push({
      type: 'bounty_assisted',
      playerId,
      playerName: player ? player.name : 'Unknown',
      taskOwnerId: task.acceptedBy,
      taskOwnerName: taskOwner ? taskOwner.name : 'Unknown',
      taskId: task.id,
      taskType: task.typeName,
      turn: this.game.turn,
      message: `${player ? player.name : 'Unknown'} 协助了盟友 ${taskOwner ? taskOwner.name : 'Unknown'} 的悬赏任务`
    });

    return { success: true };
  }

  checkProgress() {
    const completedTasks = [];
    const failedTasks = [];

    for (const [playerId, tasks] of this.playerTasks) {
      const player = this.game.getPlayer(playerId);
      if (!player || player.isDefeated) continue;

      for (const task of tasks) {
        if (task.status !== 'in_progress') continue;

        if (this.game.turn > task.deadlineTurn) {
          task.status = 'failed';
          failedTasks.push(task);
          continue;
        }

        const prevProgress = task.progress;
        this.updateTaskProgress(task, player);

        if (task.progress >= task.targetAmount) {
          task.status = 'completed';
          this.grantReward(task, player);
          completedTasks.push(task);
        }
      }
    }

    for (const task of failedTasks) {
      const player = this.game.getPlayer(task.acceptedBy);
      if (player) {
        const penalty = CONFIG.BOUNTY.FAILURE_PENALTY;
        const actualPenalty = Math.min(penalty, player.base.storage.mineral);
        player.base.storage.mineral = Math.max(0, player.base.storage.mineral - penalty);
        task.penaltyApplied = actualPenalty;
        this.game.eventLog.push({
          type: 'bounty_failed',
          playerId: task.acceptedBy,
          playerName: player.name,
          taskId: task.id,
          taskType: task.typeName,
          penalty: actualPenalty,
          turn: this.game.turn,
          message: `${player.name} 的悬赏任务「${task.description}」超时失败，扣除${actualPenalty}矿物违约金`
        });
      }
    }

    for (const task of completedTasks) {
      const player = this.game.getPlayer(task.acceptedBy);
      if (player) {
        this.game.eventLog.push({
          type: 'bounty_completed',
          playerId: task.acceptedBy,
          playerName: player.name,
          taskId: task.id,
          taskType: task.typeName,
          reward: task.reward,
          turn: this.game.turn,
          message: `${player.name} 完成了悬赏任务「${task.description}」！获得${task.reward.typeName}×${task.reward.amount}`
        });
      }
    }

    this.cleanupTasks();
  }

  updateTaskProgress(task, player) {
    const allPlayerIds = [player.id, ...task.assistants];

    switch (task.type) {
      case 'MINING': {
        for (const pid of allPlayerIds) {
          const p = this.game.getPlayer(pid);
          if (!p) continue;

          for (const sub of p.submarines) {
            if (sub.status === 'sunk' || sub.status === 'adrift') continue;

            const preState = this.submarinePreStates.get(sub.id);
            if (!preState) continue;

            const prevCargo = preState.cargoMineral;
            const currCargo = sub.cargo.mineral;

            if (currCargo > prevCargo) {
              const mined = currCargo - prevCargo;
              const dist = this.game.map.getDistance(sub.q, sub.r, task.targetQ, task.targetR);
              const tile = this.game.map.getTile(sub.q, sub.r);
              if (dist <= 3 && sub.type === 'MINER' && tile && tile.terrain === 'MINERAL' && tile.resources >= 0) {
                this.addSubTaskMineral(sub.id, task.id, mined);
              }
            }

            if (currCargo < prevCargo && prevCargo > 0) {
              const lostRatio = (prevCargo - currCargo) / prevCargo;
              const taskMineralBefore = this.getSubTaskMineral(sub.id, task.id);
              const taskMineralLost = Math.floor(taskMineralBefore * lostRatio);
              if (taskMineralLost > 0) {
                this.setSubTaskMineral(sub.id, task.id, taskMineralBefore - taskMineralLost);
                const distToBase = this.game.map.getDistance(sub.q, sub.r, p.base.q, p.base.r);
                if (distToBase <= 1) {
                  task.progress = Math.min(task.targetAmount, task.progress + taskMineralLost);
                }
              }
            }
          }
        }
        break;
      }
      case 'SCOUT': {
        for (const pid of allPlayerIds) {
          const p = this.game.getPlayer(pid);
          if (!p) continue;
          const tile = this.game.map.getTile(task.targetQ, task.targetR);
          if (tile && tile.explored.has(pid)) {
            task.progress = task.targetAmount;
            break;
          }
        }
        break;
      }
      case 'COMBAT': {
        for (const event of this.game.combatLog) {
          if (event.type === 'torpedo_hit' && event.targetDestroyed) {
            if (allPlayerIds.includes(event.attackerPlayerId)) {
              if (!event._bountyChecked) {
                task.progress = task.targetAmount;
                event._bountyChecked = true;
                break;
              }
            }
          }
        }
        break;
      }
      case 'RUIN': {
        const tile = this.game.map.getTile(task.targetQ, task.targetR);
        if (tile && tile.ruin) {
          if (tile.ruin.status === 'captured' && tile.ruin.ownerId === player.id) {
            task.progress = task.targetAmount;
          }
          for (const assistantId of task.assistants) {
            if (tile.ruin.status === 'captured' && tile.ruin.ownerId === assistantId) {
              task.progress = task.targetAmount;
              break;
            }
          }
        }
        break;
      }
    }
  }

  grantReward(task, player) {
    let bonusMultiplier = 1.0;

    if (this.game.allianceManager) {
      const alliance = this.game.allianceManager.getPlayerAlliance(player.id);
      if (alliance) {
        bonusMultiplier = 1.0 + CONFIG.BOUNTY.ALLIANCE_BONUS;
      }
    }

    const finalAmount = Math.floor(task.reward.amount * bonusMultiplier);

    switch (task.reward.type) {
      case 'mineral':
        player.base.storage.mineral += finalAmount;
        break;
      case 'bio_sample':
        player.base.storage.bio_sample += finalAmount;
        break;
      case 'techPoints':
        player.base.techPoints += finalAmount;
        break;
    }

    task.reward.actualAmount = finalAmount;
    task.reward.allianceBonus = bonusMultiplier > 1.0;
  }

  cleanupTasks() {
    for (const [playerId, tasks] of this.playerTasks) {
      this.playerTasks.set(playerId, tasks.filter(t => t.status === 'in_progress'));
    }

    this.taskPool = this.taskPool.filter(t => t.status === 'available' || t.status === 'in_progress');

    for (const [playerId, taskIds] of this.playerTaskAssists) {
      const activeIds = taskIds.filter(tid => {
        const task = this.taskPool.find(t => t.id === tid);
        return task && task.status === 'in_progress';
      });
      this.playerTaskAssists.set(playerId, activeIds);
    }
  }

  processTurnEnd() {
    if (this.game.turn === 1 || (this.game.turn - this.lastRefreshTurn) >= CONFIG.BOUNTY.REFRESH_INTERVAL) {
      this.refreshTaskPool();
      this.lastRefreshTurn = this.game.turn;
    }

    this.checkProgress();
  }

  preExecution() {
    this.snapshotMinerals();
    this.snapshotSubmarines();
  }

  getSubTaskMineral(subId, taskId) {
    const subMap = this.subTaskMinerals.get(subId);
    return subMap ? (subMap.get(taskId) || 0) : 0;
  }

  addSubTaskMineral(subId, taskId, amount) {
    if (!this.subTaskMinerals.has(subId)) {
      this.subTaskMinerals.set(subId, new Map());
    }
    const subMap = this.subTaskMinerals.get(subId);
    const current = subMap.get(taskId) || 0;
    subMap.set(taskId, current + amount);
  }

  setSubTaskMineral(subId, taskId, amount) {
    if (!this.subTaskMinerals.has(subId)) {
      this.subTaskMinerals.set(subId, new Map());
    }
    this.subTaskMinerals.get(subId).set(taskId, Math.max(0, amount));
  }

  getPlayerActiveTasks(playerId) {
    const tasks = this.playerTasks.get(playerId) || [];
    return tasks.filter(t => t.status === 'in_progress');
  }

  getPlayerCompletedTasks(playerId) {
    const tasks = this.playerTasks.get(playerId) || [];
    return tasks.filter(t => t.status === 'completed' || t.status === 'failed');
  }

  getAssistedTasks(playerId) {
    const taskIds = this.playerTaskAssists.get(playerId) || [];
    return taskIds
      .map(tid => this.taskPool.find(t => t.id === tid))
      .filter(t => t && t.status === 'in_progress');
  }

  getAvailableTasks() {
    return this.taskPool.filter(t => t.status === 'available');
  }

  getAllianceMemberTasks(playerId) {
    if (!this.game.allianceManager) return [];
    const alliance = this.game.allianceManager.getPlayerAlliance(playerId);
    if (!alliance) return [];

    const result = [];
    for (const memberId of alliance.members) {
      if (memberId === playerId) continue;
      const memberTasks = this.getPlayerActiveTasks(memberId);
      for (const task of memberTasks) {
        result.push({ ...task, ownerPlayerId: memberId, ownerName: this.game.getPlayer(memberId)?.name || 'Unknown' });
      }
    }
    return result;
  }

  getStateForPlayer(playerId) {
    return {
      availableTasks: this.getAvailableTasks().map(t => this.taskToPublicState(t)),
      myTasks: this.getPlayerActiveTasks(playerId).map(t => this.taskToPrivateState(t)),
      myCompletedTasks: this.getPlayerCompletedTasks(playerId).map(t => ({
        id: t.id,
        type: t.type,
        typeName: t.typeName,
        typeIcon: t.typeIcon,
        description: t.description,
        status: t.status,
        reward: t.reward,
        penaltyApplied: t.penaltyApplied || 0
      })),
      assistedTasks: this.getAssistedTasks(playerId).map(t => this.taskToPrivateState(t)),
      allyTasks: this.getAllianceMemberTasks(playerId),
      bountyTargets: this.getBountyTargetCoords(playerId)
    };
  }

  getBountyTargetCoords(playerId) {
    const targets = [];
    const myTasks = this.getPlayerActiveTasks(playerId);
    for (const task of myTasks) {
      if (task.targetQ !== null && task.targetR !== null) {
        targets.push({ q: task.targetQ, r: task.targetR, type: task.type, taskId: task.id });
      }
    }
    const assistedTasks = this.getAssistedTasks(playerId);
    for (const task of assistedTasks) {
      if (task.targetQ !== null && task.targetR !== null) {
        targets.push({ q: task.targetQ, r: task.targetR, type: task.type, taskId: task.id });
      }
    }
    return targets;
  }

  taskToPublicState(task) {
    return {
      id: task.id,
      type: task.type,
      typeName: task.typeName,
      typeIcon: task.typeIcon,
      description: task.description,
      difficulty: task.difficulty,
      targetQ: task.targetQ,
      targetR: task.targetR,
      targetAmount: task.targetAmount,
      reward: task.reward,
      timeLimit: task.timeLimit,
      status: task.status,
      createdTurn: task.createdTurn
    };
  }

  taskToPrivateState(task) {
    return {
      ...this.taskToPublicState(task),
      acceptedTurn: task.acceptedTurn,
      deadlineTurn: task.deadlineTurn,
      progress: task.progress,
      acceptedBy: task.acceptedBy,
      assistants: task.assistants
    };
  }
}

module.exports = BountyManager;
