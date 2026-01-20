import {
  baseAffixes,
  baseStats,
  enemySpawnTable,
  enemyStats,
  itemNames,
  maxInventorySlots,
  rarityChances,
  rarityMultipliers,
  xpCurve,
  zoneEntries,
  zoneExitTiles,
  zoneMaps,
} from './data';
import { createRng } from './rng';
import type {
  EnemyState,
  EnemyType,
  GameState,
  Item,
  ItemRarity,
  ItemType,
  PlayerState,
  StatBlock,
  ZoneId,
} from './types';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const createNewGame = (seed = Date.now()): GameState => {
  const player: PlayerState = {
    id: 'player-1',
    name: 'Explorer',
    x: zoneEntries.overworld.x,
    y: zoneEntries.overworld.y,
    hp: baseStats.maxHp,
    level: 1,
    xp: 0,
    baseStats: { ...baseStats },
    gearStats: { maxHp: 0, damage: 0, defense: 0, speed: 0, critChance: 0 },
    zoneId: 'overworld',
    inventory: Array.from({ length: maxInventorySlots }, () => ({ item: null, quantity: 0 })),
    equipped: { weapon: null, armor: null, accessory: null },
    lastMeleeAt: 0,
    lastRangedAt: 0,
    isDead: false,
  };

  return {
    seed,
    player,
    zones: {
      overworld: { id: 'overworld', enemies: spawnEnemies('overworld', seed), visited: true },
      subarea: { id: 'subarea', enemies: spawnEnemies('subarea', seed + 42), visited: false },
    },
    projectiles: [],
    floatingText: [],
    muted: false,
    reducedMotion: false,
    highContrast: false,
    lastZoneExitAt: 0,
    logs: [],
  };
};

export const spawnEnemies = (zoneId: ZoneId, seed: number): EnemyState[] => {
  const rng = createRng(seed + zoneId.length * 77);
  const enemyTypes = enemySpawnTable[zoneId];
  const map = zoneMaps[zoneId];
  const enemies: EnemyState[] = [];
  const count = zoneId === 'overworld' ? 6 : 4;
  let attempts = 0;
  while (enemies.length < count && attempts < 200) {
    const x = rng.nextInt(1, map[0].length - 2);
    const y = rng.nextInt(1, map.length - 2);
    const tile = map[y]?.[x];
    if (tile === '0') {
      const type = enemyTypes[rng.nextInt(0, enemyTypes.length - 1)];
      const stats = enemyStats[type];
      enemies.push({
        id: `${zoneId}-${type}-${enemies.length}-${seed}`,
        type,
        x,
        y,
        hp: stats.maxHp,
        maxHp: stats.maxHp,
        zoneId,
        lastAttackAt: 0,
      });
    }
    attempts += 1;
  }
  return enemies;
};

export const getStatTotal = (player: PlayerState): StatBlock => {
  const base = player.baseStats;
  const gear = player.gearStats;
  return {
    maxHp: Math.max(1, base.maxHp + gear.maxHp),
    damage: Math.max(1, base.damage + gear.damage),
    defense: Math.max(0, base.defense + gear.defense),
    speed: Math.max(0.5, base.speed + gear.speed),
    critChance: clamp(base.critChance + gear.critChance, 0, 0.5),
  };
};

export const isWalkable = (zoneId: ZoneId, x: number, y: number): boolean => {
  const map = zoneMaps[zoneId];
  const tile = map[Math.round(y)]?.[Math.round(x)];
  return tile === '0' || tile === '2';
};

export const tryMove = (state: GameState, dx: number, dy: number): GameState => {
  const player = state.player;
  if (player.isDead) return state;
  const stats = getStatTotal(player);
  const speed = stats.speed;
  const nextX = player.x + dx * speed;
  const nextY = player.y + dy * speed;
  if (isWalkable(player.zoneId, nextX, player.y)) {
    player.x = nextX;
  }
  if (isWalkable(player.zoneId, player.x, nextY)) {
    player.y = nextY;
  }
  return { ...state, player: { ...player } };
};

