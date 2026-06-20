import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import '../styles/TechScorePanel.css';

function TechScorePanel() {
  const { gameState, playerId } = useGame();
  const [expanded, setExpanded] = useState(false);

  if (!gameState || !gameState.scoreRankings) return null;

  const rankings = gameState.scoreRankings;
  const myRank = rankings.findIndex(r => r.playerId === playerId) + 1;

  const handlePlayerClick = (player) => {
    const event = new CustomEvent('panToBase', { 
      detail: { q: player.baseQ, r: player.baseR } 
    });
    window.dispatchEvent(event);
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  if (!expanded) {
    return (
      <div className="score-panel-collapsed" onClick={() => setExpanded(true)}>
        <div className="rank-badge-mini">
          <span className="badge-icon">{myRank <= 3 ? getRankBadge(myRank) : `#${myRank}`}</span>
          <span className="badge-text">排行榜</span>
        </div>
      </div>
    );
  }

  return (
    <div className="score-panel-expanded">
      <div className="panel-header" onClick={() => setExpanded(false)}>
        <h3>🏆 科技积分排行</h3>
        <span className="collapse-btn">收起 ▲</span>
      </div>

      <div className="panel-columns">
        <div className="column-header rank-col">排名</div>
        <div className="column-header name-col">玩家</div>
        <div className="column-header score-col">科技</div>
        <div className="column-header score-col">资源</div>
        <div className="column-header score-col">遗迹</div>
        <div className="column-header score-col total-col">总分</div>
      </div>

      <div className="panel-body">
        {rankings.map((player, index) => {
          const rank = index + 1;
          const isMe = player.playerId === playerId;
          const isDefeated = player.isDefeated;

          return (
            <div
              key={player.playerId}
              className={`player-row ${isMe ? 'me' : ''} ${isDefeated ? 'defeated' : ''}`}
              onClick={() => !isDefeated && handlePlayerClick(player)}
            >
              <div className="rank-col">
                <span className={`rank-badge ${rank <= 3 ? 'top' : ''}`}>
                  {getRankBadge(rank)}
                </span>
              </div>
              <div className="name-col">
                <span className="player-color-dot" style={{ background: player.color }} />
                <span className="player-name">{player.name}</span>
                {isMe && <span className="me-tag">我</span>}
                {isDefeated && <span className="defeated-tag">已淘汰</span>}
              </div>
              <div className="score-col">
                <span className="score-label tech">🔬</span>
                <span className="score-value tech">{player.techScore}</span>
              </div>
              <div className="score-col">
                <span className="score-label resource">📦</span>
                <span className="score-value resource">{player.resourceScore}</span>
              </div>
              <div className="score-col">
                <span className="score-label ruin">🏛️</span>
                <span className="score-value ruin">{player.ruinScore}</span>
              </div>
              <div className="score-col total-col">
                <span className="score-total">{player.totalScore}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel-footer">
        <div className="score-legend">
          <span>🔬 科技点 = 当前科技点</span>
          <span>📦 资源分 = 矿物÷10 + 样本÷5</span>
          <span>🏛️ 遗迹分 = 每个占领遗迹+10</span>
        </div>
      </div>
    </div>
  );
}

export default TechScorePanel;
