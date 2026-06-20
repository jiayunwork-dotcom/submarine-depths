import React from 'react';
import { useGame } from '../context/GameContext';
import '../styles/BuildPanel.css';

function EventLog({ onClose }) {
  const { gameState } = useGame();

  if (!gameState) return null;

  const { eventLog, combatLog } = gameState;
  const allEvents = [
    ...(eventLog || []).map(e => ({ ...e, type: 'event' })),
    ...(combatLog || []).map(e => ({ ...e, type: 'combat' }))
  ].sort((a, b) => (b.turn || 0) - (a.turn || 0));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal event-log-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📋 事件日志</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-content">
          {allEvents.length === 0 ? (
            <div className="no-events">暂无事件记录</div>
          ) : (
            <div className="event-list">
              {allEvents.map((event, index) => (
                <div key={index} className={`event-item ${event.type}`}>
                  <div className="event-icon">
                    {event.type === 'combat' ? '⚔️' : '📢'}
                  </div>
                  <div className="event-content">
                    <div className="event-message">
                      {event.message || getEventMessage(event)}
                    </div>
                    <div className="event-turn">
                      第 {event.turn || gameState.turn} 回合
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getEventMessage(event) {
  switch (event.type) {
    case 'torpedo_hit':
      return `鱼雷命中！造成 ${event.damage} 点伤害`;
    case 'torpedo_miss':
      return '鱼雷未命中';
    case 'player_defeated':
      return '玩家被淘汰';
    default:
      return '未知事件';
  }
}

export default EventLog;
