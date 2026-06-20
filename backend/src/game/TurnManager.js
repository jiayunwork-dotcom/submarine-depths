const CONFIG = require('./config');

class TurnManager {
  constructor() {
    this.gameTimers = new Map();
  }

  startGameTurns(game, onTurnEnd, onUpdate) {
    if (this.gameTimers.has(game.id)) {
      this.stopGameTurns(game.id);
    }

    const timer = setInterval(() => {
      if (game.phase === 'planning') {
        game.planningTimer--;
        
        if (onUpdate) {
          onUpdate();
        }
        
        if (game.planningTimer <= 0) {
          this.processTurn(game, onTurnEnd);
        }
      }
    }, 1000);

    this.gameTimers.set(game.id, timer);
  }

  processTurn(game, onTurnEnd) {
    game.executePhase();
    
    setTimeout(() => {
      if (!game.isFinished) {
        game.endTurn();
      }
      
      if (onTurnEnd) {
        onTurnEnd();
      }
    }, 2000);
  }

  stopGameTurns(gameId) {
    const timer = this.gameTimers.get(gameId);
    if (timer) {
      clearInterval(timer);
      this.gameTimers.delete(gameId);
    }
  }

  forceEndPlanning(game, onTurnEnd) {
    game.planningTimer = 0;
    this.processTurn(game, onTurnEnd);
  }
}

const turnManager = new TurnManager();
module.exports = turnManager;
