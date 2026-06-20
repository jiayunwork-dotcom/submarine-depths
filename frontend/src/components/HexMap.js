import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { CONFIG, HEX_SIZE, hexToPixel, pixelToHex, getHexCorners, hexDistance, getMovementCost, getCurrentDirectionName } from '../game/gameConfig';
import '../styles/HexMap.css';

function HexMap() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const { gameState, selectedSubmarine, setSelectedSubmarine, setSelectedTile, moveSubmarine, buoyDeployMode, deploySonarBuoy } = useGame();
  
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [offsetStart, setOffsetStart] = useState({ x: 0, y: 0 });
  const [hoveredHex, setHoveredHex] = useState(null);
  const [pathPreview, setPathPreview] = useState([]);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      setCanvasSize({ width, height, dpr });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (gameState && gameState.currentPlayer) {
      const base = gameState.currentPlayer.base;
      const { x, y } = hexToPixel(base.q, base.r);
      setOffset({ x: canvasSize.width / 2 - x, y: canvasSize.height / 2 - y });
    }
  }, [gameState?.currentPlayer?.id]);

  useEffect(() => {
    const handlePanToBase = (e) => {
      const { q, r } = e.detail;
      const { x, y } = hexToPixel(q, r);
      setOffset({ x: canvasSize.width / 2 - x, y: canvasSize.height / 2 - y });
    };
    window.addEventListener('panToBase', handlePanToBase);
    return () => window.removeEventListener('panToBase', handlePanToBase);
  }, [canvasSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = canvasSize.dpr || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = canvasSize.width + 'px';
    canvas.style.height = canvasSize.height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    
    if (!gameState || !gameState.map) return;

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    const tiles = Object.values(gameState.map);
    
    for (const tile of tiles) {
      drawTile(ctx, tile);
    }

    for (const tile of tiles) {
      drawTileContent(ctx, tile);
    }

    if (pathPreview.length > 0 && selectedSubmarine) {
      drawPathPreview(ctx);
    }

    for (const player of gameState.players) {
      if (player.base) {
        drawBase(ctx, player.base, player.color);
      }
    }

    for (const player of gameState.players) {
      for (const sub of player.submarines) {
        drawSubmarine(ctx, sub, player.color, player.id === gameState.currentPlayer?.id);
      }
    }

    drawSonarBuoys(ctx);

    if (buoyDeployMode) {
      drawBuoyDeployOverlay(ctx);
    }

    if (gameState.currentDirection) {
      drawCurrentIndicators(ctx);
    }

    if (hoveredHex) {
      drawHoverHighlight(ctx, hoveredHex);
    }

    if (selectedSubmarine) {
      const sub = gameState.currentPlayer.submarines.find(s => s.id === selectedSubmarine);
      if (sub) {
        drawSelectedHighlight(ctx, sub);
        drawMovementRange(ctx, sub);
      }
    }

    ctx.restore();
  }, [gameState, offset, zoom, hoveredHex, selectedSubmarine, pathPreview, canvasSize]);

  const drawTile = (ctx, tile) => {
    const { x, y } = hexToPixel(tile.q, tile.r);
    const corners = getHexCorners(x, y, HEX_SIZE * 0.97);
    
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
    
    if (tile.explored && !tile.visible) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fill();
    } else if (tile.visible) {
      const depthColor = CONFIG.DEPTH_LEVELS[tile.depthLevel]?.color || '#1a237e';
      const terrainColor = CONFIG.TERRAIN_TYPES[tile.terrain]?.color || depthColor;
      
      ctx.fillStyle = terrainColor;
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#0a1929';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  };

  const drawTileContent = (ctx, tile) => {
    if (!tile.visible && !tile.explored) return;
    
    const { x, y } = hexToPixel(tile.q, tile.r);
    const terrain = CONFIG.TERRAIN_TYPES[tile.terrain];
    
    if (terrain && terrain.icon && tile.visible) {
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(terrain.icon, x, y - 5);
    }
    
    if (tile.resources > 0 && tile.visible) {
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(tile.resources.toString(), x, y + 12);
    }
    
    if (tile.controlPoints > 0 && tile.visible) {
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('★' + tile.controlPoints, x, y + 12);
    }
    
    if (tile.terrain === 'RUIN' && tile.ruin && tile.visible) {
      drawRuinState(ctx, tile, x, y);
    }
    
    if (tile.owner && tile.terrain === 'RUIN') {
      const owner = gameState.players.find(p => p.id === tile.owner);
      if (owner) {
        ctx.beginPath();
        ctx.arc(x, y - HEX_SIZE * 0.7, 4, 0, Math.PI * 2);
        ctx.fillStyle = owner.color;
        ctx.fill();
      }
    }
  };

  const drawRuinState = (ctx, tile, x, y) => {
    const ruin = tile.ruin;
    const ruinPlayer = ruin.ownerId || ruin.excavatorPlayerId;
    const owner = ruinPlayer ? gameState.players.find(p => p.id === ruinPlayer) : null;
    const color = owner ? owner.color : '#888';

    if (ruin.status === 'captured') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, HEX_SIZE * 0.75, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, HEX_SIZE * 0.68, 0, Math.PI * 2);
      ctx.strokeStyle = color + '80';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (ruin.status === 'excavating') {
      const progress = ruin.progress || 0;
      const maxProgress = gameState.ruins?.find(r => r.q === tile.q && r.r === tile.r)?.maxProgress || 3;
      const percent = progress / maxProgress;

      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.arc(x, y, HEX_SIZE * 0.75, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, HEX_SIZE * 0.75, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * percent);
      ctx.stroke();

      ctx.font = 'bold 9px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(`${progress}/${maxProgress}`, x, y + HEX_SIZE * 0.55);
    } else {
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(x, y, HEX_SIZE * 0.75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  const drawBase = (ctx, base, color) => {
    const { x, y } = hexToPixel(base.q, base.r);
    
    ctx.beginPath();
    ctx.arc(x, y, HEX_SIZE * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText('🏠', x, y);
  };

  const drawSubmarine = (ctx, sub, color, isOwn) => {
    const { x, y } = hexToPixel(sub.q, sub.r);
    const subConfig = CONFIG.SUBMARINE_TYPES[sub.type];
    
    const isVisible = gameState.currentPlayer ? 
      sub.ownerId === gameState.currentPlayer.id || 
      gameState.map[`${sub.q},${sub.r}`]?.visible : 
      false;
    
    if (!isVisible && !isOwn) return;
    
    ctx.beginPath();
    ctx.arc(x, y + 3, HEX_SIZE * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(subConfig?.icon || '🚢', x, y + 3);
    
    if (isOwn) {
      const healthPercent = sub.hull / sub.maxHull;
      const barWidth = HEX_SIZE * 0.8;
      const barHeight = 4;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(x - barWidth / 2, y + HEX_SIZE * 0.4, barWidth, barHeight);
      
      ctx.fillStyle = healthPercent > 0.5 ? '#4caf50' : healthPercent > 0.25 ? '#ff9800' : '#f44336';
      ctx.fillRect(x - barWidth / 2, y + HEX_SIZE * 0.4, barWidth * healthPercent, barHeight);
    }
    
    if (sub.status === 'sunk') {
      ctx.globalAlpha = 0.5;
    }
  };

  const drawHoverHighlight = (ctx, hex) => {
    const { x, y } = hexToPixel(hex.q, hex.r);
    const corners = getHexCorners(x, y, HEX_SIZE);
    
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const drawSelectedHighlight = (ctx, sub) => {
    const { x, y } = hexToPixel(sub.q, sub.r);
    
    ctx.beginPath();
    ctx.arc(x, y, HEX_SIZE * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const drawMovementRange = (ctx, sub) => {
    const range = sub.movementLeft;
    if (range <= 0) return;
    
    const tiles = getTilesInRange(sub.q, sub.r, range);
    for (const tileKey of tiles) {
      const [q, r] = tileKey.split(',').map(Number);
      const { x, y } = hexToPixel(q, r);
      const corners = getHexCorners(x, y, HEX_SIZE * 0.9);
      
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }
      ctx.closePath();
      
      ctx.fillStyle = 'rgba(100, 181, 246, 0.2)';
      ctx.fill();
    }
  };

  const drawPathPreview = (ctx) => {
    if (pathPreview.length < 1) return;
    
    const sub = gameState.currentPlayer.submarines.find(s => s.id === selectedSubmarine);
    if (!sub) return;
    
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    
    const start = hexToPixel(sub.q, sub.r);
    let prevX = start.x;
    let prevY = start.y;
    
    for (const point of pathPreview) {
      const { x, y } = hexToPixel(point.q, point.r);
      
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);
      
      if (point.cost === 0) {
        ctx.strokeStyle = '#4caf50';
      } else if (point.cost === 2) {
        ctx.strokeStyle = '#f44336';
      } else {
        ctx.strokeStyle = '#ffd700';
      }
      ctx.stroke();
      
      prevX = x;
      prevY = y;
    }
    
    ctx.setLineDash([]);
    
    for (const point of pathPreview) {
      const { x, y } = hexToPixel(point.q, point.r);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      if (point.cost === 0) {
        ctx.fillStyle = '#4caf50';
      } else if (point.cost === 2) {
        ctx.fillStyle = '#f44336';
      } else {
        ctx.fillStyle = '#ffd700';
      }
      ctx.fill();
    }
  };

  const drawSonarBuoys = (ctx) => {
    const myBuoys = gameState.currentPlayer?.sonarBuoys || [];
    
    for (const buoy of myBuoys) {
      const { x, y } = hexToPixel(buoy.q, buoy.r);
      
      ctx.beginPath();
      ctx.arc(x, y, HEX_SIZE * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100, 181, 246, 0.6)';
      ctx.fill();
      ctx.strokeStyle = '#64b5f6';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText('📡', x, y);
      
      const rangeTiles = [];
      for (let dq = -buoy.range; dq <= buoy.range; dq++) {
        for (let dr = Math.max(-buoy.range, -dq - buoy.range); dr <= Math.min(buoy.range, -dq + buoy.range); dr++) {
          const key = `${buoy.q + dq},${buoy.r + dr}`;
          if (gameState.map[key]) rangeTiles.push(key);
        }
      }
      
      for (const tileKey of rangeTiles) {
        const [tq, tr] = tileKey.split(',').map(Number);
        const { x: tx, y: ty } = hexToPixel(tq, tr);
        const corners = getHexCorners(tx, ty, HEX_SIZE * 0.95);
        
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < 6; i++) {
          ctx.lineTo(corners[i].x, corners[i].y);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(100, 181, 246, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  };

  const drawBuoyDeployOverlay = (ctx) => {
    const buoys = gameState.currentPlayer?.sonarBuoys || [];
    
    const allVisibleTiles = Object.values(gameState.map).filter(t => t.visible);
    for (const tile of allVisibleTiles) {
      const { x, y } = hexToPixel(tile.q, tile.r);
      const corners = getHexCorners(x, y, HEX_SIZE * 0.95);
      
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < 6; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(100, 181, 246, 0.1)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(100, 181, 246, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    if (hoveredHex) {
      const { x, y } = hexToPixel(hoveredHex.q, hoveredHex.r);
      
      for (let dq = -3; dq <= 3; dq++) {
        for (let dr = Math.max(-3, -dq - 3); dr <= Math.min(3, -dq + 3); dr++) {
          const previewQ = hoveredHex.q + dq;
          const previewR = hoveredHex.r + dr;
          const key = `${previewQ},${previewR}`;
          if (gameState.map[key]) {
            const { x: tx, y: ty } = hexToPixel(previewQ, previewR);
            const corners = getHexCorners(tx, ty, HEX_SIZE * 0.9);
            
            ctx.beginPath();
            ctx.moveTo(corners[0].x, corners[0].y);
            for (let i = 1; i < 6; i++) {
              ctx.lineTo(corners[i].x, corners[i].y);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(100, 181, 246, 0.15)';
            ctx.fill();
          }
        }
      }
    }
  };

  const drawCurrentIndicators = (ctx) => {
    const dir = gameState.currentDirection;
    if (!dir) return;
    
    const visibleTiles = Object.values(gameState.map).filter(t => t.visible);
    const step = 5;
    
    for (let i = 0; i < visibleTiles.length; i += step) {
      const tile = visibleTiles[i];
      const { x, y } = hexToPixel(tile.q, tile.r);
      
      const arrowLen = HEX_SIZE * 0.4;
      const endX = x + dir.q * arrowLen * 1.5;
      const endY = y + dir.r * arrowLen * 1.5;
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      const angle = Math.atan2(endY - y, endX - x);
      const headLen = 6;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - headLen * Math.cos(angle - Math.PI / 6), endY - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - headLen * Math.cos(angle + Math.PI / 6), endY - headLen * Math.sin(angle + Math.PI / 6));
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  const getTilesInRange = (q, r, range) => {
    const tiles = [];
    for (let dq = -range; dq <= range; dq++) {
      for (let dr = Math.max(-range, -dq - range); dr <= Math.min(range, -dq + range); dr++) {
        const key = `${q + dq},${r + dr}`;
        if (gameState.map[key]) {
          tiles.push(key);
        }
      }
    }
    return tiles;
  };

  const handleMouseDown = (e) => {
    if (buoyDeployMode && e.button === 0) return;
    if (e.button === 2 || e.button === 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setOffsetStart({ ...offset });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - offset.x) / zoom;
    const mouseY = (e.clientY - rect.top - offset.y) / zoom;
    
    const hex = pixelToHex(mouseX, mouseY);
    const tileKey = `${hex.q},${hex.r}`;
    
    if (gameState?.map?.[tileKey]) {
      setHoveredHex(hex);
    } else {
      setHoveredHex(null);
    }

    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setOffset({
        x: offsetStart.x + dx,
        y: offsetStart.y + dy
      });
    }

    if (selectedSubmarine && hoveredHex && gameState?.map?.[`${hoveredHex.q},${hoveredHex.r}`]) {
      const sub = gameState.currentPlayer.submarines.find(s => s.id === selectedSubmarine);
      if (sub) {
        const path = calculatePath(sub.q, sub.r, hoveredHex.q, hoveredHex.r, sub.movementLeft);
        setPathPreview(path);
      }
    }
  };

  const handleMouseUp = (e) => {
    if (isDragging) {
      setIsDragging(false);
      return;
    }

    if (e.button === 0 && hoveredHex) {
      handleTileClick(hoveredHex);
    }
  };

  const calculatePath = (startQ, startR, endQ, endR, maxMovement) => {
    const path = [];
    let currentQ = startQ;
    let currentR = startR;
    let movementLeft = maxMovement;
    
    while ((currentQ !== endQ || currentR !== endR) && movementLeft >= 0) {
      const dq = endQ - currentQ;
      const dr = endR - currentR;
      
      let stepQ = 0;
      let stepR = 0;
      
      if (dq !== 0 && dr !== 0) {
        const absDq = Math.abs(dq);
        const absDr = Math.abs(dr);
        if (absDq >= absDr) {
          stepQ = Math.sign(dq);
          stepR = dr !== 0 ? Math.sign(dr) : 0;
        } else {
          stepQ = dq !== 0 ? Math.sign(dq) : 0;
          stepR = Math.sign(dr);
        }
      } else if (dq !== 0) {
        stepQ = Math.sign(dq);
      } else if (dr !== 0) {
        stepR = Math.sign(dr);
      }
      
      const nextQ = currentQ + stepQ;
      const nextR = currentR + stepR;
      const key = `${nextQ},${nextR}`;
      if (!gameState.map[key]) break;
      
      const cost = getMovementCost(currentQ, currentR, nextQ, nextR, gameState.currentDirection);
      
      if (cost > movementLeft) break;
      
      movementLeft -= cost;
      currentQ = nextQ;
      currentR = nextR;
      path.push({ q: currentQ, r: currentR, cost });
      
      if (path.length > 50) break;
    }
    
    return path;
  };

  const handleTileClick = (hex) => {
    const tileKey = `${hex.q},${hex.r}`;
    const tile = gameState.map[tileKey];
    if (!tile) return;

    if (buoyDeployMode && gameState.phase === 'planning') {
      deploySonarBuoy(hex.q, hex.r);
      return;
    }

    setSelectedTile({ q: hex.q, r: hex.r, ...tile });

    let clickedSubmarine = null;
    for (const player of gameState.players) {
      for (const sub of player.submarines) {
        if (sub.q === hex.q && sub.r === hex.r) {
          clickedSubmarine = sub;
          break;
        }
      }
      if (clickedSubmarine) break;
    }

    if (clickedSubmarine && clickedSubmarine.ownerId === gameState.currentPlayer.id) {
      setSelectedSubmarine(clickedSubmarine.id);
      setPathPreview([]);
    } else if (selectedSubmarine && tile.visible) {
      const sub = gameState.currentPlayer.submarines.find(s => s.id === selectedSubmarine);
      if (sub && sub.movementLeft > 0 && gameState.phase === 'planning') {
        const path = calculatePath(sub.q, sub.r, hex.q, hex.r, sub.movementLeft);
        if (path.length > 0) {
          moveSubmarine(selectedSubmarine, path);
          setPathPreview([]);
        }
      }
    } else {
      setSelectedSubmarine(null);
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.3, Math.min(2, z * delta)));
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    if (selectedSubmarine) {
      setSelectedSubmarine(null);
      setPathPreview([]);
    }
  };

  return (
    <div 
      className={`hex-map-container ${buoyDeployMode ? 'buoy-deploy-cursor' : ''}`}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { setIsDragging(false); setHoveredHex(null); }}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
    >
      <canvas
        ref={canvasRef}
        className="hex-canvas"
      />
      
      <div className="map-controls">
        <button className="zoom-btn" onClick={() => setZoom(z => Math.min(2, z * 1.2))}>+</button>
        <button className="zoom-btn" onClick={() => setZoom(z => Math.max(0.3, z * 0.8))}>−</button>
        <button 
          className="zoom-btn" 
          onClick={() => {
            if (gameState?.currentPlayer?.base) {
              const base = gameState.currentPlayer.base;
              const { x, y } = hexToPixel(base.q, base.r);
              setOffset({ x: canvasSize.width / 2 - x, y: canvasSize.height / 2 - y });
            }
          }}
        >
          🏠
        </button>
      </div>

      {hoveredHex && gameState?.map?.[`${hoveredHex.q},${hoveredHex.r}`] && (
        <div className="tile-tooltip">
          <div>位置: ({hoveredHex.q}, {hoveredHex.r})</div>
          <div>深度: {gameState.map[`${hoveredHex.q},${hoveredHex.r}`]?.depth}m</div>
          <div>地形: {CONFIG.TERRAIN_TYPES[gameState.map[`${hoveredHex.q},${hoveredHex.r}`]?.terrain]?.name || '未知'}</div>
          {gameState.map[`${hoveredHex.q},${hoveredHex.r}`]?.resources > 0 && (
            <div>资源: {gameState.map[`${hoveredHex.q},${hoveredHex.r}`].resources}</div>
          )}
          {gameState.map[`${hoveredHex.q},${hoveredHex.r}`]?.ruin && (() => {
            const ruin = gameState.map[`${hoveredHex.q},${hoveredHex.r}`].ruin;
            const statusText = { idle: '空闲', excavating: '发掘中', captured: '已占领' }[ruin.status] || ruin.status;
            const ownerName = ruin.ownerId ? gameState.players.find(p => p.id === ruin.ownerId)?.name : null;
            const excavatorName = ruin.excavatorPlayerId ? gameState.players.find(p => p.id === ruin.excavatorPlayerId)?.name : null;
            const maxProg = gameState.ruins?.find(r => r.q === hoveredHex.q && r.r === hoveredHex.r)?.maxProgress || 3;
            return (
              <>
                <div className="ruin-tooltip">
                  <div>遗迹状态: {statusText}</div>
                  {ownerName && <div>归属: {ownerName}</div>}
                  {ruin.status === 'excavating' && excavatorName && (
                    <div>发掘者: {excavatorName} ({ruin.progress}/{maxProg})</div>
                  )}
                </div>
              </>
            );
          })()}
          {gameState.currentDirection && (
            <div className="current-info">
              洋流: → {getCurrentDirectionName(gameState.currentDirection)}
              <span className="current-hint"> (顺流+2 / 逆流-1)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HexMap;