export const checkZoneExit = (state: GameState, now: number): GameState => {
  const exit = zoneExitTiles[state.player.zoneId];
  if (!exit) return state;
  if (Math.round(state.player.x) === exit.x && Math.round(state.player.y) === exit.y) {
    const nextZone = exit.target;
    const entry = zoneEntries[nextZone];
    return {
      ...state,
      player: { ...state.player, zoneId: nextZone, x: entry.x, y: entry.y },
      zones: {
        ...state.zones,
        [nextZone]: {
          ...state.zones[nextZone],
          visited: true,
          enemies: state.zones[nextZone].enemies.length ? state.zones[nextZone].enemies : spawnEnemies(nextZone, state.seed + now),
        },
      },
      lastZoneExitAt: now,
    };
  }
  return state;
};

export const resolveMeleeAttack = (state: GameState, now: number): GameState => {
  const player = state.player;
  const meleeCooldown = 500;
  if (now - player.lastMeleeAt < meleeCooldown || player.isDead) return state;
  const zone = state.zones[player.zoneId];
  const stats = getStatTotal(player);
  let didHit = false;
  const rng = createRng(state.seed + Math.floor(now / 100));
  const updatedEnemies = zone.enemies.map((enemy) => {
    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (distance <= 1.4 && enemy.hp > 0) {
      const critRoll = rng.next();
      const crit = critRoll < stats.critChance;
      const damage = Math.max(1, stats.damage * (crit ? 1.5 : 1) - enemyStats[enemy.type].defense);
      didHit = true;
      return { ...enemy, hp: clamp(enemy.hp - damage, 0, enemy.maxHp) };
    }
    return enemy;
  });

  const nextState = {
    ...state,
    player: { ...player, lastMeleeAt: now },
    zones: { ...state.zones, [player.zoneId]: { ...zone, enemies: updatedEnemies } },
  };

  if (didHit) {
    return addFloatingText(nextState, player.x, player.y - 0.6, 'Slash!');
  }
  return nextState;
};

export const resolveRangedAttack = (state: GameState, now: number): GameState => {
  const player = state.player;
  const rangedCooldown = 900;
  if (now - player.lastRangedAt < rangedCooldown || player.isDead) return state;
  const direction = { x: 1, y: 0 };
  const projectile = {
    id: `p-${now}`,
    x: player.x,
    y: player.y,
    vx: direction.x * 6,
    vy: direction.y * 6,
    ttl: 1.2,
  };
  return {
    ...state,
    player: { ...player, lastRangedAt: now },
    projectiles: [...state.projectiles, projectile],
  };
};

export const tickProjectiles = (state: GameState, delta: number): GameState => {
  if (state.projectiles.length === 0) return state;
  const zone = state.zones[state.player.zoneId];
  const stats = getStatTotal(state.player);
  let enemies = zone.enemies;
  const updatedProjectiles = state.projectiles
    .map((projectile) => ({
      ...projectile,
      x: projectile.x + projectile.vx * delta,
      y: projectile.y + projectile.vy * delta,
      ttl: projectile.ttl - delta,
    }))
    .filter((projectile) => projectile.ttl > 0)
    .filter((projectile) => {
      let hit = false;
      enemies = enemies.map((enemy) => {
        if (enemy.hp <= 0) return enemy;
        const distance = Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y);
        if (distance <= 0.6 && !hit) {
          hit = true;
          const damage = Math.max(1, stats.damage * 0.8 - enemyStats[enemy.type].defense);
          return { ...enemy, hp: clamp(enemy.hp - damage, 0, enemy.maxHp) };
        }
        return enemy;
      });
      return !hit;
    });

  return {
    ...state,
    projectiles: updatedProjectiles,
    zones: { ...state.zones, [state.player.zoneId]: { ...zone, enemies } },
  };
};

