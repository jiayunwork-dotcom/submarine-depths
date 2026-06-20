class GameWebSocket {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';
      
      try {
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.emit('connected', {});
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.emit(message.type, message.payload);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };
        
        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.emit('disconnected', {});
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    setTimeout(() => {
      console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
      this.connect().catch(() => {});
    }, delay);
  }

  send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  emit(event, payload) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(payload);
        } catch (e) {
          console.error(`Error in ${event} listener:`, e);
        }
      });
    }
  }

  createRoom(playerName, playerCount) {
    this.send('create_room', { playerName, playerCount });
  }

  joinRoom(roomCode, playerName) {
    this.send('join_room', { roomCode, playerName });
  }

  ready(isReady) {
    this.send('ready', { isReady });
  }

  startGame() {
    this.send('start_game', {});
  }

  moveSubmarine(submarineId, waypoints) {
    this.send('move_submarine', { submarineId, waypoints });
  }

  buildSubmarine(type) {
    this.send('build_submarine', { type });
  }

  buildModule(moduleType) {
    this.send('build_module', { moduleType });
  }

  research(techId) {
    this.send('research', { techId });
  }

  fireTorpedo(submarineId, targetId) {
    this.send('fire_torpedo', { submarineId, targetId });
  }

  setSonarMode(submarineId, mode) {
    this.send('set_sonar_mode', { submarineId, mode });
  }

  deploySonarBuoy(q, r) {
    this.send('deploy_sonar_buoy', { q, r });
  }

  endTurn() {
    this.send('end_turn', {});
  }

  getGameState() {
    this.send('get_game_state', {});
  }

  leaveRoom() {
    this.send('leave_room', {});
  }

  spectate(roomCode, spectatorName) {
    this.send('spectate', { roomCode, spectatorName });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

const gameWS = new GameWebSocket();
export default gameWS;
