const Game = require('../game/Game');
const CONFIG = require('../game/config');
const { setWithExpiry, getValue, deleteValue } = require('../models/redisClient');
const { v4: uuidv4 } = require('uuid');

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.playerToRoom = new Map();
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  createRoom(hostId, hostName, playerCount) {
    if (playerCount < CONFIG.MIN_PLAYERS || playerCount > CONFIG.MAX_PLAYERS) {
      throw new Error(`Player count must be between ${CONFIG.MIN_PLAYERS} and ${CONFIG.MAX_PLAYERS}`);
    }

    const roomCode = this.generateRoomCode();
    const room = {
      code: roomCode,
      playerCount,
      players: [],
      hostId: hostId,
      status: 'waiting',
      game: null,
      readyPlayers: new Set(),
      spectators: [],
      createdAt: Date.now()
    };

    this.rooms.set(roomCode, room);
    this.addPlayer(roomCode, hostId, hostName);
    
    return roomCode;
  }

  joinRoom(roomCode, playerId, playerName) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.status !== 'waiting') {
      throw new Error('Game already started');
    }

    if (room.players.length >= room.playerCount) {
      throw new Error('Room is full');
    }

    this.addPlayer(roomCode, playerId, playerName);
    return room;
  }

  addPlayer(roomCode, playerId, playerName) {
    const room = this.rooms.get(roomCode);
    const player = {
      id: playerId,
      name: playerName,
      isReady: false,
      isConnected: true,
      disconnectTimer: 0
    };
    room.players.push(player);
    this.playerToRoom.set(playerId, roomCode);
  }

  leaveRoom(playerId) {
    const roomCode = this.playerToRoom.get(playerId);
    if (!roomCode) return;

    const room = this.rooms.get(roomCode);
    if (!room) return;

    const index = room.players.findIndex(p => p.id === playerId);
    if (index !== -1) {
      room.players.splice(index, 1);
    }

    this.playerToRoom.delete(playerId);

    if (room.players.length === 0) {
      this.rooms.delete(roomCode);
    }
  }

  setPlayerReady(playerId, isReady) {
    const roomCode = this.playerToRoom.get(playerId);
    if (!roomCode) return false;

    const room = this.rooms.get(roomCode);
    const player = room.players.find(p => p.id === playerId);
    if (!player) return false;

    player.isReady = isReady;
    return true;
  }

  canStartGame(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== 'waiting') return false;
    if (room.players.length < CONFIG.MIN_PLAYERS) return false;
    return room.players.every(p => p.isReady);
  }

  startGame(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room not found');
    if (!this.canStartGame(roomCode)) throw new Error('Cannot start game');

    const game = new Game(roomCode, room.playerCount);
    game.initialize();

    for (let i = 0; i < room.players.length; i++) {
      const roomPlayer = room.players[i];
      const gamePlayer = game.players[i];
      gamePlayer.name = roomPlayer.name;
      roomPlayer.gamePlayerId = gamePlayer.id;
    }

    room.game = game;
    room.status = 'playing';

    return game;
  }

  getRoom(roomCode) {
    return this.rooms.get(roomCode);
  }

  getRoomByPlayer(playerId) {
    const roomCode = this.playerToRoom.get(playerId);
    if (!roomCode) return null;
    return this.rooms.get(roomCode);
  }

  getGameByPlayer(playerId) {
    const room = this.getRoomByPlayer(playerId);
    if (!room) return null;
    return room.game;
  }

  getGamePlayerId(playerId) {
    const room = this.getRoomByPlayer(playerId);
    if (!room) return null;
    const roomPlayer = room.players.find(p => p.id === playerId);
    return roomPlayer ? roomPlayer.gamePlayerId : null;
  }

  listRooms() {
    const rooms = [];
    for (const [code, room] of this.rooms) {
      rooms.push({
        code,
        playerCount: room.playerCount,
        currentPlayers: room.players.length,
        status: room.status,
        hostName: room.players[0]?.name
      });
    }
    return rooms;
  }

  handleDisconnect(playerId) {
    const room = this.getRoomByPlayer(playerId);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.isConnected = false;
    }

    if (room.game) {
      const gamePlayerId = player?.gamePlayerId;
      const gamePlayer = room.game.getPlayer(gamePlayerId);
      if (gamePlayer) {
        gamePlayer.isConnected = false;
        gamePlayer.disconnectTimer = CONFIG.RECONNECT_TIME;
        
        setTimeout(() => {
          if (!gamePlayer.isConnected && room.game && !room.game.isFinished) {
            gamePlayer.isAI = true;
            console.log(`Player ${gamePlayer.name} is now AI controlled`);
          }
        }, CONFIG.RECONNECT_TIME * 1000);
      }
    }
  }

  handleReconnect(playerId) {
    const room = this.getRoomByPlayer(playerId);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.isConnected = true;
    }

    if (room.game) {
      const gamePlayerId = player?.gamePlayerId;
      const gamePlayer = room.game.getPlayer(gamePlayerId);
      if (gamePlayer) {
        gamePlayer.isConnected = true;
        gamePlayer.isAI = false;
      }
    }
  }

  addSpectator(roomCode, spectatorId, spectatorName) {
    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room not found');

    room.spectators.push({
      id: spectatorId,
      name: spectatorName
    });
    this.playerToRoom.set(spectatorId, roomCode);
  }

  removeSpectator(spectatorId) {
    const roomCode = this.playerToRoom.get(spectatorId);
    if (!roomCode) return;

    const room = this.rooms.get(roomCode);
    if (!room) return;

    room.spectators = room.spectators.filter(s => s.id !== spectatorId);
    this.playerToRoom.delete(spectatorId);
  }
}

const roomManager = new RoomManager();
module.exports = roomManager;
