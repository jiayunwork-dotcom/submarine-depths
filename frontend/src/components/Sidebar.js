import React from 'react';
import { useGame } from '../context/GameContext';
import { CONFIG } from '../game/gameConfig';
import '../styles/Sidebar.css';

function Sidebar() {
  const { gameState, selectedSubmarine, setSelectedSubmarine, setSonarMode, buoyDeployMode, setBuoyDeployMode } = useGame();

  if (!gameState) return null;

  const currentPlayer = gameState.currentPlayer;
  const selectedSub = currentPlayer?.submarines.find(s => s.id === selectedSubmarine);

  return (
    <div className="sidebar">
      <div className="sidebar-section">
        <h3 className="section-title">我的潜艇</h3>
        <div className="submarine-list">
          {currentPlayer?.submarines.map(sub => (
            <div
              key={sub.id}
              className={`submarine-item ${selectedSubmarine === sub.id ? 'selected' : ''}`}
              onClick={() => setSelectedSubmarine(
                selectedSubmarine === sub.id ? null : sub.id
              )}
            >
              <div className="sub-icon" style={{ background: currentPlayer.color }}>
                {CONFIG.SUBMARINE_TYPES[sub.type]?.icon}
              </div>
              <div className="sub-info">
                <div className="sub-name">
                  {CONFIG.SUBMARINE_TYPES[sub.type]?.name}
                </div>
                <div className="sub-stats">
                  <div className="stat-bar">
                    <span className="stat-label">耐久</span>
                    <div className="bar">
                      <div 
                        className="bar-fill hull"
                        style={{ width: `${(sub.hull / sub.maxHull) * 100}%` }}
                      />
                    </div>
                    <span className="stat-value">{sub.hull}/{sub.maxHull}</span>
                  </div>
                  <div className="stat-bar">
                    <span className="stat-label">能源</span>
                    <div className="bar">
                      <div 
                        className="bar-fill energy"
                        style={{ width: `${(sub.energy / sub.maxEnergy) * 100}%` }}
                      />
                    </div>
                    <span className="stat-value">{sub.energy}/{sub.maxEnergy}</span>
                  </div>
                </div>
              </div>
              <div className="sub-status">
                {sub.status === 'sunk' && <span className="status sunk">沉没</span>}
                {sub.status === 'adrift' && <span className="status adrift">漂浮</span>}
                {sub.status === 'idle' && <span className="status idle">待命</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedSub && (
        <div className="sidebar-section">
          <h3 className="section-title">潜艇详情</h3>
          <div className="sub-detail">
            <div className="detail-row">
              <span className="detail-label">类型</span>
              <span className="detail-value">{CONFIG.SUBMARINE_TYPES[selectedSub.type]?.name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">移动力</span>
              <span className="detail-value">{selectedSub.movementLeft} / {selectedSub.movement}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">下潜深度</span>
              <span className="detail-value">{selectedSub.maxDepth}m</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">声呐范围</span>
              <span className="detail-value">{selectedSub.sonarRange}格</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">货舱容量</span>
              <span className="detail-value">{selectedSub.cargo.mineral + selectedSub.cargo.bio_sample + selectedSub.cargo.relic} / {selectedSub.maxCargo}</span>
            </div>
            
            {selectedSub.torpedoes !== undefined && (
              <div className="detail-row">
                <span className="detail-label">鱼雷</span>
                <span className="detail-value">{selectedSub.torpedoes}</span>
              </div>
            )}

            <div className="detail-row">
              <span className="detail-label">声呐模式</span>
              <div className="sonar-toggle">
                <button
                  className={`sonar-btn ${selectedSub.sonarMode === 'passive' ? 'active' : ''}`}
                  onClick={() => setSonarMode(selectedSub.id, 'passive')}
                >
                  被动
                </button>
                <button
                  className={`sonar-btn ${selectedSub.sonarMode === 'active' ? 'active' : ''}`}
                  onClick={() => setSonarMode(selectedSub.id, 'active')}
                >
                  主动
                </button>
              </div>
            </div>

            <div className="cargo-detail">
              <div className="cargo-title">货舱</div>
              <div className="cargo-items">
                <div className="cargo-item">
                  <span>💎 矿物</span>
                  <span>{selectedSub.cargo.mineral}</span>
                </div>
                <div className="cargo-item">
                  <span>🧬 样本</span>
                  <span>{selectedSub.cargo.bio_sample}</span>
                </div>
                <div className="cargo-item">
                  <span>🏺 遗物</span>
                  <span>{selectedSub.cargo.relic}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="sidebar-section">
        <h3 className="section-title">声呐浮标</h3>
        <div className="buoy-section">
          <div className="buoy-info">
            <span>已部署: {currentPlayer?.sonarBuoys?.length || 0} / 10</span>
            <span className="buoy-cost">费用: 15💎</span>
          </div>
          <button
            className={`buoy-deploy-btn ${buoyDeployMode ? 'active' : ''}`}
            onClick={() => setBuoyDeployMode(!buoyDeployMode)}
          >
            {buoyDeployMode ? '📡 取消部署' : '📡 部署浮标'}
          </button>
          {buoyDeployMode && (
            <div className="buoy-hint">
              点击地图上的格子放置浮标（需要附近2格内有潜艇）
            </div>
          )}
          {currentPlayer?.sonarBuoys?.length > 0 && (
            <div className="buoy-list">
              {currentPlayer.sonarBuoys.map((buoy, index) => (
                <div key={buoy.id || index} className="buoy-item">
                  <span className="buoy-icon">📡</span>
                  <span className="buoy-pos">({buoy.q}, {buoy.r})</span>
                  <span className="buoy-range">范围{buoy.range}格</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-section">
        <h3 className="section-title">深海遗迹</h3>
        <div className="ruin-list">
          {gameState.ruins?.length === 0 && (
            <div className="empty-hint">暂无可显示的遗迹</div>
          )}
          {gameState.ruins?.map(ruin => {
            const statusText = { idle: '空闲', excavating: '发掘中', captured: '已占领' }[ruin.status] || ruin.status;
            const owner = ruin.ownerId ? gameState.players.find(p => p.id === ruin.ownerId) : null;
            const excavator = ruin.excavatorPlayerId ? gameState.players.find(p => p.id === ruin.excavatorPlayerId) : null;
            const visible = gameState.map[`${ruin.q},${ruin.r}`]?.visible || gameState.map[`${ruin.q},${ruin.r}`]?.explored;
            if (!visible) return null;

            const handleRuinClick = () => {
              const event = new CustomEvent('panToBase', {
                detail: { q: ruin.q, r: ruin.r }
              });
              window.dispatchEvent(event);
            };

            return (
              <div key={`${ruin.q},${ruin.r}`} className="ruin-item" onClick={handleRuinClick}>
                <div className="ruin-header">
                  <span className="ruin-icon">🏛️</span>
                  <span className="ruin-coord">({ruin.q}, {ruin.r})</span>
                  <span className={`ruin-status ${ruin.status}`}>{statusText}</span>
                </div>
                {ruin.status === 'excavating' && (
                  <div className="ruin-progress">
                    <div className="ruin-progress-bar">
                      <div
                        className="ruin-progress-fill"
                        style={{
                          width: `${(ruin.progress / ruin.maxProgress) * 100}%`,
                          background: excavator?.color || '#ba68c8'
                        }}
                      />
                    </div>
                    <span className="ruin-progress-text">
                      {excavator?.name || '未知'} {ruin.progress}/{ruin.maxProgress}
                    </span>
                  </div>
                )}
                {ruin.status === 'captured' && owner && (
                  <div className="ruin-owner">
                    <span className="ruin-owner-dot" style={{ background: owner.color }} />
                    <span>{owner.name} 占领</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="sidebar-section">
        <h3 className="section-title">玩家列表</h3>
        <div className="player-list">
          {gameState.players.map(player => (
            <div
              key={player.id}
              className={`player-item ${player.id === currentPlayer?.id ? 'self' : ''} ${player.isDefeated ? 'defeated' : ''}`}
            >
              <div 
                className="player-color"
                style={{ background: player.color }}
              />
              <div className="player-info">
                <span className="player-name">
                  {player.name}
                  {player.id === currentPlayer?.id && ' (你)'}
                  {player.isAI && ' [AI]'}
                </span>
                <span className="player-score">{player.score}分</span>
              </div>
              {!player.isConnected && (
                <span className="connection-status disconnected">掉线</span>
              )}
              {player.isDefeated && (
                <span className="defeated-badge">淘汰</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
