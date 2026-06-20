import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { CONFIG, HEX_SIZE, hexToPixel, pixelToHex, getHexCorners, hexDistance } from '../game/gameConfig';
import '../styles/HexMap.css';

function HexMap() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const { gameState, selectedSubmarine, setSelectedSubmarine, setSelectedTile, moveSubmarine } = useGame();
  
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [offsetStart, setOffsetStart] = useState({ x: 0, y: 0 });
  const [hoveredHex, setHoveredHex] = useState(null);
  const [pathPreview, setPathPreview] = useState([]);

  const canvasWidth = 800;
  const canvasHeight = 600;

  useEffect(() => {
    if (gameState && gameState.currentPlayer) {
      const base = gameState.currentPlayer.base;
      const { x, y } = hexToPixel(base.q, base.r);
      setOffset({ x: canvasWidth / 2 - x, y: canvasHeight / 2 - y });
    }
  }, [gameState?.currentPlayer?.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
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
  }, [gameState, offset, zoom, hoveredHex, selectedSubmarine, pathPreview]);

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
    
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    
    ctx.beginPath();
    const start = hexToPixel(sub.q, sub.r);
    ctx.moveTo(start.x, start.y);
    
    for (const point of pathPreview) {
      const { x, y } = hexToPixel(point.q, point.r);
      ctx.lineTo(x, y);
    }
    
    ctx.stroke();
    ctx.setLineDash([]);
    
    for (const point of pathPreview) {
      const { x, y } = hexToPixel(point.q, point.r);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd700';
      ctx.fill();
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

  const calculatePath = (startQ, startR, endQ, endR, maxSteps) => {
    const path = [];
    let currentQ = startQ;
    let currentR = startR;
    let steps = 0;
    
    while ((currentQ !== endQ || currentR !== endR) && steps < maxSteps) {
      const dq = Math.sign(endQ - currentQ);
      const dr = Math.sign(endR - currentR);
      
      if (dq !== 0) {
        currentQ += dq;
      } else if (dr !== 0) {
        currentR += dr;
      }
      
      const key = `${currentQ},${currentR}`;
      if (!gameState.map[key]) break;
      
      path.push({ q: currentQ, r: currentR });
      steps++;
    }
    
    return path;
  };

  const handleTileClick = (hex) => {
    const tileKey = `${hex.q},${hex.r}`;
    const tile = gameState.map[tileKey];
    if (!tile) return;

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
      className="hex-map-container" 
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
        width={canvasWidth}
        height={canvasHeight}
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
              setOffset({ x: canvasWidth / 2 - x, y: canvasHeight / 2 - y });
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
        </div>
      )}
    </div>
  );
}

export default HexMap;
