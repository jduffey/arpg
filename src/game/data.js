import { GAME_CONFIG } from './config';

export const ZONES = {
  [GAME_CONFIG.zones.overworld]: {
    id: GAME_CONFIG.zones.overworld,
    name: 'Overworld',
    tier: 1,
    map: [
      '11111111111111111111',
      '10000000000000000001',
      '10111101111101111001',
      '10100001000101000001',
      '10101111010101111101',
      '10001000010100000101',
      '10111011110111110101',
      '10100010000100000101',
      '10101110111101111101',
      '10000000000000000001',
      '11111111111111111111'
    ],
    exits: [
      { x: 18, y: 5, target: GAME_CONFIG.zones.subArea }
    ],
    spawns: [
      { type: 'slime', x: 4, y: 3 },
      { type: 'slime', x: 7, y: 7 },
      { type: 'archer', x: 14, y: 3 },
      { type: 'brute', x: 12, y: 8 }
    ]
  },
  [GAME_CONFIG.zones.subArea]: {
    id: GAME_CONFIG.zones.subArea,
    name: 'Ancient Gate',
    tier: 2,
    map: [
      '11111111111111111111',
      '10000000000000000001',
      '10111111111011111001',
      '10100000001000001001',
      '10101111101011101001',
      '10101000101000101001',
      '10101110101110101001',
      '10100000100000100001',
      '10111111111111111001',
      '10000000000000000001',
      '11111111111111111111'
    ],
    exits: [
      { x: 1, y: 5, target: GAME_CONFIG.zones.overworld }
    ],
    spawns: [
      { type: 'slime', x: 3, y: 3 },
      { type: 'archer', x: 10, y: 6 },
      { type: 'brute', x: 15, y: 4 },
      { type: 'elite', x: 9, y: 8 }
    ]
  }
};

export const ENEMY_TYPES = {
  slime: {
    id: 'slime',
    name: 'Slime',
    baseHp: 30,
    damage: 6,
    defense: 0,
    speed: 70,
    xp: 10,
    lootTable: ['weapon', 'armor', 'consumable']
  },
  archer: {
    id: 'archer',
    name: 'Gloom Archer',
    baseHp: 40,
    damage: 8,
    defense: 1,
    speed: 80,
    xp: 14,
    lootTable: ['weapon', 'accessory', 'consumable']
  },
  brute: {
    id: 'brute',
    name: 'Stone Brute',
    baseHp: 70,
    damage: 12,
    defense: 3,
    speed: 55,
    xp: 20,
    lootTable: ['armor', 'accessory']
  },
  elite: {
    id: 'elite',
    name: 'Gate Guardian',
    baseHp: 120,
    damage: 18,
    defense: 5,
    speed: 60,
    xp: 40,
    lootTable: ['weapon', 'armor', 'accessory']
  }
};

export const ITEM_TEMPLATES = [
  { id: 'rust-blade', type: 'Weapon', name: 'Rust Blade', baseStats: { damage: 4 } },
  { id: 'iron-saber', type: 'Weapon', name: 'Iron Saber', baseStats: { damage: 6 } },
  { id: 'hunter-bow', type: 'Weapon', name: 'Hunter Bow', baseStats: { damage: 5, speed: 0.05 } },
  { id: 'leather-vest', type: 'Armor', name: 'Leather Vest', baseStats: { hp: 15, defense: 1 } },
  { id: 'iron-plate', type: 'Armor', name: 'Iron Plate', baseStats: { hp: 30, defense: 3 } },
  { id: 'shadow-mail', type: 'Armor', name: 'Shadow Mail', baseStats: { hp: 20, defense: 2, speed: 0.04 } },
  { id: 'swift-ring', type: 'Accessory', name: 'Swift Ring', baseStats: { speed: 0.08 } },
  { id: 'ward-amulet', type: 'Accessory', name: 'Ward Amulet', baseStats: { defense: 2 } },
  { id: 'blood-charm', type: 'Accessory', name: 'Blood Charm', baseStats: { hp: 20, damage: 2 } },
  { id: 'small-potion', type: 'Consumable', name: 'Small Potion', baseStats: { heal: 25 }, stackable: true }
];
