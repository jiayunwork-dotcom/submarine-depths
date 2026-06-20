const express = require('express');
const cors = require('cors');
const roomManager = require('../game/RoomManager');

const router = express.Router();

router.get('/rooms', (req, res) => {
  const rooms = roomManager.listRooms();
  res.json({ rooms });
});

router.get('/rooms/:roomCode', (req, res) => {
  const { roomCode } = req.params;
  const room = roomManager.getRoom(roomCode);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json({
    code: room.code,
    playerCount: room.playerCount,
    currentPlayers: room.players.length,
    status: room.status,
    players: room.players.map(p => ({
      name: p.name,
      isReady: p.isReady
    }))
  });
});

router.post('/rooms', (req, res) => {
  const { playerName, playerCount } = req.body;
  
  if (!playerName) {
    return res.status(400).json({ error: 'Player name is required' });
  }
  
  try {
    const roomCode = roomManager.createRoom('temp', playerName, playerCount || 4);
    res.json({ roomCode });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

module.exports = router;
