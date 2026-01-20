import { GAME_CONFIG } from './config';
import { mulberry32, weightedRoll } from './rng';
import { ENEMY_TYPES, ITEM_TEMPLATES } from './data';

export const createInitialPlayer = (seed) => ({
  id: 'player',
  x: 2,
  y: 2,
  hp: GAME_CONFIG.player.base.maxHp,
  maxHp: GAME_CONFIG.player.base.maxHp,
  level: 1,
  xp: 0,
  critChance: GAME_CONFIG.player.base.critChance,
  baseStats: { ...GAME_CONFIG.player.base },
  gear: {
    Weapon: null,
    Armor: null,
    Accessory: null
  },
  inventory: Array.from({ length: 20 }, () => null),
  seed,
  deathCount: 0
});

export const createEnemy = (typeId, zoneTier) => {
  const type = ENEMY_TYPES[typeId];
  const tierMultiplier = 1 + (zoneTier - 1) * 0.35;
  return {
    id: `${typeId}-${Math.random().toString(16).slice(2)}`,
    type: typeId,
    name: type.name,
    hp: Math.round(type.baseHp * tierMultiplier),
    maxHp: Math.round(type.baseHp * tierMultiplier),
    damage: Math.round(type.damage * tierMultiplier),
    defense: Math.round(type.defense * tierMultiplier),
    speed: type.speed,
    xp: type.xp,
    lootTable: type.lootTable,
    state: 'idle',
    attackCooldown: 0
  };
};

export const getEquippedStats = (player) => {
  const mods = { damage: 0, hp: 0, defense: 0, speed: 0, critChance: 0 };
  Object.values(player.gear).forEach((item) => {
    if (!item) return;
    Object.entries(item.stats).forEach(([key, value]) => {
      mods[key] = (mods[key] || 0) + value;
    });
  });
  return mods;
};

export const calculatePlayerStats = (player) => {
  const gearMods = getEquippedStats(player);
  const base = player.baseStats;
  const maxHp = Math.max(1, base.maxHp + gearMods.hp);
  const damage = Math.max(0, base.damage + gearMods.damage);
  const defense = Math.max(0, base.defense + gearMods.defense);
  const speedMultiplier = 1 + (gearMods.speed || 0);
  const speed = base.speed * speedMultiplier;
  const critChance = Math.min(0.5, Math.max(0, base.critChance + (gearMods.critChance || 0)));

  return {
    maxHp,
    damage,
    defense,
    speed,
    critChance
  };
};

export const applyDamage = (target, amount) => {
  const mitigated = Math.max(1, Math.round(amount - target.defense));
  target.hp = Math.max(0, target.hp - mitigated);
  return mitigated;
};

export const resolvePlayerAttack = (playerStats, rng, baseDamage) => {
  const critRoll = rng();
  const isCrit = critRoll < playerStats.critChance;
  const damage = isCrit ? baseDamage * GAME_CONFIG.combat.critMultiplier : baseDamage;
  return { damage: Math.round(damage), isCrit };
};

export const gainXp = (player, xpAmount) => {
  const { maxLevel, xpTable, hpRestoreOnLevel } = GAME_CONFIG.leveling;
  const currentLevel = player.level;
  if (currentLevel >= maxLevel) {
    return { leveled: false };
  }
  let xp = player.xp + xpAmount;
  let level = currentLevel;
  let leveled = false;
  while (level < maxLevel && xp >= xpTable[level + 1]) {
    level += 1;
    leveled = true;
  }
  player.level = level;
  player.xp = xp;
  if (leveled) {
    const stats = calculatePlayerStats(player);
    player.maxHp = stats.maxHp;
    player.hp = Math.min(stats.maxHp, player.hp + stats.maxHp * hpRestoreOnLevel);
    player.baseStats.maxHp += 8;
    player.baseStats.damage += 2;
    player.baseStats.defense += 1;
  }
  return { leveled };
};

export const applyXpPenalty = (player) => {
  const { xpTable } = GAME_CONFIG.leveling;
  const level = player.level;
  const nextLevelXp = xpTable[level + 1] || xpTable[level];
  const xpToNext = Math.max(0, nextLevelXp - player.xp);
  const penalty = Math.min(xpToNext, Math.round(xpToNext * 0.1));
  player.xp = Math.max(0, player.xp - penalty);
  return penalty;
};

export const rollLoot = (seed, enemyType) => {
  const rng = mulberry32(seed);
  const rarity = weightedRoll(rng, GAME_CONFIG.loot.rarityRolls);
  const template = ITEM_TEMPLATES[Math.floor(rng() * ITEM_TEMPLATES.length)];
  const affixRange = GAME_CONFIG.loot.affixRanges[rarity];
  const affixValue = Math.round(
    affixRange.min + (affixRange.max - affixRange.min) * rng()
  );
  const affixes = ['damage', 'hp', 'defense', 'speed'];
  const affix = affixes[Math.floor(rng() * affixes.length)];
  const stats = { ...template.baseStats };
  if (affix === 'speed') {
    stats.speed = (stats.speed || 0) + affixValue / 100;
  } else {
    stats[affix] = (stats[affix] || 0) + affixValue;
  }

  return {
    id: `${template.id}-${seed}`,
    name: template.name,
    type: template.type,
    rarity,
    stats,
    stackable: template.stackable || false,
    quantity: template.stackable ? 1 : undefined,
    seed,
    enemyType
  };
};

export const canStack = (item, target) => item.stackable && target?.id?.startsWith(item.id.split('-')[0]);

export const addItemToInventory = (inventory, item) => {
  if (item.stackable) {
    for (let i = 0; i < inventory.length; i += 1) {
      const slot = inventory[i];
      if (slot && canStack(item, slot)) {
        slot.quantity = (slot.quantity || 1) + 1;
        return true;
      }
    }
  }
  const index = inventory.findIndex((slot) => slot === null);
  if (index === -1) return false;
  inventory[index] = item;
  return true;
};

export const consumeItem = (player, inventory, index) => {
  const item = inventory[index];
  if (!item || item.type !== 'Consumable') return false;
  const heal = item.stats.heal || 0;
  player.hp = Math.min(player.maxHp, player.hp + heal);
  if (item.quantity && item.quantity > 1) {
    item.quantity -= 1;
  } else {
    inventory[index] = null;
  }
  return true;
};

export const createSeededRun = () => {
  const seed = Math.floor(Math.random() * 1_000_000);
  return {
    seed,
    rng: mulberry32(seed)
  };
};

export const buildCombatLogEntry = (message, type = 'info') => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  message,
  type
});
