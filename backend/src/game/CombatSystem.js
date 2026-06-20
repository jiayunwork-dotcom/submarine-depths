const CONFIG = require('./config');

class CombatSystem {
  static calculateHitChance(distance, attackerTech) {
    let baseChance;
    switch (distance) {
      case 1: baseChance = 0.9; break;
      case 2: baseChance = 0.7; break;
      case 3: baseChance = 0.5; break;
      default: baseChance = 0.3;
    }
    
    if (attackerTech && attackerTech.has('TORPEDO_GUIDANCE')) {
      baseChance += 0.15;
    }
    
    return Math.min(0.95, baseChance);
  }

  static calculateDamage(baseDamage, targetTile, targetHull) {
    let damage = baseDamage;
    
    const terrain = CONFIG.TERRAIN_TYPES[targetTile.terrain];
    if (terrain && terrain.cover) {
      damage *= (1 - terrain.cover);
    }
    
    return Math.floor(damage);
  }

  static fireTorpedo(attacker, target, map) {
    const results = [];
    
    if (attacker.torpedoes <= 0) {
      return { hit: false, message: 'No torpedoes remaining' };
    }
    
    attacker.torpedoes--;
    
    const distance = map.getDistance(attacker.q, attacker.r, target.q, target.r);
    
    if (distance > attacker.torpedoRange) {
      return { hit: false, message: 'Target out of range' };
    }
    
    const hitChance = this.calculateHitChance(distance, null);
    const hit = Math.random() < hitChance;
    
    if (hit) {
      const targetTile = map.getTile(target.q, target.r);
      const damage = this.calculateDamage(attacker.torpedoDamage, targetTile);
      target.damage(damage);
      
      results.push({
        type: 'torpedo_hit',
        attacker: attacker.id,
        target: target.id,
        damage,
        distance,
        targetDestroyed: target.status === 'sunk'
      });
    } else {
      results.push({
        type: 'torpedo_miss',
        attacker: attacker.id,
        target: target.id,
        distance
      });
    }
    
    return { hit, results };
  }

  static processCombat(players, map, allianceManager = null) {
    const combatEvents = [];
    const allSubmarines = [];
    
    for (const player of players) {
      for (const sub of player.submarines) {
        if (sub.status !== 'sunk' && sub.type === 'COMBAT' && sub.actions) {
          allSubmarines.push({ sub, player });
        }
      }
    }
    
    for (const { sub, player } of allSubmarines) {
      for (const action of sub.actions || []) {
        if (action.type === 'fire_torpedo') {
          let target = null;
          let targetPlayer = null;
          
          for (const p of players) {
            const found = p.getSubmarine(action.targetId);
            if (found) {
              target = found;
              targetPlayer = p;
              break;
            }
          }
          
          if (!target || target.status === 'sunk') continue;
          
          if (allianceManager && allianceManager.areAllied(player.id, targetPlayer.id)) {
            continue;
          }
          
          const result = this.fireTorpedo(sub, target, map);
          if (result.results) {
            for (const event of result.results) {
              event.attackerPlayerId = player.id;
              event.targetPlayerId = targetPlayer.id;
            }
            combatEvents.push(...result.results);
          }
        }
      }
    }
    
    return combatEvents;
  }

  static getDistanceToAllyBase(q, r, playerId, players, allianceManager) {
    let minDist = null;
    for (const player of players) {
      if (allianceManager.areAllied(playerId, player.id)) {
        const dist = this.hexDistance(q, r, player.base.q, player.base.r);
        if (minDist === null || dist < minDist) {
          minDist = dist;
        }
      }
    }
    return minDist;
  }

  static hexDistance(q1, r1, q2, r2) {
    return Math.max(Math.abs(q1 - q2), Math.abs(r1 - r2), Math.abs((q1 + r1) - (q2 + r2)));
  }

  static baseAttack(attackerSub, targetBase, map) {
    const distance = map.getDistance(attackerSub.q, attackerSub.r, targetBase.q, targetBase.r);
    
    if (distance > attackerSub.torpedoRange) {
      return { hit: false, message: 'Base out of range' };
    }
    
    if (attackerSub.torpedoes <= 0) {
      return { hit: false, message: 'No torpedoes' };
    }
    
    attackerSub.torpedoes--;
    
    const hitChance = this.calculateHitChance(distance, null);
    const hit = Math.random() < hitChance;
    
    if (hit) {
      const damage = Math.floor(attackerSub.torpedoDamage * 0.5);
      const destroyed = targetBase.damageCore(damage);
      
      return {
        hit: true,
        damage,
        destroyed
      };
    }
    
    return { hit: false };
  }
}

module.exports = CombatSystem;
