const { v4: uuidv4 } = require('uuid');
const CONFIG = require('./config');

const ALLIANCE_COLORS = [
  '#ff6b6b',
  '#4ecdc4',
  '#ffe66d',
  '#95e1d3',
  '#f38181',
  '#aa96da',
  '#fcbad3',
  '#a8d8ea'
];

class Alliance {
  constructor(id, name, color, founderId) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.founderId = founderId;
    this.leaderId = founderId;
    this.members = [founderId];
    this.pendingApplications = [];
    this.createdTurn = 0;
    this.lastMemberJoinedTurn = 0;
  }

  isLeader(playerId) {
    return this.leaderId === playerId;
  }

  isMember(playerId) {
    return this.members.includes(playerId);
  }

  hasPendingApplication(playerId) {
    return this.pendingApplications.includes(playerId);
  }

  addMember(playerId) {
    if (this.members.length >= 3) return false;
    if (this.isMember(playerId)) return false;
    this.members.push(playerId);
    this.pendingApplications = this.pendingApplications.filter(id => id !== playerId);
    return true;
  }

  removeMember(playerId) {
    const index = this.members.indexOf(playerId);
    if (index === -1) return false;
    this.members.splice(index, 1);
    
    if (this.members.length > 0 && this.leaderId === playerId) {
      this.leaderId = this.members[0];
    }
    
    return true;
  }

  addApplication(playerId) {
    if (this.isMember(playerId)) return false;
    if (this.hasPendingApplication(playerId)) return false;
    if (this.members.length >= 3) return false;
    this.pendingApplications.push(playerId);
    return true;
  }

  removeApplication(playerId) {
    const index = this.pendingApplications.indexOf(playerId);
    if (index === -1) return false;
    this.pendingApplications.splice(index, 1);
    return true;
  }

  getMemberCount() {
    return this.members.length;
  }

  isFull() {
    return this.members.length >= 3;
  }

  toPublicState(nameResolver = null) {
    const state = {
      id: this.id,
      name: this.name,
      color: this.color,
      leaderId: this.leaderId,
      members: [...this.members],
      memberCount: this.members.length
    };
    if (nameResolver) {
      state.memberNames = {};
      for (const memberId of this.members) {
        state.memberNames[memberId] = nameResolver(memberId);
      }
      state.leaderName = nameResolver(this.leaderId);
    }
    return state;
  }

  toPrivateState(playerId, nameResolver = null) {
    const state = this.toPublicState(nameResolver);
    if (this.isMember(playerId)) {
      state.pendingApplications = [...this.pendingApplications];
      if (nameResolver) {
        state.pendingApplicationNames = {};
        for (const appId of this.pendingApplications) {
          state.pendingApplicationNames[appId] = nameResolver(appId);
        }
      }
    }
    return state;
  }
}

class AllianceManager {
  constructor(game) {
    this.game = game;
    this.alliances = new Map();
    this.playerAlliances = new Map();
    this.usedColors = new Set();
    this.transportMissions = [];
  }

  getAvailableColor() {
    for (const color of ALLIANCE_COLORS) {
      if (!this.usedColors.has(color)) {
        return color;
      }
    }
    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    return randomColor;
  }

  createAlliance(playerId, name) {
    if (this.playerAlliances.has(playerId)) {
      return { success: false, message: '你已经属于一个联盟了' };
    }

    if (!name || name.length > 12 || name.length < 1) {
      return { success: false, message: '联盟名称长度必须在1-12字符之间' };
    }

    const player = this.game.getPlayer(playerId);
    if (!player) {
      return { success: false, message: '玩家不存在' };
    }

    if (player.base.storage.mineral < 50) {
      return { success: false, message: '矿物不足，需要50矿物创建联盟' };
    }

    for (const alliance of this.alliances.values()) {
      if (alliance.name === name) {
        return { success: false, message: '联盟名称已存在' };
      }
    }

    player.base.storage.mineral -= 50;

    const id = uuidv4();
    const color = this.getAvailableColor();
    this.usedColors.add(color);

    const alliance = new Alliance(id, name, color, playerId);
    alliance.createdTurn = this.game.turn;
    alliance.lastMemberJoinedTurn = this.game.turn;

    this.alliances.set(id, alliance);
    this.playerAlliances.set(playerId, id);

    this.game.eventLog.push({
      type: 'alliance_created',
      allianceId: id,
      allianceName: name,
      founderId: playerId,
      founderName: player.name,
      turn: this.game.turn,
      message: `${player.name} 创建了联盟「${name}」`
    });

    return { success: true, alliance };
  }