export const tickEnemies = (state: GameState, now: number, delta: number): GameState => {
  const player = state.player;
  const zone = state.zones[player.zoneId];
  const updatedEnemies = zone.enemies.map((enemy) => {
    if (enemy.hp <= 0) return enemy;
    const stats = enemyStats[enemy.type];
    const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (distance < 3.5) {
      const dirX = (player.x - enemy.x) / (distance || 1);
      const dirY = (player.y - enemy.y) / (distance || 1);
      const nextX = enemy.x + dirX * stats.speed * delta;
      const nextY = enemy.y + dirY * stats.speed * delta;
      if (isWalkable(enemy.zoneId, nextX, enemy.y)) enemy.x = nextX;
      if (isWalkable(enemy.zoneId, enemy.x, nextY)) enemy.y = nextY;
    }
    if (distance < 1.2 && now - enemy.lastAttackAt > 1200) {
      enemy.lastAttackAt = now;
    }
    return { ...enemy };
  });

  let nextState: GameState = {
    ...state,
    zones: { ...state.zones, [player.zoneId]: { ...zone, enemies: updatedEnemies } },
  };

  updatedEnemies.forEach((enemy) => {
    if (enemy.hp > 0) return;
    const alreadyLogged = state.logs.includes(enemy.id);
    if (!alreadyLogged) {
      nextState = rewardKill(nextState, enemy);
      nextState.logs = [...nextState.logs, enemy.id];
    }
  });

  if (!player.isDead) {
    const attackingEnemies = updatedEnemies.filter(
      (enemy) => enemy.hp > 0 && Math.hypot(player.x - enemy.x, player.y - enemy.y) < 1.1 && now - enemy.lastAttackAt < 100
    );
    if (attackingEnemies.length > 0) {
      const totalDamage = attackingEnemies.reduce((sum, enemy) => sum + enemyStats[enemy.type].damage, 0);
      nextState = applyDamage(nextState, totalDamage, now);
    }
  }
  return nextState;
};

export const applyDamage = (state: GameState, amount: number, now: number): GameState => {
  const player = state.player;
  const stats = getStatTotal(player);
  const mitigated = Math.max(1, amount - stats.defense);
  const nextHp = clamp(player.hp - mitigated, 0, stats.maxHp);
  const nextPlayer = { ...player, hp: nextHp, isDead: nextHp <= 0 };
  let nextState = {
    ...state,
    player: nextPlayer,
  };
  nextState = addFloatingText(nextState, player.x, player.y - 0.6, `-${mitigated}`);
  if (nextPlayer.isDead) {
    nextState = handleDeath(nextState, now);
  }
  return nextState;
};

export const handleDeath = (state: GameState, now: number): GameState => {
  const player = state.player;
  if (!player.isDead) return state;
  const xpToNext = xpCurve[player.level] - player.xp;
  const penalty = Math.min(xpToNext, Math.floor(xpToNext * 0.1));
  const respawnHp = Math.floor(getStatTotal(player).maxHp * 0.5);
  return {
    ...state,
    player: {
      ...player,
      xp: Math.max(0, player.xp - penalty),
      hp: respawnHp,
      isDead: false,
      x: zoneEntries[player.zoneId].x,
      y: zoneEntries[player.zoneId].y,
    },
    floatingText: [...state.floatingText, { id: `death-${now}`, x: player.x, y: player.y, value: 'Defeated!', createdAt: now }],
  };
};

export const rewardKill = (state: GameState, enemy: EnemyState): GameState => {
  let nextState = grantXp(state, enemyStats[enemy.type].xp);
  const rng = createRng(state.seed + enemyStats[enemy.type].xp + Math.floor(enemy.x * 11) + Math.floor(enemy.y * 7));
  const dropRoll = rng.next();
  if (dropRoll > 0.4) {
    const item = generateLoot(rng);
    nextState = addItemToInventory(nextState, item);
  }
  return nextState;
};

export const grantXp = (state: GameState, amount: number): GameState => {
  let player = { ...state.player };
  let xp = player.xp + amount;
  let level = player.level;
  while (level < 5 && xp >= xpCurve[level]) {
    xp -= xpCurve[level];
    level += 1;
    player = levelUp(player);
  }
  return { ...state, player: { ...player, xp, level } };
};

export const levelUp = (player: PlayerState): PlayerState => {
  const newBase = {
    maxHp: player.baseStats.maxHp + 12,
    damage: player.baseStats.damage + 3,
    defense: player.baseStats.defense + 1,
    speed: player.baseStats.speed + 0.1,
    critChance: player.baseStats.critChance + 0.01,
  };
  const stats = getStatTotal({ ...player, baseStats: newBase });
  return {
    ...player,
    baseStats: newBase,
    hp: clamp(player.hp + stats.maxHp * 0.2, 0, stats.maxHp),
  };
};

