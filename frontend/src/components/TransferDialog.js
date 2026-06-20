import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import '../styles/AlliancePanel.css';

function TransferDialog() {
  const {
    gameState,
    transferDialogTarget,
    setTransferDialogTarget,
    transferResources
  } = useGame();

  const [mineralAmount, setMineralAmount] = useState(0);
  const [bioSampleAmount, setBioSampleAmount] = useState(0);

  if (!transferDialogTarget) return null;

  const currentPlayer = gameState?.currentPlayer;
  const targetPlayer = gameState?.players?.find(p => p.id === transferDialogTarget);

  if (!currentPlayer || !targetPlayer) return null;

  const maxMineral = currentPlayer.base?.storage?.mineral || 0;
  const maxBioSample = currentPlayer.base?.storage?.bio_sample || 0;

  const handleConfirm = () => {
    const resources = {};
    if (mineralAmount > 0) {
      resources.mineral = mineralAmount;
    }
    if (bioSampleAmount > 0) {
      resources.bio_sample = bioSampleAmount;
    }
    
    if (Object.keys(resources).length > 0) {
      transferResources(transferDialogTarget, resources);
      setMineralAmount(0);
      setBioSampleAmount(0);
    }
  };

  const handleCancel = () => {
    setTransferDialogTarget(null);
    setMineralAmount(0);
    setBioSampleAmount(0);
  };

  const hasTransport = currentPlayer.submarines?.some(s => 
    s.type === 'TRANSPORT' && s.status !== 'sunk' && s.status !== 'adrift'
  );

  const canTransfer = hasTransport && (mineralAmount > 0 || bioSampleAmount > 0);

  return (
    <div className="transfer-dialog">
      <h3>向 {targetPlayer.name} 传输资源</h3>
      
      {!hasTransport && (
        <div style={{ color: '#e74c3c', marginBottom: '12px', fontSize: '13px' }}>
          ⚠️ 需要运输艇才能传输资源
        </div>
      )}

      <div className="transfer-item">
        <span className="transfer-item-label">
          💎 矿物 (拥有: {maxMineral})
        </span>
        <input
          type="number"
          className="transfer-item-input"
          min="0"
          max={maxMineral}
          value={mineralAmount}
          onChange={(e) => {
            const val = Math.max(0, Math.min(maxMineral, parseInt(e.target.value) || 0));
            setMineralAmount(val);
          }}
        />
      </div>

      <div className="transfer-item">
        <span className="transfer-item-label">
          🧬 生物样本 (拥有: {maxBioSample})
        </span>
        <input
          type="number"
          className="transfer-item-input"
          min="0"
          max={maxBioSample}
          value={bioSampleAmount}
          onChange={(e) => {
            const val = Math.max(0, Math.min(maxBioSample, parseInt(e.target.value) || 0));
            setBioSampleAmount(val);
          }}
        />
      </div>

      <div style={{ fontSize: '12px', color: '#aaa', marginTop: '8px' }}>
        提示：运输艇需到达盟友基地1格范围内才能交接
      </div>

      <div className="transfer-actions">
        <button className="transfer-cancel-btn" onClick={handleCancel}>
          取消
        </button>
        <button
          className="transfer-confirm-btn"
          onClick={handleConfirm}
          disabled={!canTransfer}
        >
          确认传输
        </button>
      </div>
    </div>
  );
}

export default TransferDialog;
