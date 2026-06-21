const WebSocket = require('ws');
const roomManager = require('../game/RoomManager');
const turnManager = require('../game/TurnManager');
const { v4: uuidv4 } = require('uuid');

class WebSocketHandler {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.clients = new Map();
    this.setupHandlers();
  }

  setupHandlers() {
    this.wss.on('connection', (ws) => {
      const clientId = uuidv4();
      ws.clientId = clientId;
      this.clients.set(clientId, { ws, playerId: null, roomCode: null });
      
      console.log(`Client connected: ${clientId}`);
      
      this.send(ws, 'connected', { clientId });
      
      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });
      
      ws.on('close', () => {
        this.handleDisconnect(ws);
      });
      
      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error.message);
      });
    });
  }

  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data);
      const { type, payload } = message;
      
      switch (type) {
        case 'join_room':
          this.handleJoinRoom(ws, payload);
          break;
        case 'create_room':
          this.handleCreateRoom(ws, payload);
          break;
        case 'ready':
          this.handleReady(ws, payload);
          break;
        case 'start_game':
          this.handleStartGame(ws);
          break;
        case 'move_submarine':
          this.handleMoveSubmarine(ws, payload);
          break;
        case 'build_submarine':
          this.handleBuildSubmarine(ws, payload);
          break;
        case 'build_module':
          this.handleBuildModule(ws, payload);
          break;
        case 'research':
          this.handleResearch(ws, payload);
          break;
        case 'fire_torpedo':
          this.handleFireTorpedo(ws, payload);
          break;
        case 'set_sonar_mode':
          this.handleSetSonarMode(ws, payload);
          break;
        case 'deploy_sonar_buoy':
          this.handleDeploySonarBuoy(ws, payload);
          break;
        case 'end_turn':
          this.handleEndTurn(ws);
          break;
        case 'get_game_state':
          this.handleGetGameState(ws);
          break;
        case 'leave_room':
          this.handleLeaveRoom(ws);
          break;
        case 'spectate':
          this.handleSpectate(ws, payload);
          break;
        case 'create_alliance':
          this.handleCreateAlliance(ws, payload);
          break;
        case 'apply_alliance':
          this.handleApplyAlliance(ws, payload);
          break;
        case 'accept_alliance_application':
          this.handleAcceptAllianceApplication(ws, payload);
          break;
        case 'reject_alliance_application':
          this.handleRejectAllianceApplication(ws, payload);
          break;
        case 'leave_alliance':
          this.handleLeaveAlliance(ws);
          break;
        case 'kick_alliance_member':
          this.handleKickAllianceMember(ws, payload);
          break;
        case 'transfer_resources':
          this.handleTransferResources(ws, payload);
          break;
        case 'declare_war':
          this.handleDeclareWar(ws, payload);
          break;
        case 'cast_war_vote':
          this.handleCastWarVote(ws, payload);
          break;
        case 'propose_end_war':
          this.handleProposeEndWar(ws);
          break;
        case 'cast_end_war_vote':
          this.handleCastEndWarVote(ws, payload);
          break;
        case 'accept_bounty':
          this.handleAcceptBounty(ws, payload);
          break;
        case 'assist_bounty':
          this.handleAssistBounty(ws, payload);
          break;
        default:
          console.log('Unknown message type:', type);
      }
    } catch (error) {
      console.error('Error handling message:', error.message);
      this.send(ws, 'error', { message: error.message });
    }
  }

  handleCreateRoom(ws, payload) {
    const { playerName, playerCount } = payload;
    const client = this.clients.get(ws.clientId);
    
    const playerId = uuidv4();
    client.playerId = playerId;
    
    const roomCode = roomManager.createRoom(playerId, playerName, playerCount || 4);
    client.roomCode = roomCode;
    
    const room = roomManager.getRoom(roomCode);
    
    this.send(ws, 'room_created', {
      roomCode,
      playerId,
      players: room.players.map(p => ({ id: p.id, name: p.name, isReady: p.isReady }))
    });
    
    this.broadcastRoomState(roomCode);
  }

  handleJoinRoom(ws, payload) {
    const { roomCode, playerName } = payload;
    const client = this.clients.get(ws.clientId);
    
    const playerId = uuidv4();
    client.playerId = playerId;
    client.roomCode = roomCode;
    
    roomManager.joinRoom(roomCode, playerId, playerName);
    const room = roomManager.getRoom(roomCode);
    
    this.send(ws, 'room_joined', {
      roomCode,
      playerId,
      players: room.players.map(p => ({ id: p.id, name: p.name, isReady: p.isReady }))
    });
    
    this.broadcastRoomState(roomCode);
  }

  handleReady(ws, payload) {
    const { isReady } = payload;
    const client = this.clients.get(ws.clientId);
    
    if (!client.playerId || !client.roomCode) return;
    
    roomManager.setPlayerReady(client.playerId, isReady);
    this.broadcastRoomState(client.roomCode);
  }

  handleStartGame(ws) {
    const client = this.clients.get(ws.clientId);
    
    if (!client.roomCode) return;
    
    try {
      const game = roomManager.startGame(client.roomCode);
      
      turnManager.startGameTurns(
        game,
        () => {
          this.broadcastGameState(client.roomCode);
        },
        () => {
          this.broadcastGameState(client.roomCode);
        }
      );
      
      this.broadcastGameState(client.roomCode);
    } catch (error) {
      this.send(ws, 'error', { message: error.message });
    }
  }

  handleMoveSubmarine(ws, payload) {
    const { submarineId, waypoints } = payload;
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    game.setSubmarineWaypoints(gamePlayerId, submarineId, waypoints);
    
    this.broadcastGameState(client.roomCode);
  }

  handleBuildSubmarine(ws, payload) {
    const { type } = payload;
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    const success = game.buildSubmarine(gamePlayerId, type);
    
    if (success) {
      this.send(ws, 'build_success', { type });
    } else {
      this.send(ws, 'error', { message: 'Cannot build submarine' });
    }
    
    this.broadcastGameState(client.roomCode);
  }

  handleBuildModule(ws, payload) {
    const { moduleType } = payload;
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    const success = game.buildModule(gamePlayerId, moduleType);
    
    if (success) {
      this.send(ws, 'build_success', { moduleType });
    } else {
      this.send(ws, 'error', { message: 'Cannot build module' });
    }
    
    this.broadcastGameState(client.roomCode);
  }

  handleResearch(ws, payload) {
    const { techId } = payload;
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    const success = game.startResearch(gamePlayerId, techId);
    
    if (success) {
      this.send(ws, 'research_started', { techId });
    } else {
      this.send(ws, 'error', { message: 'Cannot start research' });
    }
    
    this.broadcastGameState(client.roomCode);
  }

  handleFireTorpedo(ws, payload) {
    const { submarineId, targetId } = payload;
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    game.fireTorpedo(gamePlayerId, submarineId, targetId);
    
    this.broadcastGameState(client.roomCode);
  }

  handleSetSonarMode(ws, payload) {
    const { submarineId, mode } = payload;
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    game.setSonarMode(gamePlayerId, submarineId, mode);
    
    this.broadcastGameState(client.roomCode);
  }

  handleDeploySonarBuoy(ws, payload) {
    const { q, r } = payload;
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    const success = game.deploySonarBuoy(gamePlayerId, q, r);
    
    if (success) {
      this.send(ws, 'buoy_deployed', { q, r });
    } else {
      this.send(ws, 'error', { message: '无法部署声呐浮标（需要附近2格内有潜艇，15矿物，最多10个浮标）' });
    }
    
    this.broadcastGameState(client.roomCode);
  }

  handleEndTurn(ws) {
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const room = roomManager.getRoom(client.roomCode);
    const allReady = room.players.every(p => {
      const gamePlayer = game.getPlayer(p.gamePlayerId);
      return gamePlayer && gamePlayer.isAI ? true : p.isReady;
    });
    
    if (allReady) {
      turnManager.forceEndPlanning(game, () => {
        this.broadcastGameState(client.roomCode);
      });
    }
  }

  handleGetGameState(ws) {
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game) return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    const state = game.getGameState(gamePlayerId);
    
    this.send(ws, 'game_state', state);
  }

  handleLeaveRoom(ws) {
    const client = this.clients.get(ws.clientId);
    
    if (client.roomCode && client.playerId) {
      roomManager.leaveRoom(client.playerId);
      this.broadcastRoomState(client.roomCode);
    }
    
    client.roomCode = null;
    client.playerId = null;
  }

  handleSpectate(ws, payload) {
    const { roomCode, spectatorName } = payload;
    const client = this.clients.get(ws.clientId);
    
    const spectatorId = uuidv4();
    client.playerId = spectatorId;
    client.roomCode = roomCode;
    client.isSpectator = true;
    
    roomManager.addSpectator(roomCode, spectatorId, spectatorName);
    
    const game = roomManager.getGameByPlayer(spectatorId);
    if (game) {
      const firstPlayerId = game.players[0]?.id;
      const state = game.getGameState(firstPlayerId);
      this.send(ws, 'game_state', state);
    }
  }

  handleCreateAlliance(ws, payload) {
    const { name } = payload;
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    const result = game.createAlliance(gamePlayerId, name);
    
    if (result.success) {
      const nameResolver = (id) => {
        const p = game.getPlayer(id);
        return p ? p.name : 'Unknown';
      };
      this.send(ws, 'alliance_created', { alliance: result.alliance.toPublicState(nameResolver) });
    } else {
      this.send(ws, 'error', { message: result.message });
    }
    
    this.broadcastGameState(client.roomCode);
  }

  handleApplyAlliance(ws, payload) {
    const { allianceId } = payload;
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    const result = game.applyToAlliance(gamePlayerId, allianceId);
    
    if (result.success) {
      this.send(ws, 'alliance_applied', { allianceId });
    } else {
      this.send(ws, 'error', { message: result.message });
    }
    
    this.broadcastGameState(client.roomCode);
  }

  handleAcceptAllianceApplication(ws, payload) {
    const { allianceId, applicantId } = payload;
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    const result = game.acceptApplication(gamePlayerId, allianceId, applicantId);
    
    if (result.success) {
      this.send(ws, 'application_accepted', { allianceId, applicantId });
    } else {
      this.send(ws, 'error', { message: result.message });
    }
    
    this.broadcastGameState(client.roomCode);
  }

  handleRejectAllianceApplication(ws, payload) {
    const { allianceId, applicantId } = payload;
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    const result = game.rejectApplication(gamePlayerId, allianceId, applicantId);
    
    if (result.success) {
      this.send(ws, 'application_rejected', { allianceId, applicantId });
    } else {
      this.send(ws, 'error', { message: result.message });
    }
    
    this.broadcastGameState(client.roomCode);
  }

  handleLeaveAlliance(ws) {
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    const result = game.leaveAlliance(gamePlayerId);
    
    if (result.success) {
      this.send(ws, 'alliance_left', {});
    } else {
      this.send(ws, 'error', { message: result.message });
    }
    
    this.broadcastGameState(client.roomCode);
  }

  handleKickAllianceMember(ws, payload) {
    const { allianceId, memberId } = payload;
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    const result = game.kickMember(gamePlayerId, allianceId, memberId);
    
    if (result.success) {
      this.send(ws, 'member_kicked', { allianceId, memberId });
    } else {
      this.send(ws, 'error', { message: result.message });
    }
    
    this.broadcastGameState(client.roomCode);
  }

  handleTransferResources(ws, payload) {
    const { toPlayerId, resources } = payload;
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const fromPlayerId = roomManager.getGamePlayerId(client.playerId);
    const result = game.transferResources(fromPlayerId, toPlayerId, resources);
    
    if (result.success) {
      this.send(ws, 'resources_transferred', { toPlayerId, resources });
    } else {
      this.send(ws, 'error', { message: result.message });
    }
    
    this.broadcastGameState(client.roomCode);
  }

  handleDeclareWar(ws, payload) {
    const { targetAllianceId } = payload;
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    const result = game.declareWar(gamePlayerId, targetAllianceId);
    
    if (result.success) {
      this.send(ws, 'war_declaration_initiated', result);
    } else {
      this.send(ws, 'error', { message: result.message });
    }
    
    this.broadcastGameState(client.roomCode);
  }

  handleCastWarVote(ws, payload) {
    const { voteId, support } = payload;
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    const result = game.castWarVote(gamePlayerId, voteId, support);
    
    if (result.success) {
      this.send(ws, 'war_vote_cast', result);
    } else {
      this.send(ws, 'error', { message: result.message });
    }
    
    this.broadcastGameState(client.roomCode);
  }

  handleProposeEndWar(ws) {
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    const result = game.proposeEndWar(gamePlayerId);
    
    if (result.success) {
      this.send(ws, 'end_war_proposed', result);
    } else {
      this.send(ws, 'error', { message: result.message });
    }
    
    this.broadcastGameState(client.roomCode);
  }

  handleCastEndWarVote(ws, payload) {
    const { voteId, support } = payload;
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    const result = game.castEndWarVote(gamePlayerId, voteId, support);
    
    if (result.success) {
      this.send(ws, 'end_war_vote_cast', result);
    } else {
      this.send(ws, 'error', { message: result.message });
    }
    
    this.broadcastGameState(client.roomCode);
  }

  handleAcceptBounty(ws, payload) {
    const { taskId } = payload;
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    const result = game.acceptBounty(gamePlayerId, taskId);
    
    if (result.success) {
      this.send(ws, 'bounty_accepted', { taskId, task: result.task });
    } else {
      this.send(ws, 'error', { message: result.message });
    }
    
    this.broadcastGameState(client.roomCode);
  }

  handleAssistBounty(ws, payload) {
    const { taskId } = payload;
    const client = this.clients.get(ws.clientId);
    
    const game = roomManager.getGameByPlayer(client.playerId);
    if (!game || game.phase !== 'planning') return;
    
    const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
    const result = game.assistBounty(gamePlayerId, taskId);
    
    if (result.success) {
      this.send(ws, 'bounty_assisted', { taskId });
    } else {
      this.send(ws, 'error', { message: result.message });
    }
    
    this.broadcastGameState(client.roomCode);
  }

  handleDisconnect(ws) {
    const client = this.clients.get(ws.clientId);
    
    if (client) {
      if (client.playerId && client.roomCode && !client.isSpectator) {
        roomManager.handleDisconnect(client.playerId);
        this.broadcastRoomState(client.roomCode);
      }
      
      this.clients.delete(ws.clientId);
    }
    
    console.log(`Client disconnected: ${ws.clientId}`);
  }

  broadcastRoomState(roomCode) {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;
    
    const state = {
      code: room.code,
      playerCount: room.playerCount,
      status: room.status,
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        isReady: p.isReady,
        isConnected: p.isConnected
      })),
      spectators: room.spectators.map(s => ({ id: s.id, name: s.name }))
    };
    
    this.broadcastToRoom(roomCode, 'room_state', state);
  }

  broadcastGameState(roomCode) {
    const room = roomManager.getRoom(roomCode);
    if (!room || !room.game) return;
    
    for (const [clientId, client] of this.clients) {
      if (client.roomCode !== roomCode) continue;
      
      let state;
      if (client.isSpectator) {
        const firstPlayerId = room.game.players[0]?.id;
        state = room.game.getGameState(firstPlayerId);
      } else {
        const gamePlayerId = roomManager.getGamePlayerId(client.playerId);
        if (!gamePlayerId) continue;
        state = room.game.getGameState(gamePlayerId);
      }
      
      this.send(client.ws, 'game_state', state);
    }
  }

  broadcastToRoom(roomCode, type, payload) {
    for (const [clientId, client] of this.clients) {
      if (client.roomCode === roomCode && client.ws.readyState === WebSocket.OPEN) {
        this.send(client.ws, type, payload);
      }
    }
  }

  send(ws, type, payload) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }
}

module.exports = WebSocketHandler;