  dissolveAlliance(allianceId, reason = 'disbanded') {
    const alliance = this.alliances.get(allianceId);
    if (!alliance) return false;

    for (const memberId of alliance.members) {
      this.playerAlliances.delete(memberId);
    }

    this.usedColors.delete(alliance.color);
    this.alliances.delete(allianceId);

    const leader = this.game.getPlayer(alliance.leaderId);
    this.game.eventLog.push({
      type: 'alliance_dissolved',
      allianceId: allianceId,
      allianceName: alliance.name,
      reason: reason,
      turn: this.game.turn,
      message: `联盟「${alliance.name}」已解散`
    });

    return true;
  }

  applyToAlliance(playerId, allianceId) {
    if (this.playerAlliances.has(playerId)) {
      return { success: false, message: '你已经属于一个联盟了' };
    }

    const alliance = this.alliances.get(allianceId);
    if (!alliance) {
      return { success: false, message: '联盟不存在' };
    }

    if (alliance.isFull()) {
      return { success: false, message: '联盟已满员' };
    }

    const player = this.game.getPlayer(playerId);
    if (!player) {
      return { success: false, message: '玩家不存在' };
    }

    const result = alliance.addApplication(playerId);
    if (!result) {
      return { success: false, message: '申请失败' };
    }

    return { success: true, message: '申请已提交' };
  }

  acceptApplication(leaderId, allianceId, applicantId) {
    const alliance = this.alliances.get(allianceId);
    if (!alliance) {
      return { success: false, message: '联盟不存在' };
    }

    if (!alliance.isLeader(leaderId)) {
      return { success: false, message: '只有盟主可以审批申请' };
    }

    if (!alliance.hasPendingApplication(applicantId)) {
      return { success: false, message: '没有该申请' };
    }

    if (alliance.isFull()) {
      return { success: false, message: '联盟已满员' };
    }

    const applicant = this.game.getPlayer(applicantId);
    if (!applicant) {
      return { success: false, message: '申请人不存在' };
    }

    const result = alliance.addMember(applicantId);
    if (!result) {
      return { success: false, message: '添加成员失败' };
    }

    this.playerAlliances.set(applicantId, allianceId);
    alliance.lastMemberJoinedTurn = this.game.turn;

    this.game.eventLog.push({
      type: 'alliance_member_joined',
      allianceId: allianceId,
      allianceName: alliance.name,
      playerId: applicantId,
      playerName: applicant.name,
      turn: this.game.turn,
      message: `${applicant.name} 加入了联盟「${alliance.name}」`
    });

    return { success: true };
  }

  rejectApplication(leaderId, allianceId, applicantId) {
    const alliance = this.alliances.get(allianceId);
    if (!alliance) {
      return { success: false, message: '联盟不存在' };
    }

    if (!alliance.isLeader(leaderId)) {
      return { success: false, message: '只有盟主可以拒绝申请' };
    }

    alliance.removeApplication(applicantId);
    return { success: true };
  }

  leaveAlliance(playerId) {
    const allianceId = this.playerAlliances.get(playerId);
    if (!allianceId) {
      return { success: false, message: '你不属于任何联盟' };
    }

    const alliance = this.alliances.get(allianceId);
    if (!alliance) {
      this.playerAlliances.delete(playerId);
      return { success: true };
    }

    const player = this.game.getPlayer(playerId);
    const wasLeader = alliance.isLeader(playerId);

    if (wasLeader) {
      this.dissolveAlliance(allianceId, 'leader_left');
      return { success: true };
    }

    const result = alliance.removeMember(playerId);
    if (!result) {
      return { success: false, message: '退出失败' };
    }

    this.playerAlliances.delete(playerId);

    this.game.eventLog.push({
      type: 'alliance_member_left',
      allianceId: allianceId,
      allianceName: alliance.name,
      playerId: playerId,
      playerName: player ? player.name : 'Unknown',
      wasLeader: false,
      turn: this.game.turn,
      message: `${player ? player.name : 'Unknown'} 退出了联盟「${alliance.name}」`
    });

    return { success: true };
  }

  kickMember(leaderId, allianceId, memberId) {
    const alliance = this.alliances.get(allianceId);
    if (!alliance) {
      return { success: false, message: '联盟不存在' };
    }

    if (!alliance.isLeader(leaderId)) {
      return { success: false, message: '只有盟主可以踢出成员' };
    }

    if (!alliance.isMember(memberId)) {
      return { success: false, message: '该玩家不是联盟成员' };
    }

    if (leaderId === memberId) {
      return { success: false, message: '不能踢出自己' };
    }

    const member = this.game.getPlayer(memberId);
    const result = alliance.removeMember(memberId);
    if (!result) {
      return { success: false, message: '踢出失败' };
    }

    this.playerAlliances.delete(memberId);

    this.game.eventLog.push({
      type: 'alliance_member_kicked',
      allianceId: allianceId,
      allianceName: alliance.name,
      playerId: memberId,
      playerName: member ? member.name : 'Unknown',
      turn: this.game.turn,
      message: `${member ? member.name : 'Unknown'} 被踢出了联盟「${alliance.name}」`
    });

    return { success: true };
  }

