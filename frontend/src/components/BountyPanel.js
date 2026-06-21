import React from 'react';
import { useGame } from '../context/GameContext';
import { CONFIG } from '../game/gameConfig';
import '../styles/BountyPanel.css';

function BountyPanel() {
  const {
    gameState,
    showBountyPanel,
    setShowBountyPanel,
    bountyTab,
    setBountyTab,
    acceptBounty,
    assistBounty
  } = useGame();

  const bounties = gameState?.bounties;
  const currentPlayerId = gameState?.currentPlayer?.id;

  if (!bounties) return null;

  const availableTasks = bounties.availableTasks || [];
  const myTasks = bounties.myTasks || [];
  const myCompletedTasks = bounties.myCompletedTasks || [];
  const allyTasks = bounties.allyTasks || [];
  const leaderboard = bounties.leaderboard || [];
  const myStreak = bounties.myStreak || { currentStreak: 0, maxStreak: 0, nextThreshold: null };

  const activeTaskCount = myTasks.length;
  const maxTasks = 2;

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case '简单': return '#4caf50';
      case '普通': return '#ff9800';
      case '困难': return '#f44336';
      default: return '#aaa';
    }
  };

  const getRewardIcon = (type) => {
    return CONFIG.BOUNTY_REWARD_ICONS?.[type] || '🎁';
  };

  const getRewardName = (type) => {
    return CONFIG.BOUNTY_REWARD_NAMES?.[type] || type;
  };

  const formatTimeLeft = (deadlineTurn, currentTurn) => {
    const left = deadlineTurn - currentTurn;
    if (left <= 0) return '已超时';
    if (left === 1) return '最后1回合';
    return `剩余${left}回合`;
  };

  if (!showBountyPanel) {
    return (
      <button
        className="bounty-panel-btn"
        onClick={() => setShowBountyPanel(true)}
      >
        🏴 悬赏 {activeTaskCount > 0 && <span className="bounty-task-count">{activeTaskCount}</span>}
      </button>
    );
  }

  const renderAvailableTask = (task) => (
    <div key={task.id} className="bounty-card">
      <div className="bounty-card-header">
        <span className="bounty-type-icon">{task.typeIcon}</span>
        <span className="bounty-type-name">{task.typeName}</span>
        <span
          className="bounty-difficulty"
          style={{ color: getDifficultyColor(task.difficulty) }}
        >
          {task.difficulty}
        </span>
      </div>
      <div className="bounty-description">{task.description}</div>
      {task.targetQ !== null && task.targetR !== null && (
        <div className="bounty-target">
          目标坐标: ({task.targetQ}, {task.targetR})
        </div>
      )}
      <div className="bounty-reward">
        <span className="reward-icon">{getRewardIcon(task.reward.type)}</span>
        <span className="reward-text">
          {getRewardName(task.reward.type)} × {task.reward.amount}
        </span>
      </div>
      <div className="bounty-timelimit">
        ⏱ 限时: {task.timeLimit}回合
      </div>
      <button
        className="bounty-accept-btn"
        onClick={() => acceptBounty(task.id)}
        disabled={activeTaskCount >= maxTasks || gameState?.phase !== 'planning'}
      >
        {activeTaskCount >= maxTasks ? '任务已满' : '接取'}
      </button>
    </div>
  );

  const renderMyTask = (task) => {
    const progressPercent = Math.min(100, Math.floor((task.progress / task.targetAmount) * 100));
    const timeLeft = formatTimeLeft(task.deadlineTurn, gameState.turn);
    const isUrgent = task.deadlineTurn - gameState.turn <= 2;

    return (
      <div key={task.id} className={`bounty-card my-task ${isUrgent ? 'urgent' : ''}`}>
        <div className="bounty-card-header">
          <span className="bounty-type-icon">{task.typeIcon}</span>
          <span className="bounty-type-name">{task.typeName}</span>
          <span
            className="bounty-difficulty"
            style={{ color: getDifficultyColor(task.difficulty) }}
          >
            {task.difficulty}
          </span>
        </div>
        <div className="bounty-description">{task.description}</div>
        {task.targetQ !== null && task.targetR !== null && (
          <div className="bounty-target">
            目标坐标: ({task.targetQ}, {task.targetR})
          </div>
        )}
        <div className="bounty-progress">
          <div className="bounty-progress-bar">
            <div
              className="bounty-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="bounty-progress-text">
            {task.progress}/{task.targetAmount}
          </span>
        </div>
        <div className="bounty-timelimit">
          <span className={isUrgent ? 'time-urgent' : ''}>⏱ {timeLeft}</span>
        </div>
        <div className="bounty-reward">
          <span className="reward-icon">{getRewardIcon(task.reward.type)}</span>
          <span className="reward-text">
            {getRewardName(task.reward.type)} × {task.reward.amount}
          </span>
        </div>
        {task.assistants && task.assistants.length > 0 && (
          <div className="bounty-assistants">
            协助者: {task.assistants.length}人
          </div>
        )}
      </div>
    );
  };

  const renderAllyTask = (task) => (
    <div key={task.id} className="bounty-card ally-task">
      <div className="bounty-card-header">
        <span className="bounty-type-icon">{task.typeIcon}</span>
        <span className="bounty-type-name">{task.typeName}</span>
        <span className="bounty-owner">来自: {task.ownerName}</span>
      </div>
      <div className="bounty-description">{task.description}</div>
      <div className="bounty-progress">
        <div className="bounty-progress-bar">
          <div
            className="bounty-progress-fill"
            style={{ width: `${Math.min(100, Math.floor((task.progress / task.targetAmount) * 100))}%` }}
          />
        </div>
        <span className="bounty-progress-text">
          {task.progress}/{task.targetAmount}
        </span>
      </div>
      {!task.assistants?.includes(currentPlayerId) && (
        <button
          className="bounty-assist-btn"
          onClick={() => assistBounty(task.id)}
          disabled={gameState?.phase !== 'planning'}
        >
          协助
        </button>
      )}
      {task.assistants?.includes(currentPlayerId) && (
        <div className="already-assisting">已协助</div>
      )}
    </div>
  );

  const renderCompletedTask = (task) => (
    <div key={task.id} className={`bounty-card completed-task ${task.status}`}>
      <div className="bounty-card-header">
        <span className="bounty-type-icon">{task.typeIcon}</span>
        <span className="bounty-type-name">{task.typeName}</span>
        <span className={`task-status ${task.status}`}>
          {task.status === 'completed' ? '✓ 完成' : '✗ 失败'}
        </span>
      </div>
      <div className="bounty-description">{task.description}</div>
      {task.status === 'completed' && task.reward && (
        <div className="bounty-reward">
          <span className="reward-icon">{getRewardIcon(task.reward.type)}</span>
          <span className="reward-text">
            获得: {getRewardName(task.reward.type)} × {task.reward.actualAmount || task.reward.amount}
            {task.reward.allianceBonus && <span className="alliance-bonus-tag"> +20%联盟加成</span>}
          </span>
        </div>
      )}
      {task.status === 'failed' && (
        <div className="bounty-penalty">违约金: -{task.penaltyApplied || 10}矿物</div>
      )}
    </div>
  );

  const renderLeaderboardEntry = (entry, index) => {
    const isCurrentPlayer = entry.playerId === currentPlayerId;
    const getRankBadge = (idx) => {
      if (idx === 0) return '🥇';
      if (idx === 1) return '🥈';
      if (idx === 2) return '🥉';
      return `${idx + 1}`;
    };

    return (
      <div key={entry.playerId} className={`leaderboard-entry ${isCurrentPlayer ? 'current-player' : ''}`}>
        <div className="leaderboard-rank">
          <span className="rank-badge">{getRankBadge(index)}</span>
        </div>
        <div className="leaderboard-player-info">
          <div className="leaderboard-player-name">
            <span
              className="player-color-dot"
              style={{ backgroundColor: entry.playerColor }}
            />
            {entry.playerName}
            {isCurrentPlayer && <span className="you-tag"> (你)</span>}
          </div>
          <div className="leaderboard-stats">
            <span className="stat-item">
              🏆 {entry.completedCount} 个任务
            </span>
            <span className="stat-item">
              🔥 最高连{entry.maxStreak}
            </span>
            <span className="stat-item">
              ⚡ 当前连{entry.currentStreak}
            </span>
          </div>
          <div className="leaderboard-rewards">
            <span className="reward-item">
              {CONFIG.BOUNTY_REWARD_ICONS?.mineral || '💎'} {entry.totalRewards.mineral}
            </span>
            <span className="reward-item">
              {CONFIG.BOUNTY_REWARD_ICONS?.bio_sample || '🧬'} {entry.totalRewards.bio_sample}
            </span>
            <span className="reward-item">
              {CONFIG.BOUNTY_REWARD_ICONS?.techPoints || '🔬'} {entry.totalRewards.techPoints}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderStreakProgress = () => {
    const { currentStreak, nextThreshold } = myStreak;
    if (!nextThreshold) return null;

    const progressPercent = Math.min(100, nextThreshold.progress * 100);
    const nextStreak = nextThreshold.streak;
    const bonusPercent = nextThreshold.name;

    return (
      <div className="streak-progress-section">
        <div className="streak-header">
          <span className="streak-title">🔥 连续完成</span>
          <span className="streak-count">{currentStreak}/{nextStreak}</span>
        </div>
        <div className="streak-progress-bar">
          <div
            className="streak-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="streak-next-reward">
          {nextThreshold.isMax ? (
            <span className="max-streak">🎉 已达最高奖励等级！额外+{bonusPercent}</span>
          ) : (
            <span>下一阶段奖励: +{bonusPercent} 额外奖励</span>
          )}
        </div>
        {myStreak.maxStreak > 0 && (
          <div className="streak-max-record">
            历史最高记录: {myStreak.maxStreak} 连胜
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bounty-panel">
      <div className="bounty-panel-header">
        <h3>🏴 深海悬赏</h3>
        <button className="close-btn" onClick={() => setShowBountyPanel(false)}>
          ×
        </button>
      </div>

      <div className="bounty-tabs">
        <button
          className={`tab-btn ${bountyTab === 'pool' ? 'active' : ''}`}
          onClick={() => setBountyTab('pool')}
        >
          任务池 {availableTasks.length > 0 && <span className="tab-badge">{availableTasks.length}</span>}
        </button>
        <button
          className={`tab-btn ${bountyTab === 'my' ? 'active' : ''}`}
          onClick={() => setBountyTab('my')}
        >
          我的任务 {activeTaskCount > 0 && <span className="tab-badge">{activeTaskCount}/{maxTasks}</span>}
        </button>
        <button
          className={`tab-btn ${bountyTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setBountyTab('leaderboard')}
        >
          🏆 排行榜
        </button>
      </div>

      {bountyTab === 'pool' && (
        <div className="bounty-task-list">
          {availableTasks.length > 0 ? (
            availableTasks.map(renderAvailableTask)
          ) : (
            <div className="no-tasks">暂无可接取的悬赏任务，等待下次刷新</div>
          )}
        </div>
      )}

      {bountyTab === 'my' && (
        <div className="bounty-task-list">
          {myTasks.length > 0 ? (
            myTasks.map(renderMyTask)
          ) : (
            <div className="no-tasks">暂无进行中的任务，去任务池接取吧</div>
          )}

          {allyTasks.length > 0 && (
            <div className="ally-tasks-section">
              <h4>🤝 盟友任务</h4>
              {allyTasks.map(renderAllyTask)}
            </div>
          )}

          {myCompletedTasks.length > 0 && (
            <div className="completed-tasks-section">
              <h4>历史任务</h4>
              {myCompletedTasks.slice(-5).map(renderCompletedTask)}
            </div>
          )}

          {renderStreakProgress()}
        </div>
      )}

      {bountyTab === 'leaderboard' && (
        <div className="bounty-leaderboard">
          <div className="leaderboard-header">
            <h4>🏆 悬赏排行榜</h4>
            <p className="leaderboard-desc">按完成任务数排序，任务数相同按总奖励价值排序</p>
          </div>
          {leaderboard.length > 0 ? (
            <div className="leaderboard-list">
              {leaderboard.map((entry, index) => renderLeaderboardEntry(entry, index))}
            </div>
          ) : (
            <div className="no-tasks">暂无排行数据，快去完成任务吧！</div>
          )}
        </div>
      )}
    </div>
  );
}

export default BountyPanel;
