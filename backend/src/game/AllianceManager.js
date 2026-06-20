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
    
    this.warState = {
      atWarWith: null,
      warStartTurn: 0
    };
    
    this.activeVotes = new Map();
    
    this.sharedTechs = new Map();
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

  isAtWar() {
    return this.warState.atWarWith !== null;
  }

  getEnemyAllianceId() {
    return this.warState.atWarWith;
  }

  startWar(enemyAllianceId, turn) {
    this.warState.atWarWith = enemyAllianceId;
    this.warState.warStartTurn = turn;
  }

  endWar() {
    this.warState.atWarWith = null;
    this.warState.warStartTurn = 0;
  }

  createVote(voteType, data = {}) {
    const voteId = uuidv4();
    const vote = {
      id: voteId,
      type: voteType,
      data,
      votes: new Map(),
      startTime: Date.now()
    };
    this.activeVotes.set(voteId, vote);
    return voteId;
  }

  getVote(voteId) {
    return this.activeVotes.get(voteId) || null;
  }

  castVote(voteId, playerId, support) {
    const vote = this.activeVotes.get(voteId);
    if (!vote) return false;
    if (!this.isMember(playerId)) return false;
    vote.votes.set(playerId, support);
    return true;
  }

  getVoteResult(voteId) {
    const vote = this.activeVotes.get(voteId);
    if (!vote) return null;
    
    const totalMembers = this.members.length;
    const requiredVotes = Math.ceil(totalMembers * 2 / 3);
    let supportCount = 0;
    
    for (const [playerId, support] of vote.votes) {
      if (support) supportCount++;
    }
    
    return {
      passed: supportCount >= requiredVotes,
      supportCount,
      requiredVotes,
      totalMembers,
      votes: Object.fromEntries(vote.votes)
    };
  }

  removeVote(voteId) {
    return this.activeVotes.delete(voteId);
  }

  addSharedTech(techId, contributorId) {
    this.sharedTechs.set(techId, contributorId);
  }

  removeSharedTech(techId) {
    this.sharedTechs.delete(techId);
  }

  removeSharedTechsByContributor(contributorId) {
    const techsToRemove = [];
    for (const [techId, contributor] of this.sharedTechs) {
      if (contributor === contributorId) {
        techsToRemove.push(techId);
      }
    }
    for (const techId of techsToRemove) {
      this.sharedTechs.delete(techId);
    }
    return techsToRemove;
  }

  getSharedTechs() {
    return Object.fromEntries(this.sharedTechs);
  }

  getTechContributor(techId) {
    return this.sharedTechs.get(techId) || null;
  }

  toPublicState(nameResolver = null) {
    const state = {
      id: this.id,
      name: this.name,
      color: this.color,
      leaderId: this.leaderId,
      members: [...this.members],
      memberCount: this.members.length,
      warState: {
        atWarWith: this.warState.atWarWith,
        warStartTurn: this.warState.warStartTurn
      }
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
      state.activeVotes = Array.from(this.activeVotes.values()).map(v => ({
        id: v.id,
        type: v.type,
        data: v.data,
        votes: Object.fromEntries(v.votes)
      }));
      state.sharedTechs = Object.fromEntries(this.sharedTechs);
      state.techContributions = {};
      for (const [techId, contributorId] of this.sharedTechs) {
        if (!state.techContributions[contributorId]) {
          state.techContributions[contributorId] = [];
        }
        state.techContributions[contributorId].push(techId);
      }
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

  areAtWar(allianceId1, allianceId2) {
    if (!allianceId1 || !allianceId2) return false;
    const alliance1 = this.getAlliance(allianceId1);
    const alliance2 = this.getAlliance(allianceId2);
    if (!alliance1 || !alliance2) return false;
    return alliance1.warState.atWarWith === allianceId2 || 
           alliance2.warState.atWarWith === allianceId1;
  }

  arePlayersAtWar(playerId1, playerId2) {
    const allianceId1 = this.playerAlliances.get(playerId1);
    const allianceId2 = this.playerAlliances.get(playerId2);
    return this.areAtWar(allianceId1, allianceId2);
  }

  declareWar(leaderId, targetAllianceId) {
    const myAlliance = this.getPlayerAlliance(leaderId);
    if (!myAlliance) {
      return { success: false, message: '你不属于任何联盟' };
    }

    if (!myAlliance.isLeader(leaderId)) {
      return { success: false, message: '只有盟主可以宣战' };
    }

    if (myAlliance.isAtWar()) {
      return { success: false, message: '当前联盟已处于战争中，不能同时进行多场战争' };
    }

    const targetAlliance = this.getAlliance(targetAllianceId);
    if (!targetAlliance) {
      return { success: false, message: '目标联盟不存在' };
    }

    if (targetAlliance.isAtWar()) {
      return { success: false, message: '目标联盟已处于战争中' };
    }

    if (targetAlliance.id === myAlliance.id) {
      return { success: false, message: '不能向自己的联盟宣战' };
    }

    const leader = this.game.getPlayer(leaderId);
    if (!leader || leader.base.storage.mineral < 100) {
      return { success: false, message: '矿物不足，宣战需要100矿物' };
    }

    const voteId = myAlliance.createVote('declare_war', {
      targetAllianceId,
      targetAllianceName: targetAlliance.name
    });

    myAlliance.castVote(voteId, leaderId, true);

    const result = myAlliance.getVoteResult(voteId);
    if (result.passed && myAlliance.members.length === 1) {
      this.executeWarDeclaration(myAlliance, targetAlliance, leaderId);
      myAlliance.removeVote(voteId);
      return { success: true, warStarted: true, voteId };
    }

    return { 
      success: true, 
      voteStarted: true, 
      voteId,
      message: '宣战投票已发起，需要2/3以上成员同意才能生效'
    };
  }

  executeWarDeclaration(alliance1, alliance2, initiatorId) {
    const initiator = this.game.getPlayer(initiatorId);
    if (initiator) {
      initiator.base.storage.mineral -= 100;
    }

    alliance1.startWar(alliance2.id, this.game.turn);
    alliance2.startWar(alliance1.id, this.game.turn);

    this.game.eventLog.push({
      type: 'war_declared',
      alliance1Id: alliance1.id,
      alliance1Name: alliance1.name,
      alliance2Id: alliance2.id,
      alliance2Name: alliance2.name,
      turn: this.game.turn,
      message: `联盟「${alliance1.name}」向联盟「${alliance2.name}」宣战！双方进入交战状态`
    });
  }

  castWarVote(playerId, voteId, support) {
    const alliance = this.getPlayerAlliance(playerId);
    if (!alliance) {
      return { success: false, message: '你不属于任何联盟' };
    }

    const vote = alliance.getVote(voteId);
    if (!vote) {
      return { success: false, message: '投票不存在' };
    }

    if (vote.type !== 'declare_war' && vote.type !== 'end_war') {
      return { success: false, message: '无效的投票类型' };
    }

    const result = alliance.castVote(voteId, playerId, support);
    if (!result) {
      return { success: false, message: '投票失败' };
    }

    const voteResult = alliance.getVoteResult(voteId);
    
    if (vote.type === 'declare_war') {
      const allVoted = alliance.members.every(m => vote.votes.has(m));
      if (voteResult.passed || allVoted) {
        if (voteResult.passed) {
          const targetAlliance = this.getAlliance(vote.data.targetAllianceId);
          if (targetAlliance && !targetAlliance.isAtWar()) {
            this.executeWarDeclaration(alliance, targetAlliance, alliance.leaderId);
          }
        }
        alliance.removeVote(voteId);
        return { success: true, voteClosed: true, passed: voteResult.passed };
      }
    }

    return { 
      success: true, 
      voteCounted: true, 
      currentResult: voteResult
    };
  }

  proposeEndWar(leaderId) {
    const myAlliance = this.getPlayerAlliance(leaderId);
    if (!myAlliance) {
      return { success: false, message: '你不属于任何联盟' };
    }

    if (!myAlliance.isLeader(leaderId)) {
      return { success: false, message: '只有盟主可以发起停战投票' };
    }

    if (!myAlliance.isAtWar()) {
      return { success: false, message: '当前联盟未处于战争中' };
    }

    const enemyAllianceId = myAlliance.getEnemyAllianceId();
    const enemyAlliance = this.getAlliance(enemyAllianceId);

    const myVoteId = myAlliance.createVote('end_war', {
      enemyAllianceId,
      enemyAllianceName: enemyAlliance?.name || 'Unknown'
    });

    const enemyVoteId = enemyAlliance?.createVote('end_war', {
      enemyAllianceId: myAlliance.id,
      enemyAllianceName: myAlliance.name
    });

    myAlliance.castVote(myVoteId, leaderId, true);

    const myResult = myAlliance.getVoteResult(myVoteId);
    
    if (myResult.passed && myAlliance.members.length === 1) {
      if (enemyAlliance && enemyAlliance.members.length === 1) {
        this.executeEndWar(myAlliance, enemyAlliance);
        myAlliance.removeVote(myVoteId);
        if (enemyVoteId) enemyAlliance.removeVote(enemyVoteId);
        return { success: true, warEnded: true };
      }
    }

    return {
      success: true,
      voteStarted: true,
      myVoteId,
      enemyVoteId,
      message: '停战投票已发起，需要双方联盟各自2/3以上成员同意才能生效'
    };
  }

  castEndWarVote(playerId, voteId, support) {
    const alliance = this.getPlayerAlliance(playerId);
    if (!alliance) {
      return { success: false, message: '你不属于任何联盟' };
    }

    const vote = alliance.getVote(voteId);
    if (!vote || vote.type !== 'end_war') {
      return { success: false, message: '投票不存在或类型错误' };
    }

    const result = alliance.castVote(voteId, playerId, support);
    if (!result) {
      return { success: false, message: '投票失败' };
    }

    const voteResult = alliance.getVoteResult(voteId);
    const allVoted = alliance.members.every(m => vote.votes.has(m));

    if (voteResult.passed || allVoted) {
      if (voteResult.passed) {
        const enemyAllianceId = vote.data.enemyAllianceId;
        const enemyAlliance = this.getAlliance(enemyAllianceId);
        
        if (enemyAlliance) {
          let enemyPassed = false;
          for (const [enemyVoteId, enemyVote] of enemyAlliance.activeVotes) {
            if (enemyVote.type === 'end_war' && 
                enemyVote.data.enemyAllianceId === alliance.id) {
              const enemyResult = enemyAlliance.getVoteResult(enemyVoteId);
              const enemyAllVoted = enemyAlliance.members.every(m => enemyVote.votes.has(m));
              if (enemyResult.passed || (enemyAllVoted && enemyResult.passed)) {
                enemyPassed = true;
                enemyAlliance.removeVote(enemyVoteId);
                break;
              }
            }
          }
          
          if (enemyPassed || enemyAlliance.members.every(m => {
            for (const [evId, ev] of enemyAlliance.activeVotes) {
              if (ev.type === 'end_war' && ev.data.enemyAllianceId === alliance.id) {
                return ev.votes.has(m);
              }
            }
            return false;
          })) {
            const enemyVoteExists = Array.from(enemyAlliance.activeVotes.values()).some(
              ev => ev.type === 'end_war' && ev.data.enemyAllianceId === alliance.id
            );
            if (!enemyVoteExists) {
              const enemyLeader = this.game.getPlayer(enemyAlliance.leaderId);
              if (enemyLeader) {
                const enemyVoteId = enemyAlliance.createVote('end_war', {
                  enemyAllianceId: alliance.id,
                  enemyAllianceName: alliance.name
                });
                enemyAlliance.castVote(enemyVoteId, enemyAlliance.leaderId, true);
              }
            }
            
            let bothPassed = false;
            for (const [evId, ev] of enemyAlliance.activeVotes) {
              if (ev.type === 'end_war' && ev.data.enemyAllianceId === alliance.id) {
                const er = enemyAlliance.getVoteResult(evId);
                if (er.passed) {
                  bothPassed = true;
                  enemyAlliance.removeVote(evId);
                  break;
                }
              }
            }
            
            if (bothPassed) {
              this.executeEndWar(alliance, enemyAlliance);
            }
          }
        }
      }
      alliance.removeVote(voteId);
      return { success: true, voteClosed: true, passed: voteResult.passed };
    }

    return {
      success: true,
      voteCounted: true,
      currentResult: voteResult
    };
  }

  executeEndWar(alliance1, alliance2) {
    alliance1.endWar();
    alliance2.endWar();

    this.game.eventLog.push({
      type: 'war_ended',
      alliance1Id: alliance1.id,
      alliance1Name: alliance1.name,
      alliance2Id: alliance2.id,
      alliance2Name: alliance2.name,
      turn: this.game.turn,
      message: `联盟「${alliance1.name}」与联盟「${alliance2.name}」达成停战协议，战争结束`
    });
  }

  shareTech(playerId, techId) {
    const alliance = this.getPlayerAlliance(playerId);
    if (!alliance) return false;

    alliance.addSharedTech(techId, playerId);

    for (const memberId of alliance.members) {
      if (memberId !== playerId) {
        const member = this.game.getPlayer(memberId);
        if (member && !member.base.researched.has(techId)) {
        }
      }
    }

    return true;
  }

  updatePlayerEffectiveTechs(playerId) {
    const player = this.game.getPlayer(playerId);
    if (!player) return;

    const alliance = this.getPlayerAlliance(playerId);
    
    player.base.effectiveTechs = new Set(player.base.researched);
    player.base.techSources = {};

    for (const techId of player.base.researched) {
      player.base.techSources[techId] = {
        type: 'self',
        playerId
      };
    }

    if (alliance) {
      for (const [techId, contributorId] of alliance.sharedTechs) {
        if (contributorId !== playerId && !player.base.researched.has(techId)) {
          player.base.effectiveTechs.add(techId);
          player.base.techSources[techId] = {
            type: 'shared',
            playerId: contributorId
          };
        }
      }
    }
  }

  updateAllAllianceMembersTechs(allianceId) {
    const alliance = this.getAlliance(allianceId);
    if (!alliance) return;

    for (const memberId of alliance.members) {
      this.updatePlayerEffectiveTechs(memberId);
    }
  }

  onResearchComplete(playerId, techId) {
    const alliance = this.getPlayerAlliance(playerId);
    if (alliance) {
      this.shareTech(playerId, techId);
      this.updateAllAllianceMembersTechs(alliance.id);
    } else {
      this.updatePlayerEffectiveTechs(playerId);
    }
  }

  onMemberJoined(allianceId, playerId) {
    const alliance = this.getAlliance(allianceId);
    if (!alliance) return;

    const player = this.game.getPlayer(playerId);
    if (player) {
      for (const techId of player.base.researched) {
        alliance.addSharedTech(techId, playerId);
      }
    }

    this.updateAllAllianceMembersTechs(allianceId);
  }

  onMemberLeft(allianceId, playerId) {
    const alliance = this.getAlliance(allianceId);
    if (!alliance) return;

    const removedTechs = alliance.removeSharedTechsByContributor(playerId);
    this.updateAllAllianceMembersTechs(allianceId);

    this.updatePlayerEffectiveTechs(playerId);

    return removedTechs;
  }

  dissolveAlliance(allianceId, reason = 'disbanded') {
    const alliance = this.alliances.get(allianceId);
    if (!alliance) return false;

    if (alliance.isAtWar()) {
      const enemyId = alliance.getEnemyAllianceId();
      const enemy = this.getAlliance(enemyId);
      if (enemy) {
        enemy.endWar();
      }
    }

    for (const memberId of alliance.members) {
      this.playerAlliances.delete(memberId);
      this.updatePlayerEffectiveTechs(memberId);
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
}

module.exports = AllianceManager;
