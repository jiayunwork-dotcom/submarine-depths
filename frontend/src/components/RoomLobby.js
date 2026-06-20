import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import '../styles/RoomLobby.css';

function RoomLobby({ onBack }) {
  const { roomState, playerId, setReady, startGame, leaveRoom } = useGame();
  const [isReady, setIsReady] = useState(false);

  if (!roomState) {
    return (
      <div className="room-lobby">
        <div className="lobby-loading">加载中...</div>
      </div>
    );
  }

  const handleReady = () => {
    const newReady = !isReady;
    setIsReady(newReady);
    setReady(newReady);
  };

  const handleStart = () => {
    startGame();
  };

  const handleLeave = () => {
    leaveRoom();
    onBack();
  };

  const allReady = roomState.players.length >= 4 && 
    roomState.players.every(p => p.isReady);
  
  const isHost = roomState.players[0]?.id === playerId;

  return (
    <div className="room-lobby">
      <div className="lobby-container">
        <div className="lobby-header">
          <button className="back-btn" onClick={handleLeave}>
            ← 返回
          </button>
          <h2>房间大厅</h2>
          <div className="room-code-display">
            <span className="label">房间代码:</span>
            <span className="code">{roomState.code}</span>
          </div>
        </div>

        <div className="lobby-content">
          <div className="players-section">
            <h3>玩家列表 ({roomState.players.length}/{roomState.playerCount})</h3>
            <div className="players-grid">
              {roomState.players.map((player, index) => (
                <div
                  key={player.id}
                  className={`player-card ${player.id === playerId ? 'self' : ''} ${player.isReady ? 'ready' : ''}`}
                >
                  <div className="player-avatar">
                    {index + 1}
                  </div>
                  <div className="player-info">
                    <span className="player-name">{player.name}</span>
                    {player.id === playerId && <span className="you-tag">你</span>}
                  </div>
                  <div className="player-status">
                    {player.isReady ? (
                      <span className="status ready">✓ 已准备</span>
                    ) : (
                      <span className="status not-ready">未准备</span>
                    )}
                  </div>
                  {!player.isConnected && (
                    <div className="disconnected-badge">掉线</div>
                  )}
                </div>
              ))}
              
              {Array.from({ length: roomState.playerCount - roomState.players.length }).map((_, i) => (
                <div key={`empty-${i}`} className="player-card empty">
                  <div className="player-avatar">?</div>
                  <div className="player-info">
                    <span className="player-name">等待加入...</span>
                  </div>
                  <div className="player-status">
                    <span className="status empty">空位置</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="game-info-section">
            <h3>游戏信息</h3>
            <div className="info-list">
              <div className="info-row">
                <span className="info-label">游戏模式</span>
                <span className="info-value">标准对战</span>
              </div>
              <div className="info-row">
                <span className="info-label">玩家人数</span>
                <span className="info-value">{roomState.playerCount}人</span>
              </div>
              <div className="info-row">
                <span className="info-label">总回合数</span>
                <span className="info-value">80回合</span>
              </div>
              <div className="info-row">
                <span className="info-label">规划时间</span>
                <span className="info-value">90秒</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lobby-footer">
          {isHost ? (
            <button
              className={`start-btn ${allReady ? 'enabled' : 'disabled'}`}
              onClick={handleStart}
              disabled={!allReady}
            >
              {allReady ? '🚀 开始游戏' : '等待所有玩家准备'}
            </button>
          ) : (
            <button
              className={`ready-btn ${isReady ? 'cancel' : 'confirm'}`}
              onClick={handleReady}
            >
              {isReady ? '取消准备' : '准备开始'}
            </button>
          )}
        </div>

        {roomState.spectators && roomState.spectators.length > 0 && (
          <div className="spectators-section">
            <h4>观众 ({roomState.spectators.length})</h4>
            <div className="spectators-list">
              {roomState.spectators.map(s => (
                <span key={s.id} className="spectator-name">{s.name}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RoomLobby;
