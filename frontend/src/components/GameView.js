import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import HexMap from './HexMap';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BuildPanel from './BuildPanel';
import ResearchPanel from './ResearchPanel';
import EventLog from './EventLog';
import TechScorePanel from './TechScorePanel';
import '../styles/GameView.css';

function GameView({ onExit }) {
  const { gameState, leaveRoom, selectedSubmarine, setSelectedSubmarine } = useGame();
  const [showBuildPanel, setShowBuildPanel] = useState(false);
  const [showResearchPanel, setShowResearchPanel] = useState(false);
  const [showEventLog, setShowEventLog] = useState(false);
  const mapContainerRef = useRef(null);

  const handleExit = () => {
    if (window.confirm('确定要退出游戏吗？')) {
      leaveRoom();
      onExit();
    }
  };

  if (!gameState) {
    return (
      <div className="game-view">
        <div className="game-loading">加载游戏中...</div>
      </div>
    );
  }

  if (gameState.isFinished) {
    return (
      <div className="game-view">
        <div className="game-over">
          <h2>游戏结束</h2>
          <div className="winner-info">
            {gameState.winner === gameState.currentPlayer.id ? (
              <div className="winner you-win">
                <h3>🎉 你赢了！</h3>
              </div>
            ) : (
              <div className="winner other-win">
                <h3>游戏结束</h3>
                <p>胜利者: {gameState.players.find(p => p.id === gameState.winner)?.name}</p>
              </div>
            )}
          </div>
          <div className="final-scores">
            <h4>最终得分</h4>
            {gameState.players
              .sort((a, b) => b.score - a.score)
              .map((player, index) => (
                <div key={player.id} className="score-row">
                  <span className="rank">#{index + 1}</span>
                  <span className="name">{player.name}</span>
                  <span className="score">{player.score}分</span>
                </div>
              ))}
          </div>
          <button className="exit-btn" onClick={handleExit}>
            返回主菜单
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-view">
      <TopBar 
        onExit={handleExit}
        onBuild={() => setShowBuildPanel(true)}
        onResearch={() => setShowResearchPanel(true)}
        onToggleEvents={() => setShowEventLog(!showEventLog)}
        showEvents={showEventLog}
      />
      
      <div className="game-main">
        <div className="map-container" ref={mapContainerRef}>
          <HexMap />
          {gameState && !gameState.isFinished && <TechScorePanel />}
        </div>
        
        <Sidebar />
      </div>

      {showBuildPanel && (
        <BuildPanel onClose={() => setShowBuildPanel(false)} />
      )}
      
      {showResearchPanel && (
        <ResearchPanel onClose={() => setShowResearchPanel(false)} />
      )}
      
      {showEventLog && (
        <EventLog onClose={() => setShowEventLog(false)} />
      )}
    </div>
  );
}

export default GameView;
