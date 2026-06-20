import React, { useState, useEffect } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import MainMenu from './components/MainMenu';
import RoomLobby from './components/RoomLobby';
import GameView from './components/GameView';
import './styles/App.css';

function AppContent() {
  const { gameState, roomState, isConnected, connect } = useGame();
  const [view, setView] = useState('menu');

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (gameState && gameState.turn >= 0) {
      setView('game');
    } else if (roomState) {
      setView('lobby');
    }
  }, [gameState, roomState]);

  const handleBackToMenu = () => {
    setView('menu');
  };

  return (
    <div className="app">
      {!isConnected && (
        <div className="connection-status connecting">
          正在连接服务器...
        </div>
      )}
      
      {view === 'menu' && <MainMenu />}
      {view === 'lobby' && <RoomLobby onBack={handleBackToMenu} />}
      {view === 'game' && <GameView onExit={handleBackToMenu} />}
    </div>
  );
}

function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}

export default App;
