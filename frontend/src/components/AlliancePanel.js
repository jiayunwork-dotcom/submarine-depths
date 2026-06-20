import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { CONFIG } from '../game/gameConfig';
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
    kickAllianceMember,
    declareWar,
    castWarVote,
    proposeEndWar,
    castEndWarVote,
    activeVoteDialog,
    setActiveVoteDialog,
    allianceTab,
    setAllianceTab
  } = useGame();

  const [newAllianceName, setNewAllianceName] = useState('');
  const [showDeclareWarDialog, setShowDeclareWarDialog] = useState(false);
  const [selectedTargetAlliance, setSelectedTargetAlliance] = useState('');

  const myAlliance = gameState?.alliances?.myAlliance;
  const availableAlliances = gameState?.alliances?.availableAlliances || [];
  const allAlliances = gameState?.alliances?.allAlliances || [];
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

  const getAllianceName = (allianceId) => {
    const alliance = allAlliances.find(a => a.id === allianceId);
    return alliance?.name || 'Unknown Alliance';
  };

  const isAtWar = myAlliance?.warState?.atWarWith !== null;
  const enemyAllianceId = myAlliance?.warState?.atWarWith;
  const enemyAllianceName = enemyAllianceId ? getAllianceName(enemyAllianceId) : null;

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

  const handleDeclareWar = () => {
    if (selectedTargetAlliance) {
      if (window.confirm(`确定要向「${getAllianceName(selectedTargetAlliance)}」宣战吗？宣战需要花费100矿物，并需要全体成员投票通过（2/3以上同意）。`)) {
        declareWar(selectedTargetAlliance);
        setShowDeclareWarDialog(false);
        setSelectedTargetAlliance('');
      }
    }
  };

  const handleProposeEndWar = () => {
    if (window.confirm('确定要发起停战投票吗？需要双方联盟各自2/3以上成员同意才能生效。')) {
      proposeEndWar();
    }
  };

  const handleVote = (voteId, support, voteType) => {
    if (voteType === 'declare_war') {
      castWarVote(voteId, support);
    } else if (voteType === 'end_war') {
      castEndWarVote(voteId, support);
    }
  };

  const getDeclareWarTargets = () => {
    return allAlliances.filter(a => 
      a.id !== myAlliance?.id && 
      !a.warState?.atWarWith &&
      a.memberCount > 0
    );
  };

  const getTechName = (techId) => {
    return CONFIG.RESEARCH_TECHS[techId]?.name || techId;
  };

  if (!showAlliancePanel) {
    return (
      <button
        className={`alliance-panel-btn ${isAtWar ? 'at-war' : ''}`}
        onClick={() => setShowAlliancePanel(true)}
      >
        🤝 联盟 {isAtWar && <span className="war-indicator">⚔️</span>}
      </button>
    );
  }

  const isLeader = myAlliance?.leaderId === currentPlayerId;

  const renderVoteDialog = () => {
    if (!activeVoteDialog) return null;

    const { vote, type } = activeVoteDialog;
    const myVote = vote.votes[currentPlayerId];
    const requiredVotes = Math.ceil(myAlliance.members.length * 2 / 3);
    const supportCount = Object.values(vote.votes).filter(v => v).length;

    let title = '';
    let description = '';
    if (type === 'declare_war') {
      title = '宣战投票';
      description = `是否向「${vote.data.targetAllianceName}」宣战？需要 ${requiredVotes}/${myAlliance.members.length} 票同意。`;
    } else if (type === 'end_war') {
      title = '停战投票';
      description = `是否与「${vote.data.enemyAllianceName}」停战？需要 ${requiredVotes}/${myAlliance.members.length} 票同意。双方联盟都需通过。`;
    }

    return (
      <div className="modal-overlay" onClick={() => setActiveVoteDialog(null)}>
        <div className="modal vote-dialog" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>🗳️ {title}</h3>
            <button className="close-btn" onClick={() => setActiveVoteDialog(null)}>✕</button>
          </div>
          <div className="modal-content">
            <p className="vote-description">{description}</p>
            <div className="vote-progress">
              <div className="vote-progress-bar">
                <div 
                  className="vote-progress-fill"
                  style={{ width: `${(supportCount / myAlliance.members.length) * 100}%` }}
                />
              </div>
              <div className="vote-count">
                支持: {supportCount} / {requiredVotes} (需要2/3)
              </div>
            </div>
            <div className="vote-members">
              {myAlliance.members.map(memberId => (
                <div key={memberId} className="vote-member-item">
                  <span>{getPlayerName(memberId)}</span>
                  <span className={`vote-status ${vote.votes[memberId] === true ? 'support' : vote.votes[memberId] === false ? 'oppose' : 'pending'}`}>
                    {vote.votes[memberId] === true ? '✓ 支持' : vote.votes[memberId] === false ? '✗ 反对' : '⏳ 待投票'}
                  </span>
                </div>
              ))}
            </div>
            {myVote === undefined && (
              <div className="vote-actions">
                <button 
                  className="vote-support-btn"
                  onClick={() => handleVote(vote.id, true, type)}
                >
                  支持
                </button>
                <button 
                  className="vote-oppose-btn"
                  onClick={() => handleVote(vote.id, false, type)}
                >
                  反对
                </button>
              </div>
            )}
            {myVote !== undefined && (
              <div className="voted-message">
                你已投票: {myVote ? '支持' : '反对'}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDeclareWarDialog = () => {
    if (!showDeclareWarDialog) return null;

    const targets = getDeclareWarTargets();

    return (
      <div className="modal-overlay" onClick={() => setShowDeclareWarDialog(false)}>
        <div className="modal declare-war-dialog" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>⚔️ 宣战</h3>
            <button className="close-btn" onClick={() => setShowDeclareWarDialog(false)}>✕</button>
          </div>
          <div className="modal-content">
            <p className="dialog-description">
              选择要宣战的联盟。宣战需要花费100矿物，并需要全体成员投票通过（2/3以上同意）。
              <br />
              <strong>注意：</strong>宣战后双方联盟成员互相攻击时伤害提升30%。
            </p>
            <div className="target-alliance-list">
              {targets.length > 0 ? (
                targets.map(alliance => (
                  <div 
                    key={alliance.id}
                    className={`target-alliance-item ${selectedTargetAlliance === alliance.id ? 'selected' : ''}`}
                    onClick={() => setSelectedTargetAlliance(alliance.id)}
                  >
                    <div className="alliance-card-name">
                      <div
                        className="alliance-color-dot"
                        style={{ backgroundColor: alliance.color }}
                      />
                      {alliance.name}
                    </div>
                    <div className="alliance-card-info">
                      成员: {alliance.memberCount}/3 · 盟主: {getLeaderName(alliance)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-targets">暂无可宣战的联盟</div>
              )}
            </div>
            <div className="dialog-actions">
              <button 
                className="declare-war-confirm-btn"
                onClick={handleDeclareWar}
                disabled={!selectedTargetAlliance}
              >
                确认宣战
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={`alliance-panel ${isAtWar ? 'at-war-panel' : ''}`}>
        <div className="alliance-panel-header">
          <h3>
            联盟外交 
            {isAtWar && <span className="war-badge">⚔️ 交战中</span>}
          </h3>
          <button className="close-btn" onClick={() => setShowAlliancePanel(false)}>
            ×
          </button>
        </div>

        {myAlliance ? (
          <div className="alliance-info">
            <div className="alliance-name-section">
              <div className="alliance-name">
                <div
                  className="alliance-color-dot"
                  style={{ backgroundColor: myAlliance.color }}
                />
                {myAlliance.name}
              </div>
              {isAtWar && (
                <div className="war-info">
                  与「{enemyAllianceName}」交战中
                </div>
              )}
            </div>

            <div className="alliance-tabs">
              <button 
                className={`tab-btn ${allianceTab === 'members' ? 'active' : ''}`}
                onClick={() => setAllianceTab('members')}
              >
                成员
              </button>
              <button 
                className={`tab-btn ${allianceTab === 'tech' ? 'active' : ''}`}
                onClick={() => setAllianceTab('tech')}
              >
                科技贡献
              </button>
            </div>

            {allianceTab === 'members' && (
              <>
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

                {myAlliance.activeVotes && myAlliance.activeVotes.length > 0 && (
                  <div className="active-votes-section">
                    <h4>进行中的投票</h4>
                    {myAlliance.activeVotes.map(vote => (
                      <div 
                        key={vote.id} 
                        className="active-vote-item"
                        onClick={() => setActiveVoteDialog({ vote, type: vote.type })}
                      >
                        <span>
                          {vote.type === 'declare_war' 
                            ? `宣战投票: ${vote.data.targetAllianceName}`
                            : `停战投票: ${vote.data.enemyAllianceName}`
                          }
                        </span>
                        <span className="vote-click-hint">点击查看</span>
                      </div>
                    ))}
                  </div>
                )}

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

                <div className="alliance-war-actions">
                  {isLeader && !isAtWar && (
                    <button 
                      className="declare-war-btn"
                      onClick={() => setShowDeclareWarDialog(true)}
                      disabled={gameState?.phase !== 'planning'}
                    >
                      ⚔️ 宣战
                    </button>
                  )}
                  {isLeader && isAtWar && (
                    <button 
                      className="end-war-btn"
                      onClick={handleProposeEndWar}
                      disabled={gameState?.phase !== 'planning'}
                    >
                      🕊️ 发起停战投票
                    </button>
                  )}
                </div>

                <button className="leave-btn" onClick={handleLeaveAlliance}>
                  退出联盟
                </button>
              </>
            )}

            {allianceTab === 'tech' && (
              <div className="tech-contributions-section">
                <h4>科技贡献</h4>
                {myAlliance.techContributions && Object.keys(myAlliance.techContributions).length > 0 ? (
                  <div className="tech-contributions-list">
                    {myAlliance.members.map(memberId => (
                      <div key={memberId} className="member-tech-contribution">
                        <div className="contributor-name">
                          {getPlayerName(memberId)}
                          {memberId === myAlliance.leaderId && (
                            <span className="leader-badge">盟主</span>
                          )}
                        </div>
                        <div className="contributed-techs">
                          {myAlliance.techContributions[memberId]?.length > 0 ? (
                            myAlliance.techContributions[memberId].map(techId => (
                              <span key={techId} className="tech-badge">
                                {getTechName(techId)}
                              </span>
                            ))
                          ) : (
                            <span className="no-contribution">暂无贡献科技</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-tech-contributions">
                    暂无科技贡献
                  </div>
                )}
              </div>
            )}
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
                  <div 
                    key={alliance.id} 
                    className={`alliance-card ${alliance.warState?.atWarWith ? 'at-war-card' : ''}`}
                  >
                    <div className="alliance-card-header">
                      <div className="alliance-card-name">
                        <div
                          className="alliance-color-dot"
                          style={{ backgroundColor: alliance.color }}
                        />
                        {alliance.name}
                        {alliance.warState?.atWarWith && (
                          <span className="war-indicator-small">⚔️</span>
                        )}
                      </div>
                    </div>
                    <div className="alliance-card-info">
                      成员: {alliance.memberCount}/3 · 盟主: {getLeaderName(alliance)}
                    </div>
                    {alliance.warState?.atWarWith && (
                      <div className="alliance-card-war-info">
                        交战中
                      </div>
                    )}
                    <button
                      className="apply-btn"
                      onClick={() => handleApplyAlliance(alliance.id)}
                      disabled={gameState?.phase !== 'planning' || alliance.warState?.atWarWith}
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

      {renderVoteDialog()}
      {renderDeclareWarDialog()}
    </>
  );
}

export default AlliancePanel;