export const generateLoot = (rng: ReturnType<typeof createRng>): Item => {
  const roll = rng.next();
  let rarity: ItemRarity = 'common';
  let cumulative = 0;
  (Object.keys(rarityChances) as ItemRarity[]).forEach((key) => {
    cumulative += rarityChances[key];
    if (roll <= cumulative && rarity === 'common') {
      rarity = key;
    }
  });
  const itemTypes: ItemType[] = ['weapon', 'armor', 'accessory', 'consumable'];
  const type = itemTypes[rng.nextInt(0, itemTypes.length - 1)];
  const nameList = itemNames[type];
  const name = nameList[rng.nextInt(0, nameList.length - 1)];
  const multiplier = rarityMultipliers[rarity];
  const affixes = {
    damage: Math.round(baseAffixes.damage * multiplier),
    hp: Math.round(baseAffixes.hp * multiplier),
    defense: Math.round(baseAffixes.defense * multiplier),
    speed: parseFloat((baseAffixes.speed * multiplier).toFixed(2)),
  };
  return {
    id: `item-${type}-${rarity}-${rng.nextInt(1000, 9999)}`,
    name,
    type,
    rarity,
    affixes,
    seed: rng.seed,
  };
};

export const addItemToInventory = (state: GameState, item: Item): GameState => {
  const inventory = [...state.player.inventory];
  if (item.type === 'consumable') {
    const slotIndex = inventory.findIndex((slot) => slot.item?.name === item.name);
    if (slotIndex >= 0) {
      inventory[slotIndex] = { item, quantity: inventory[slotIndex].quantity + 1 };
      return { ...state, player: { ...state.player, inventory } };
    }
  }
  const emptyIndex = inventory.findIndex((slot) => slot.item === null);
  if (emptyIndex === -1) return state;
  inventory[emptyIndex] = { item, quantity: 1 };
  return { ...state, player: { ...state.player, inventory } };
};

export const equipItem = (state: GameState, index: number): GameState => {
  const slot = state.player.inventory[index];
  if (!slot.item || slot.item.type === 'consumable') return state;
  const item = slot.item;
  const equipped = { ...state.player.equipped };
  const previous = equipped[item.type];
  equipped[item.type] = item;
  const inventory = [...state.player.inventory];
  inventory[index] = { item: previous ?? null, quantity: previous ? 1 : 0 };
  return recalcGear({ ...state, player: { ...state.player, equipped, inventory } });
};

export const useConsumable = (state: GameState, index: number): GameState => {
  const slot = state.player.inventory[index];
  if (!slot.item || slot.item.type !== 'consumable') return state;
  const stats = getStatTotal(state.player);
  const nextHp = clamp(state.player.hp + 30, 0, stats.maxHp);
  const inventory = [...state.player.inventory];
  const quantity = slot.quantity - 1;
  inventory[index] = { item: quantity > 0 ? slot.item : null, quantity: Math.max(0, quantity) };
  return { ...state, player: { ...state.player, inventory, hp: nextHp } };
};

export const recalcGear = (state: GameState): GameState => {
  const items = Object.values(state.player.equipped).filter(Boolean) as Item[];
  const gearStats = items.reduce(
    (acc, item) => ({
      maxHp: acc.maxHp + item.affixes.hp,
      damage: acc.damage + item.affixes.damage,
      defense: acc.defense + item.affixes.defense,
      speed: acc.speed + item.affixes.speed,
      critChance: acc.critChance + (item.rarity === 'epic' ? 0.05 : 0.02),
    }),
    { maxHp: 0, damage: 0, defense: 0, speed: 0, critChance: 0 }
  );
  return { ...state, player: { ...state.player, gearStats } };
};

export const addFloatingText = (state: GameState, x: number, y: number, value: string): GameState => {
  const now = Date.now();
  const floatingText = [...state.floatingText, { id: `ft-${now}-${Math.random()}`, x, y, value, createdAt: now }];
  return { ...state, floatingText };
};

export const pruneFloatingText = (state: GameState, now: number): GameState => {
  const floatingText = state.floatingText.filter((text) => now - text.createdAt < 800);
  return floatingText.length === state.floatingText.length ? state : { ...state, floatingText };
};

export const toggleSetting = (state: GameState, key: 'muted' | 'reducedMotion' | 'highContrast'): GameState => ({
  ...state,
  [key]: !state[key],
});

export const serializeState = (state: GameState): string => JSON.stringify(state);

export const deserializeState = (raw: string): GameState | null => {
  try {
    const data = JSON.parse(raw) as GameState;
    return data;
  } catch (error) {
    return null;
  }
};

export const getDamageLabel = (enemy: EnemyState): string => `${enemy.type} (${enemy.hp}/${enemy.maxHp})`;
