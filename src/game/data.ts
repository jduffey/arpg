import type { EnemyType, ItemAffixes, ItemRarity, ItemType, StatBlock, ZoneId } from './types';

export const TILE_SIZE = 48;

export const zoneMaps: Record<ZoneId, string[]> = {
  overworld: [
    '1111111111111',
    '1000000000001',
    '1011110111101',
    '1000010000101',
    '1011011110101',
    '1001000000101',
    '1011011111101',
    '1000000000001',
    '1111101111101',
    '1000001000001',
    '1011111011101',
    '1000000000002',
    '1111111111111',
  ],
  subarea: [
    '1111111111',
    '1000000001',
    '1011111101',
    '1010000101',
    '1010110101',
    '1000100001',
    '1011101111',
    '1000000001',
    '1000110001',
    '1111111111',
  ],
};

export const zoneEntries: Record<ZoneId, { x: number; y: number }> = {
  overworld: { x: 2, y: 2 },
  subarea: { x: 1, y: 1 },
};

export const zoneExitTiles: Record<ZoneId, { x: number; y: number; target: ZoneId }> = {
  overworld: { x: 12, y: 11, target: 'subarea' },
  subarea: { x: 1, y: 1, target: 'overworld' },
};

export const baseStats: StatBlock = {
  maxHp: 100,
  damage: 12,
  defense: 2,
  speed: 3,
  critChance: 0.05,
};

export const levelStatGrowth: StatBlock = {
  maxHp: 12,
  damage: 3,
  defense: 1,
  speed: 0.1,
  critChance: 0.01,
};

export const enemyStats: Record<EnemyType, StatBlock & { xp: number }> = {
  slime: { maxHp: 30, damage: 6, defense: 1, speed: 1.5, critChance: 0, xp: 12 },
  bat: { maxHp: 22, damage: 5, defense: 0, speed: 2.4, critChance: 0.05, xp: 10 },
  skeleton: { maxHp: 40, damage: 8, defense: 2, speed: 1.7, critChance: 0.1, xp: 16 },
  elite: { maxHp: 80, damage: 12, defense: 4, speed: 1.4, critChance: 0.15, xp: 30 },
};

export const enemySpawnTable: Record<ZoneId, EnemyType[]> = {
  overworld: ['slime', 'bat', 'skeleton'],
  subarea: ['skeleton', 'elite', 'bat'],
};

export const itemNames: Record<ItemType, string[]> = {
  weapon: ['Iron Sword', 'Oak Staff', 'Hunter Blade', 'Cinder Knife'],
  armor: ['Leather Vest', 'Chain Shirt', 'Guard Plate', 'Mist Cloak'],
  accessory: ['Silver Ring', 'Traveler Charm', 'Ember Pendant', 'Wind Locket'],
  consumable: ['Healing Tonic'],
};

export const rarityChances: Record<ItemRarity, number> = {
  common: 0.7,
  uncommon: 0.2,
  rare: 0.09,
  epic: 0.01,
};

export const rarityMultipliers: Record<ItemRarity, number> = {
  common: 0.8,
  uncommon: 1,
  rare: 1.3,
  epic: 1.7,
};

export const baseAffixes: ItemAffixes = {
  damage: 4,
  hp: 10,
  defense: 2,
  speed: 0.2,
};

export const maxInventorySlots = 20;

export const xpCurve = [0, 20, 60, 120, 200, 300];
