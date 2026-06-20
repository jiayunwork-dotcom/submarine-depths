export const CONFIG = {
  MAP_SIZE: 40,
  MAX_TURNS: 80,
  PLANNING_TIME: 90,
  
  DEPTH_LEVELS: {
    SHALLOW: { name: '浅海', color: '#4fc3f7' },
    MID: { name: '中层', color: '#29b6f6' },
    DEEP: { name: '深海', color: '#0288d1' },
    ABYSS: { name: '超深渊', color: '#01579b' }
  },
  
  TERRAIN_TYPES: {
    FLAT: { name: '平原', color: '#1a237e', icon: '' },
    ROCKY: { name: '岩石群', color: '#546e7a', icon: '🪨' },
    CANYON: { name: '海底峡谷', color: '#37474f', icon: '🏔️' },
    HYDROTHERMAL: { name: '海底热泉', color: '#ff5722', icon: '♨️' },
    MINERAL: { name: '矿脉', color: '#9e9d24', icon: '💎' },
    WRECK: { name: '沉船遗迹', color: '#8d6e63', icon: '🚢' },
    BIOME: { name: '生物群落', color: '#66bb6a', icon: '🐠' },
    VOLCANO: { name: '海底火山', color: '#d32f2f', icon: '🌋' },
    RUIN: { name: '深海遗迹', color: '#ab47bc', icon: '🏛️' }
  },
  
  SUBMARINE_TYPES: {
    SCOUT: { name: '侦察艇', icon: '🔍', color: '#64b5f6' },
    MINER: { name: '采矿艇', icon: '⛏️', color: '#ffb74d' },
    COMBAT: { name: '战斗艇', icon: '🚀', color: '#ef5350' },
    TRANSPORT: { name: '运输艇', icon: '📦', color: '#81c784' },
    SCIENCE: { name: '科考艇', icon: '🔬', color: '#ba68c8' }
  },
  
  BASE_MODULES: {
    DOCK: { name: '船坞', icon: '🏭', description: '建造和维修潜艇' },
    LAB: { name: '实验室', icon: '🧪', description: '研究新技术' },
    STORAGE: { name: '储存舱', icon: '📦', description: '存放矿物和样本' },
    POWER: { name: '能源站', icon: '⚡', description: '为基地供电' },
    THERMAL_POWER: { name: '热泉发电站', icon: '🌋', description: '利用热泉发电' },
    SONAR_ARRAY: { name: '声呐阵列', icon: '📡', description: '扩大侦测范围' },
    TORPEDO_BAY: { name: '鱼雷库', icon: '💣', description: '储存和生产鱼雷' },
    ECO_POD: { name: '生态舱', icon: '🐟', description: '养殖深海生物' }
  },
  
  RESEARCH_TECHS: {
    DEPTH_1000: { name: '深潜技术I', cost: 20, description: '允许潜艇下潜至1000m' },
    DEPTH_2000: { name: '深潜技术II', cost: 40, description: '允许潜艇下潜至2000m' },
    DEPTH_3000: { name: '深潜技术III', cost: 80, description: '允许潜艇下潜至3000m' },
    ADVANCED_SONAR: { name: '高级声呐', cost: 30, description: '声呐范围+2' },
    REINFORCED_HULL: { name: '强化船体', cost: 50, description: '潜艇耐久+20%' },
    EFFICIENT_MINING: { name: '高效采矿', cost: 25, description: '采矿效率+30%' },
    TORPEDO_GUIDANCE: { name: '鱼雷制导', cost: 35, description: '鱼雷命中率+15%' },
    ADVANCED_PROPULSION: { name: '先进推进', cost: 45, description: '移动力+1' }
  },
  
  COLORS: [
    '#3498db',
    '#e74c3c',
    '#2ecc71',
    '#f39c12',
    '#9b59b6',
    '#1abc9c'
  ]
};

export const HEX_SIZE = 28;

export function hexToPixel(q, r, size = HEX_SIZE) {
  const x = size * (3/2 * q);
  const y = size * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
  return { x, y };
}

export function pixelToHex(x, y, size = HEX_SIZE) {
  const q = (2/3 * x) / size;
  const r = (-1/3 * x + Math.sqrt(3)/3 * y) / size;
  return hexRound(q, r);
}

export function hexRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);

  const qDiff = Math.abs(rq - q);
  const rDiff = Math.abs(rr - r);
  const sDiff = Math.abs(rs - s);

  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs;
  } else if (rDiff > sDiff) {
    rr = -rq - rs;
  }

  return { q: rq, r: rr };
}

export function getHexCorners(cx, cy, size = HEX_SIZE) {
  const corners = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    corners.push({
      x: cx + size * Math.cos(angle),
      y: cy + size * Math.sin(angle)
    });
  }
  return corners;
}

export function hexDistance(q1, r1, q2, r2) {
  return Math.max(Math.abs(q1 - q2), Math.abs(r1 - r2), Math.abs((q1 + r1) - (q2 + r2)));
}

export const HEX_DIRECTIONS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
];

export function getMovementCost(fromQ, fromR, toQ, toR, currentDirection) {
  if (!currentDirection) return 1;
  const dq = toQ - fromQ;
  const dr = toR - fromR;
  const dot = dq * currentDirection.q + dr * currentDirection.r;
  if (dot > 0) return 0;
  if (dot < 0) return 2;
  return 1;
}

export function getCurrentDirectionName(dir) {
  if (!dir) return '无';
  const names = {
    '1,0': '东', '1,-1': '东北', '0,-1': '西北',
    '-1,0': '西', '-1,1': '西南', '0,1': '东南'
  };
  return names[`${dir.q},${dir.r}`] || '未知';
}
