const CONFIG = {
  MAP_SIZE: 40,
  MAX_TURNS: 80,
  PLANNING_TIME: 90,
  RECONNECT_TIME: 30,
  MIN_PLAYERS: 4,
  MAX_PLAYERS: 6,
  CURRENT_CHANGE_INTERVAL: 5,

  DEPTH_LEVELS: {
    SHALLOW: { name: '浅海', min: 0, max: 200, pressure: 1 },
    MID: { name: '中层', min: 200, max: 1000, pressure: 2 },
    DEEP: { name: '深海', min: 1000, max: 3000, pressure: 3 },
    ABYSS: { name: '超深渊', min: 3000, max: 10000, pressure: 4 }
  },

  TERRAIN_TYPES: {
    FLAT: { name: '平原', moveCost: 1, cover: 0 },
    ROCKY: { name: '岩石群', moveCost: 2, cover: 0.4 },
    CANYON: { name: '海底峡谷', moveCost: 1, cover: 0.3, restricted: true },
    HYDROTHERMAL: { name: '海底热泉', moveCost: 1, energy: true },
    MINERAL: { name: '矿脉', moveCost: 1, resource: 'mineral' },
    WRECK: { name: '沉船遗迹', moveCost: 1, relic: true },
    BIOME: { name: '生物群落', moveCost: 1, resource: 'bio_sample' },
    VOLCANO: { name: '海底火山', moveCost: 2, danger: true },
    RUIN: { name: '深海遗迹', moveCost: 1, controlPoint: true }
  },

  SUBMARINE_TYPES: {
    SCOUT: {
      name: '侦察艇',
      hull: 50,
      maxDepth: 3000,
      movement: 6,
      cargo: 10,
      energy: 50,
      sonarRange: 5,
      cost: { mineral: 30, tech: 0 },
      buildTime: 2
    },
    MINER: {
      name: '采矿艇',
      hull: 80,
      maxDepth: 1000,
      movement: 3,
      cargo: 80,
      energy: 60,
      sonarRange: 2,
      miningEfficiency: 2,
      cost: { mineral: 60, tech: 5 },
      buildTime: 3
    },
    COMBAT: {
      name: '战斗艇',
      hull: 120,
      maxDepth: 2000,
      movement: 4,
      cargo: 20,
      energy: 70,
      sonarRange: 3,
      torpedoDamage: 30,
      torpedoRange: 3,
      cost: { mineral: 100, tech: 15 },
      buildTime: 4
    },
    TRANSPORT: {
      name: '运输艇',
      hull: 70,
      maxDepth: 1000,
      movement: 3,
      cargo: 200,
      energy: 50,
      sonarRange: 2,
      cost: { mineral: 50, tech: 3 },
      buildTime: 3
    },
    SCIENCE: {
      name: '科考艇',
      hull: 60,
      maxDepth: 3000,
      movement: 4,
      cargo: 30,
      energy: 60,
      sonarRange: 4,
      scienceBonus: 2,
      cost: { mineral: 45, tech: 10 },
      buildTime: 3
    }
  },

  BASE_MODULES: {
    DOCK: {
      name: '船坞',
      description: '建造和维修潜艇',
      cost: { mineral: 100 },
      energyCost: 5,
      maxSubs: 2
    },
    LAB: {
      name: '实验室',
      description: '研究新技术解锁深潜能力',
      cost: { mineral: 80, tech: 10 },
      energyCost: 8,
      researchSpeed: 1
    },
    STORAGE: {
      name: '储存舱',
      description: '存放矿物和样本',
      cost: { mineral: 50 },
      energyCost: 2,
      capacity: 500
    },
    POWER: {
      name: '能源站',
      description: '为基地供电',
      cost: { mineral: 120 },
      energyOutput: 50,
      type: 'nuclear'
    },
    THERMAL_POWER: {
      name: '热泉发电站',
      description: '利用热泉发电',
      cost: { mineral: 80 },
      energyOutput: 30,
      requiresHydrothermal: true
    },
    SONAR_ARRAY: {
      name: '声呐阵列',
      description: '扩大侦测范围',
      cost: { mineral: 60, tech: 5 },
      energyCost: 10,
      detectionRange: 8
    },
    TORPEDO_BAY: {
      name: '鱼雷库',
      description: '储存和生产鱼雷',
      cost: { mineral: 70, tech: 5 },
      energyCost: 3,
      torpedoCapacity: 20
    },
    ECO_POD: {
      name: '生态舱',
      description: '养殖深海生物',
      cost: { mineral: 90, tech: 8 },
      energyCost: 6,
      bioProduction: 5
    }
  },

  RESEARCH_TECHS: {
    DEPTH_1000: { name: '深潜技术I', cost: 20, effect: '允许潜艇下潜至1000m', prerequisite: null },
    DEPTH_2000: { name: '深潜技术II', cost: 40, effect: '允许潜艇下潜至2000m', prerequisite: 'DEPTH_1000' },
    DEPTH_3000: { name: '深潜技术III', cost: 80, effect: '允许潜艇下潜至3000m', prerequisite: 'DEPTH_2000' },
    ADVANCED_SONAR: { name: '高级声呐', cost: 30, effect: '声呐范围+2', prerequisite: 'DEPTH_1000' },
    REINFORCED_HULL: { name: '强化船体', cost: 50, effect: '潜艇耐久+20%', prerequisite: 'DEPTH_2000' },
    EFFICIENT_MINING: { name: '高效采矿', cost: 25, effect: '采矿效率+30%', prerequisite: null },
    TORPEDO_GUIDANCE: { name: '鱼雷制导', cost: 35, effect: '鱼雷命中率+15%', prerequisite: 'ADVANCED_SONAR' },
    ADVANCED_PROPULSION: { name: '先进推进', cost: 45, effect: '移动力+1', prerequisite: 'DEPTH_1000' }
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

module.exports = CONFIG;
