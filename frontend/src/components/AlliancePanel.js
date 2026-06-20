import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import '../styles/AlliancePanel.css';

function AlliancePanel() {
  const {
    gameState,
    showAlliancePanel,
    setShowAlliancePanel,
    createAlliance,
    applyAlliance,
    acceptAllianceApplication,
    rejectAllianceApplication,
    leaveAlliance,
    kickAllianceMember
  } = useGame();

  const [newAllianceName, setNewAllianceName] = useState('');

  const myAlliance = gameState?.alliances?.myAlliance;
  const availableAlliances = gameState?.alliances?.availableAlliances || [];
  const currentPlayerId = gameState?.currentPlayer?.id;

  const getPlayerName = (playerId) => {
    if (myAlliance?.memberNames && myAlliance.memberNames[playerId]) {
      return myAlliance.memberNames[playerId];
    }
    const players = gameState?.players || [];
    const player = players.find(p => p.id === playerId);
    return player?.name || 'Unknown';
  };

  const getApplicantName = (applicantId) => {
    if (myAlliance?.pendingApplicationNames && myAlliance.pendingApplicationNames[applicantId]) {
      return myAlliance.pendingApplicationNames[applicantId];
    }
    return getPlayerName(applicantId);
  };

  const getLeaderName = (alliance) => {
    if (alliance.leaderName) return alliance.leaderName;
    return getPlayerName(alliance.leaderId);
  };

  const handleCreateAlliance = () => {
    if (newAllianceName.trim()) {
      createAlliance(newAllianceName.trim());
      setNewAllianceName('');
    }
  };

  const handleApplyAlliance = (allianceId) => {
    applyAlliance(allianceId);
  };

  const handleAcceptApplication = (allianceId, applicantId) => {
    acceptAllianceApplication(allianceId, applicantId);
  };

  const handleRejectApplication = (allianceId, applicantId) => {
    rejectAllianceApplication(allianceId, applicantId);
  };

  const handleLeaveAlliance = () => {
    if (window.confirm('确定要退出联盟吗？')) {
      leaveAlliance();
    }
  };

  const handleKickMember = (allianceId, memberId) => {
    if (window.confirm('确定要踢出该成员吗？')) {
      kickAllianceMember(allianceId, memberId);
    }
  };

  if (!showAlliancePanel) {
    return (
      <button
        className="alliance-panel-btn"
        onClick={() => setShowAlliancePanel(true)}
      >
        🤝 联盟
      </button>
    );
  }

  const isLeader = myAlliance?.leaderId === currentPlayerId;

  return (
    <div className="alliance-panel">
      <div className="alliance-panel-header">
        <h3>联盟外交</h3>
        <button className="close-btn" onClick={() => setShowAlliancePanel(false)}>
          ×
        </button>
      </div>

      {myAlliance ? (
        <div className="alliance-info">
          <div className="alliance-name">
          <div
            className="alliance-color-dot"
            style={{ backgroundColor: myAlliance.color }}
          />
          {myAlliance.name}
        </div>

          <div className="alliance-members">
          <h4>成员 ({myAlliance.memberCount}/3)</h4>
          <ul className="member-list">
            {myAlliance.members.map(memberId => (
              <li key={memberId} className="member-item">
                <span className="member-name">
                  {getPlayerName(memberId)}
                  {memberId === myAlliance.leaderId && (
                    <span className="leader-badge">盟主</span>
                  )}
                </span>
                {isLeader && memberId !== currentPlayerId && (
                  <button
                    className="kick-btn"
                    onClick={() => handleKickMember(myAlliance.id, memberId)}
                  >
                    踢出
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

          {isLeader && myAlliance.pendingApplications && myAlliance.pendingApplications.length > 0 && (
            <div className="pending-applications">
              <h4>待审批申请</h4>
              {myAlliance.pendingApplications.map(applicantId => (
                <div key={applicantId} className="application-item">
                  <span>{getApplicantName(applicantId)}</span>
                  <div className="application-actions">
                    <button
                      className="accept-btn"
                      onClick={() => handleAcceptApplication(myAlliance.id, applicantId)}
                    >
                      接受
                    </button>
                    <button
                      className="reject-btn"
                      onClick={() => handleRejectApplication(myAlliance.id, applicantId)}
                    >
                      拒绝
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button className="leave-btn" onClick={handleLeaveAlliance}>
            退出联盟
          </button>
        </div>
      ) : (
        <div>
          <div className="create-alliance-section">
            <h4>创建联盟 (花费50矿物)</h4>
            <input
              type="text"
              className="create-alliance-input"
              placeholder="输入联盟名称 (最多12字符)"
              value={newAllianceName}
              onChange={(e) => setNewAllianceName(e.target.value.slice(0, 12))}
              maxLength={12}
            />
            <button
              className="create-btn"
              onClick={handleCreateAlliance}
              disabled={!newAllianceName.trim() || gameState?.phase !== 'planning'}
            >
              创建联盟
            </button>
          </div>

          <div className="available-alliances">
            <h4>可加入的联盟</h4>
            {availableAlliances.length > 0 ? (
              availableAlliances.map(alliance => (
                <div key={alliance.id} className="alliance-card">
                  <div className="alliance-card-header">
                    <div className="alliance-card-name">
                    <div
                      className="alliance-color-dot"
                      style={{ backgroundColor: alliance.color }}
                    />
                    {alliance.name}
                  </div>
                </div>
                <div className="alliance-card-info">
                  成员: {alliance.memberCount}/3 · 盟主: {getLeaderName(alliance)}
                </div>
                  <button
                    className="apply-btn"
                    onClick={() => handleApplyAlliance(alliance.id)}
                    disabled={gameState?.phase !== 'planning'}
                  >
                    申请加入
                  </button>
                </div>
              ))
            ) : (
              <div className="no-alliances">
                暂无可加入的联盟
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AlliancePanel;
