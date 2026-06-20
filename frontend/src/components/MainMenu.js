import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import '../styles/MainMenu.css';

function MainMenu() {
  const { createRoom, joinRoom } = useGame();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [playerCount, setPlayerCount] = useState(4);
  const [showJoin, setShowJoin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      alert('请输入玩家名称');
      return;
    }
    createRoom(playerName.trim(), playerCount);
  };

  const handleJoinRoom = () => {
    if (!playerName.trim() || !roomCode.trim()) {
      alert('请输入玩家名称和房间代码');
      return;
    }
    joinRoom(roomCode.trim().toUpperCase(), playerName.trim());
  };

  return (
    <div className="main-menu">
      <div className="menu-content">
        <div className="game-title">
          <h1>🌊 Submarine Depths</h1>
          <h2>深海探索战略游戏</h2>
        </div>

        <div className="menu-description">
          <p>指挥你的深海探险队，探索未知海域，建造强大潜艇，争夺深海遗迹控制权</p>
        </div>

        {!showCreate && !showJoin && (
          <div className="menu-buttons">
            <button className="menu-btn primary" onClick={() => setShowCreate(true)}>
              🚀 创建房间
            </button>
            <button className="menu-btn secondary" onClick={() => setShowJoin(true)}>
                  加入房间
            </button>
          </div>
        )}

        {showCreate && (
          <div className="menu-form">
            <h3>创建房间</h3>
            <div className="form-group">
              <label>玩家名称</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="输入你的名称"
                maxLength={20}
              />
            </div>
            <div className="form-group">
              <label>玩家数量: {playerCount}人</label>
              <div className="player-count-selector">
                {[4, 5, 6].map(num => (
                  <button
                    key={num}
                    className={`count-btn ${playerCount === num ? 'active' : ''}`}
                    onClick={() => setPlayerCount(num)}
                  >
                    {num}人
                  </button>
                ))}
              </div>
            </div>
            <div className="form-actions">
              <button className="menu-btn primary" onClick={handleCreateRoom}>
                创建房间
              </button>
              <button className="menu-btn secondary" onClick={() => setShowCreate(false)}>
                返回
              </button>
            </div>
          </div>
        )}

        {showJoin && (
          <div className="menu-form">
            <h3>加入房间</h3>
            <div className="form-group">
              <label>玩家名称</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="输入你的名称"
                maxLength={20}
              />
            </div>
            <div className="form-group">
              <label>房间代码</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="输入6位房间代码"
                maxLength={6}
                className="room-code-input"
              />
            </div>
            <div className="form-actions">
              <button className="menu-btn primary" onClick={handleJoinRoom}>
                加入房间
              </button>
              <button className="menu-btn secondary" onClick={() => setShowJoin(false)}>
                返回
              </button>
            </div>
          </div>
        )}

        <div className="game-info">
          <div className="info-item">
            <span className="info-icon">🔄</span>
            <span>回合制策略</span>
          </div>
          <div className="info-item">
            <span className="info-icon">👥</span>
            <span>4-6人多人对战</span>
          </div>
          <div className="info-item">
            <span className="info-icon">🔬</span>
            <span>科技研发系统</span>
          </div>
          <div className="info-item">
            <span className="info-icon">🚢</span>
            <span>潜艇建造系统</span>
          </div>
        </div>
      </div>

      <div className="ocean-background">
        <div className="bubble bubble-1"></div>
        <div className="bubble bubble-2"></div>
        <div className="bubble bubble-3"></div>
        <div className="bubble bubble-4"></div>
        <div className="bubble bubble-5"></div>
      </div>
    </div>
  );
}

export default MainMenu;
