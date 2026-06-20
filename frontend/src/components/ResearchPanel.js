import React from 'react';
import { useGame } from '../context/GameContext';
import { CONFIG } from '../game/gameConfig';
import '../styles/BuildPanel.css';

function ResearchPanel({ onClose }) {
  const { gameState, research } = useGame();

  if (!gameState) return null;

  const base = gameState.currentPlayer.base;
  const researched = new Set(base.researched || []);

  const canResearch = (techId) => {
    const tech = CONFIG.RESEARCH_TECHS[techId];
    if (!tech) return false;
    if (researched.has(techId)) return false;
    if (tech.prerequisite && !researched.has(tech.prerequisite)) return false;
    if (base.techPoints < tech.cost) return false;
    return true;
  };

  const getResearchStatus = (techId) => {
    if (researched.has(techId)) return 'researched';
    if (base.researchProgress?.[techId]) return 'researching';
    if (canResearch(techId)) return 'available';
    return 'locked';
  };

  const handleResearch = (techId) => {
    if (canResearch(techId)) {
      research(techId);
    }
  };

  const techsByTier = [
    ['DEPTH_1000', 'EFFICIENT_MINING'],
    ['DEPTH_2000', 'ADVANCED_SONAR', 'ADVANCED_PROPULSION'],
    ['DEPTH_3000', 'REINFORCED_HULL', 'TORPEDO_GUIDANCE']
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal research-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🧪 科技研究</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="research-info">
          <div className="current-tech">
            <span className="tech-icon">🔬</span>
            <span className="tech-points">{base.techPoints} 科技点</span>
          </div>
          {base.researchQueue && base.researchQueue.length > 0 && (
            <div className="researching-item">
              <span>正在研究:</span>
              <span className="research-name">
                {CONFIG.RESEARCH_TECHS[base.researchQueue[0]]?.name}
              </span>
              <span className="research-progress">
                {base.researchProgress?.[base.researchQueue[0]] || 0} / 
                {CONFIG.RESEARCH_TECHS[base.researchQueue[0]]?.cost}
              </span>
            </div>
          )}
        </div>

        <div className="modal-content">
          {techsByTier.map((tier, tierIndex) => (
            <div key={tierIndex} className="tech-tier">
              <h4 className="tier-title">第 {tierIndex + 1} 阶段</h4>
              <div className="tech-grid">
                {tier.map(techId => {
                  const tech = CONFIG.RESEARCH_TECHS[techId];
                  const status = getResearchStatus(techId);
                  
                  return (
                    <div
                      key={techId}
                      className={`tech-card ${status}`}
                      onClick={() => handleResearch(techId)}
                    >
                      <div className="tech-header">
                        <span className="tech-name">{tech.name}</span>
                        <span className="tech-cost">🔬 {tech.cost}</span>
                      </div>
                      <p className="tech-desc">{tech.description}</p>
                      {status === 'researched' && (
                        <div className="tech-status completed">✓ 已完成</div>
                      )}
                      {status === 'researching' && (
                        <div className="tech-status researching">
                          研究中 {base.researchProgress[techId]}/{tech.cost}
                        </div>
                      )}
                      {status === 'available' && (
                        <div className="tech-status available">可研究</div>
                      )}
                      {status === 'locked' && (
                        <div className="tech-status locked">
                          {tech.prerequisite ? '需要前置科技' : '资源不足'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ResearchPanel;
