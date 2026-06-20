import React from 'react';
import { useGame } from '../context/GameContext';
import { CONFIG } from '../game/gameConfig';
import '../styles/TopBar.css';

function TopBar({ onExit, onBuild, onResearch, onToggleEvents, showEvents }) {
  const { gameState, endTurn } = useGame();

  if (!gameState) return null;

  const { turn, phase, planningTimer, currentPlayer, maxTurns } = gameState;
  const base = currentPlayer?.base;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseText = () => {
    switch (phase) {
      case 'planning': return '规划阶段';
      case 'execution': return '执行阶段';
      case 'ended': return '游戏结束';
      default: return phase;
    }
  };

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <button className="exit-btn" onClick={onExit}>
          ✕ 退出
        </button>
        <div className="turn-info">
          <span className="turn-label">回合</span>
          <span className="turn-number">{turn}</span>
          <span className="turn-total">/ {80}</span>
        </div>
        <div className={`phase-badge ${phase}`}>
          {getPhaseText()}
        </div>
      </div>

      <div className="top-bar-center">
        {phase === 'planning' && (
          <div className={`timer ${planningTimer < 10 ? 'warning' : ''}`}>
            <span className="timer-icon">⏱️</span>
            <span className="timer-value">{formatTime(planningTimer)}</span>
          </div>
        )}
      </div>

      <div className="top-bar-right">
        <div className="resource-display">
          <div className="resource-item">
            <span className="resource-icon">💎</span>
            <span className="resource-value">{base?.storage?.mineral || 0}</span>
          </div>
          <div className="resource-item">
            <span className="resource-icon">🧬</span>
            <span className="resource-value">{base?.storage?.bio_sample || 0}</span>
          </div>
          <div className="resource-item">
            <span className="resource-icon">🏺</span>
            <span className="resource-value">{base?.storage?.relic || 0}</span>
          </div>
          <div className="resource-item tech">
            <span className="resource-icon">🔬</span>
            <span className="resource-value">{base?.techPoints || 0}</span>
          </div>
        </div>

        <div className="top-actions">
          <button className="action-btn" onClick={onBuild}>
            🏗️ 建造
          </button>
          <button className="action-btn" onClick={onResearch}>
            🧪 研究
          </button>
          <button className={`action-btn ${showEvents ? 'active' : ''}`} onClick={onToggleEvents}>
            📋 事件
          </button>
          {phase === 'planning' && (
            <button className="action-btn end-turn" onClick={endTurn}>
              ⏭️ 结束回合
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TopBar;
