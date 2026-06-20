import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { CONFIG } from '../game/gameConfig';
import '../styles/BuildPanel.css';

function BuildPanel({ onClose }) {
  const { gameState, buildSubmarine, buildModule } = useGame();
  const [activeTab, setActiveTab] = useState('submarines');

  if (!gameState) return null;

  const base = gameState.currentPlayer.base;
  const canAffordSub = (type) => {
    const cost = CONFIG.SUBMARINE_TYPES[type]?.cost;
    if (!cost) return false;
    if (cost.mineral && base.storage.mineral < cost.mineral) return false;
    if (cost.tech && base.techPoints < cost.tech) return false;
    return true;
  };

  const canAffordModule = (moduleType) => {
    const module = CONFIG.BASE_MODULES[moduleType];
    if (!module || !module.cost) return false;
    if (module.cost.mineral && base.storage.mineral < module.cost.mineral) return false;
    if (module.cost.tech && base.techPoints < module.cost.tech) return false;
    return true;
  };

  const handleBuildSub = (type) => {
    if (canAffordSub(type)) {
      buildSubmarine(type);
    }
  };

  const handleBuildModule = (moduleType) => {
    if (canAffordModule(moduleType)) {
      buildModule(moduleType);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal build-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🏗️ 建造中心</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'submarines' ? 'active' : ''}`}
            onClick={() => setActiveTab('submarines')}
          >
            🚢 潜艇
          </button>
          <button
            className={`tab ${activeTab === 'modules' ? 'active' : ''}`}
            onClick={() => setActiveTab('modules')}
          >
            🏭 基地模块
          </button>
        </div>

        <div className="modal-content">
          {activeTab === 'submarines' && (
            <div className="build-grid">
              {Object.entries(CONFIG.SUBMARINE_TYPES).map(([key, sub]) => (
                <div
                  key={key}
                  className={`build-card ${canAffordSub(key) ? '' : 'disabled'}`}
                >
                  <div className="card-icon" style={{ color: sub.color }}>
                    {sub.icon}
                  </div>
                  <div className="card-name">{sub.name}</div>
                  <div className="card-stats">
                    <div className="stat">
                      <span>耐久</span>
                      <span>{sub.hull}</span>
                    </div>
                    <div className="stat">
                      <span>移动</span>
                      <span>{sub.movement}</span>
                    </div>
                    <div className="stat">
                      <span>深度</span>
                      <span>{sub.maxDepth}m</span>
                    </div>
                    <div className="stat">
                      <span>货舱</span>
                      <span>{sub.cargo}</span>
                    </div>
                  </div>
                  <div className="card-cost">
                    {sub.cost.mineral && (
                      <span className="cost-item">💎 {sub.cost.mineral}</span>
                    )}
                    {sub.cost.tech && (
                      <span className="cost-item">🔬 {sub.cost.tech}</span>
                    )}
                  </div>
                  <button
                    className={`build-btn ${canAffordSub(key) ? '' : 'disabled'}`}
                    onClick={() => handleBuildSub(key)}
                    disabled={!canAffordSub(key)}
                  >
                    建造 ({sub.buildTime}回合)
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'modules' && (
            <div className="build-grid">
              {Object.entries(CONFIG.BASE_MODULES).map(([key, module]) => (
                <div
                  key={key}
                  className={`build-card module-card ${canAffordModule(key) ? '' : 'disabled'}`}
                >
                  <div className="card-icon">{module.icon}</div>
                  <div className="card-name">{module.name}</div>
                  <div className="card-description">{module.description}</div>
                  <div className="card-cost">
                    {module.cost?.mineral && (
                      <span className="cost-item">💎 {module.cost.mineral}</span>
                    )}
                    {module.cost?.tech && (
                      <span className="cost-item">🔬 {module.cost.tech}</span>
                    )}
                  </div>
                  <div className="card-owned">
                    已建造: {base.modules[key] || 0}
                  </div>
                  <button
                    className={`build-btn ${canAffordModule(key) ? '' : 'disabled'}`}
                    onClick={() => handleBuildModule(key)}
                    disabled={!canAffordModule(key)}
                  >
                    建造
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {base.buildQueue && base.buildQueue.length > 0 && (
          <div className="build-queue">
            <h4>建造队列</h4>
            {base.buildQueue.map((item, index) => (
              <div key={index} className="queue-item">
                <span>{CONFIG.SUBMARINE_TYPES[item.type]?.name || item.type}</span>
                <span className="queue-progress">
                  {item.progress} / {item.buildTime} 回合
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BuildPanel;