  getPlayerAlliance(playerId) {
    const allianceId = this.playerAlliances.get(playerId);
    if (!allianceId) return null;
    return this.alliances.get(allianceId) || null;
  }

  getAlliance(allianceId) {
    return this.alliances.get(allianceId) || null;
  }

  areAllied(playerId1, playerId2) {
    if (playerId1 === playerId2) return true;
    const allianceId1 = this.playerAlliances.get(playerId1);
    const allianceId2 = this.playerAlliances.get(playerId2);
    return allianceId1 && allianceId2 && allianceId1 === allianceId2;
  }

  getAllAlliances() {
    return Array.from(this.alliances.values());
  }

  getAlliancesForPlayer(playerId) {
    return this.getAllAlliances().filter(a => !a.isMember(playerId) && !a.isFull());
  }

  processTurnEnd() {
    const alliancesToDissolve = [];
    
    for (const alliance of this.alliances.values()) {
      if (alliance.getMemberCount() === 1) {
        const turnsSinceLastJoin = this.game.turn - alliance.lastMemberJoinedTurn;
        if (turnsSinceLastJoin >= 10) {
          alliancesToDissolve.push(alliance.id);
        }
      }
    }

    for (const allianceId of alliancesToDissolve) {
      this.dissolveAlliance(allianceId, 'inactivity');
    }

    this.processTransportMissions();
  }

  createTransportMission(fromPlayerId, toPlayerId, resources) {
    const fromAlliance = this.getPlayerAlliance(fromPlayerId);
    const toAlliance = this.getPlayerAlliance(toPlayerId);

    if (!fromAlliance || !toAlliance || fromAlliance.id !== toAlliance.id) {
      return { success: false, message: '只能向盟友传输资源' };
    }

    const fromPlayer = this.game.getPlayer(fromPlayerId);
    const toPlayer = this.game.getPlayer(toPlayerId);

    if (!fromPlayer || !toPlayer) {
      return { success: false, message: '玩家不存在' };
    }

    const transportSub = fromPlayer.submarines.find(s => 
      s.type === 'TRANSPORT' && s.status !== 'sunk' && s.status !== 'adrift'
    );

    if (!transportSub) {
      return { success: false, message: '需要运输艇才能传输资源' };
    }

    const distToBase = this.game.map.getDistance(
      transportSub.q, transportSub.r,
      toPlayer.base.q, toPlayer.base.r
    );

    if (distToBase > 1) {
      return { success: false, message: '运输艇需要到达盟友基地1格范围内才能交接' };
    }

    for (const [type, amount] of Object.entries(resources)) {
      if (!fromPlayer.base.storage[type] || fromPlayer.base.storage[type] < amount) {
        return { success: false, message: `${type} 资源不足` };
      }
    }

    for (const [type, amount] of Object.entries(resources)) {
      fromPlayer.base.storage[type] -= amount;
      toPlayer.base.addResources({ [type]: amount });
    }

    this.game.eventLog.push({
      type: 'resource_transfer',
      fromPlayerId: fromPlayerId,
      fromPlayerName: fromPlayer.name,
      toPlayerId: toPlayerId,
      toPlayerName: toPlayer.name,
      resources: resources,
      turn: this.game.turn,
      message: `${fromPlayer.name} 向 ${toPlayer.name} 传输了资源`
    });

    return { success: true };
  }

  processTransportMissions() {
    
  }

  getStateForPlayer(playerId) {
    const playerAlliance = this.getPlayerAlliance(playerId);
    const nameResolver = (id) => {
      const p = this.game.getPlayer(id);
      return p ? p.name : 'Unknown';
    };
    
    return {
      myAlliance: playerAlliance ? playerAlliance.toPrivateState(playerId, nameResolver) : null,
      availableAlliances: this.getAlliancesForPlayer(playerId).map(a => a.toPublicState(nameResolver)),
      allAlliances: this.getAllAlliances().map(a => a.toPublicState(nameResolver))
    };
  }

  checkAllyUnderAttack(attackedPlayerId, attackerPlayerId) {
    const alliance = this.getPlayerAlliance(attackedPlayerId);
    if (!alliance) return [];

    const alertedAllies = [];
    for (const memberId of alliance.members) {
      if (memberId !== attackedPlayerId) {
        alertedAllies.push(memberId);
      }
    }

    return alertedAllies;
  }
}

module.exports = AllianceManager;
