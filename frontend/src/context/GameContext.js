import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import gameWS from '../services/websocket';

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [gameState, setGameState] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedSubmarine, setSelectedSubmarine] = useState(null);
  const [selectedTile, setSelectedTile] = useState(null);
  const [buoyDeployMode, setBuoyDeployMode] = useState(false);
  const [allyAttackAlert, setAllyAttackAlert] = useState(null);
  const [showAlliancePanel, setShowAlliancePanel] = useState(false);
  const [transferDialogTarget, setTransferDialogTarget] = useState(null);
  const [activeVoteDialog, setActiveVoteDialog] = useState(null);
  const [allianceTab, setAllianceTab] = useState('members');

  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    
    const handleGameState = (state) => {
      setGameState(state);
      if (state.currentPlayer) {
        setPlayerId(state.currentPlayer.id);
      }
      
      if (state.eventLog) {
        for (const event of state.eventLog) {
          if (event.type === 'ally_under_attack' && event.alertFor === state.currentPlayer?.id) {
            setAllyAttackAlert(event);
            setTimeout(() => {
              setAllyAttackAlert(null);
            }, 3000);
            break;
          }
        }
      }
    };
    
    const handleRoomState = (state) => {
      setRoomState(state);
    };
    
    const handleRoomCreated = (data) => {
      setPlayerId(data.playerId);
    };
    
    const handleRoomJoined = (data) => {
      setPlayerId(data.playerId);
    };

    gameWS.on('connected', handleConnect);
    gameWS.on('disconnected', handleDisconnect);
    gameWS.on('game_state', handleGameState);
    gameWS.on('room_state', handleRoomState);
    gameWS.on('room_created', handleRoomCreated);
    gameWS.on('room_joined', handleRoomJoined);

    return () => {
      gameWS.off('connected', handleConnect);
      gameWS.off('disconnected', handleDisconnect);
      gameWS.off('game_state', handleGameState);
      gameWS.off('room_state', handleRoomState);
      gameWS.off('room_created', handleRoomCreated);
      gameWS.off('room_joined', handleRoomJoined);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!gameWS.isConnected()) {
      await gameWS.connect();
    }
  }, []);

  const createRoom = useCallback((playerName, playerCount) => {
    gameWS.createRoom(playerName, playerCount);
  }, []);

  const joinRoom = useCallback((roomCode, playerName) => {
    gameWS.joinRoom(roomCode, playerName);
  }, []);

  const setReady = useCallback((isReady) => {
    gameWS.ready(isReady);
  }, []);

  const startGame = useCallback(() => {
    gameWS.startGame();
  }, []);

  const moveSubmarine = useCallback((submarineId, waypoints) => {
    gameWS.moveSubmarine(submarineId, waypoints);
  }, []);

  const buildSubmarine = useCallback((type) => {
    gameWS.buildSubmarine(type);
  }, []);

  const buildModule = useCallback((moduleType) => {
    gameWS.buildModule(moduleType);
  }, []);

  const research = useCallback((techId) => {
    gameWS.research(techId);
  }, []);

  const fireTorpedo = useCallback((submarineId, targetId) => {
    gameWS.fireTorpedo(submarineId, targetId);
  }, []);

  const setSonarMode = useCallback((submarineId, mode) => {
    gameWS.setSonarMode(submarineId, mode);
  }, []);

  const deploySonarBuoy = useCallback((q, r) => {
    gameWS.deploySonarBuoy(q, r);
    setBuoyDeployMode(false);
  }, []);

  const endTurn = useCallback(() => {
    gameWS.endTurn();
  }, []);

  const leaveRoom = useCallback(() => {
    gameWS.leaveRoom();
    setGameState(null);
    setRoomState(null);
    setSelectedSubmarine(null);
    setSelectedTile(null);
    setShowAlliancePanel(false);
    setTransferDialogTarget(null);
  }, []);

  const createAlliance = useCallback((name) => {
    gameWS.createAlliance(name);
  }, []);

  const applyAlliance = useCallback((allianceId) => {
    gameWS.applyAlliance(allianceId);
  }, []);

  const acceptAllianceApplication = useCallback((allianceId, applicantId) => {
    gameWS.acceptAllianceApplication(allianceId, applicantId);
  }, []);

  const rejectAllianceApplication = useCallback((allianceId, applicantId) => {
    gameWS.rejectAllianceApplication(allianceId, applicantId);
  }, []);

  const leaveAlliance = useCallback(() => {
    gameWS.leaveAlliance();
  }, []);

  const kickAllianceMember = useCallback((allianceId, memberId) => {
    gameWS.kickAllianceMember(allianceId, memberId);
  }, []);

  const transferResources = useCallback((toPlayerId, resources) => {
    gameWS.transferResources(toPlayerId, resources);
    setTransferDialogTarget(null);
  }, []);

  const declareWar = useCallback((targetAllianceId) => {
    gameWS.declareWar(targetAllianceId);
  }, []);

  const castWarVote = useCallback((voteId, support) => {
    gameWS.castWarVote(voteId, support);
    setActiveVoteDialog(null);
  }, []);

  const proposeEndWar = useCallback(() => {
    gameWS.proposeEndWar();
  }, []);

  const castEndWarVote = useCallback((voteId, support) => {
    gameWS.castEndWarVote(voteId, support);
    setActiveVoteDialog(null);
  }, []);

  const value = {
    gameState,
    roomState,
    playerId,
    isConnected,
    selectedSubmarine,
    selectedTile,
    buoyDeployMode,
    allyAttackAlert,
    showAlliancePanel,
    transferDialogTarget,
    activeVoteDialog,
    allianceTab,
    setSelectedSubmarine,
    setSelectedTile,
    setBuoyDeployMode,
    setShowAlliancePanel,
    setTransferDialogTarget,
    setActiveVoteDialog,
    setAllianceTab,
    connect,
    createRoom,
    joinRoom,
    setReady,
    startGame,
    moveSubmarine,
    buildSubmarine,
    buildModule,
    research,
    fireTorpedo,
    setSonarMode,
    deploySonarBuoy,
    endTurn,
    leaveRoom,
    createAlliance,
    applyAlliance,
    acceptAllianceApplication,
    rejectAllianceApplication,
    leaveAlliance,
    kickAllianceMember,
    transferResources,
    declareWar,
    castWarVote,
    proposeEndWar,
    castEndWarVote
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
