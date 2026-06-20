require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');

const { initDb } = require('./models/database');
const WebSocketHandler = require('./websocket/WebSocketHandler');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api', roomRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

const wsHandler = new WebSocketHandler(server);

async function startServer() {
  try {
    await initDb();
    console.log('Database initialized');
    
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`WebSocket server ready`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, server, wsHandler };
