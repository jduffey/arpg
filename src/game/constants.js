export const TILE_SIZE = 32;
export const GRID_WIDTH = 18;
export const GRID_HEIGHT = 12;

export const KEY_BINDINGS_DEFAULT = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  melee: 'KeyJ',
  ranged: 'KeyK',
  inventory: 'KeyI',
  character: 'KeyC',
  settings: 'KeyO',
  save: 'KeyP',
  load: 'KeyL',
};

export const BASE_PLAYER_STATS = {
  maxHp: 120,
  damage: 12,
  defense: 4,
  speed: 120,
  critChance: 0.05,
};

export const LEVEL_CAP = 5;
export const XP_TABLE = [0, 60, 150, 280, 460, 700];

export const ZONES = {
  overworld: {
    id: 'overworld',
    name: 'Sunset Overworld',
    tier: 1,
    entry: { x: 2, y: 2 },
    tiles: [
      '##################',
      '#......#.........#',
      '#......#.........#',
      '#......#.....E...#',
      '#......#####.....#',
      '#............#####',
      '#..####...........',
      '#..#..#...........',
      '#..#..#.....######',
      '#..#..#.....#....#',
      '#..#..#.....#....#',
      '##################',
    ],
    exits: {
      E: 'shrine',
    },
    enemies: [
      { type: 'slime', x: 6, y: 3 },
      { type: 'slime', x: 12, y: 6 },
      { type: 'wolf', x: 10, y: 8 },
      { type: 'archer', x: 4, y: 9 },
    ],
  },
  shrine: {
    id: 'shrine',
    name: 'Echo Shrine',
    tier: 2,
    entry: { x: 2, y: 2 },
    tiles: [
      '##################',
      '#......#.........#',
      '#.####.#.#####...#',
      '#.#..#.#.....#...#',
      '#.#..#.#####.#...#',
      '#.#..#.....#.#...#',
      '#.####.###.#.#...#',
      '#......#.#.#.#...#',
      '#.######.#.#.#...#',
      '#........#...#...#',
      '#....E.........B.#',
      '##################',
    ],
    exits: {
      E: 'overworld',
    },
    enemies: [
      { type: 'slime', x: 7, y: 5 },
      { type: 'wolf', x: 11, y: 4 },
      { type: 'archer', x: 10, y: 7 },
      { type: 'elite', x: 14, y: 9 },
      { type: 'boss', x: 15, y: 10 },
    ],
  },
};

export const ENEMIES = {
  slime: {
    name: 'Slime',
    baseHp: 30,
    baseDamage: 6,
    speed: 70,
    attackInterval: 1.6,
    range: 28,
    xp: 16,
  },
  wolf: {
    name: 'Wolf',
    baseHp: 45,
    baseDamage: 8,
    speed: 90,
    attackInterval: 1.2,
    range: 26,
    xp: 22,
  },
  archer: {
    name: 'Ranger',
    baseHp: 35,
    baseDamage: 7,
    speed: 60,
    attackInterval: 1.8,
    range: 120,
    xp: 24,
    ranged: true,
  },
  elite: {
    name: 'Shrine Guardian',
    baseHp: 120,
    baseDamage: 14,
    speed: 80,
    attackInterval: 1.4,
    range: 32,
    xp: 60,
    elite: true,
  },
  boss: {
    name: 'Echo Warden',
    baseHp: 180,
    baseDamage: 18,
    speed: 70,
    attackInterval: 1.1,
    range: 36,
    xp: 120,
    elite: true,
  },
};

export const ITEM_TYPES = ['Weapon', 'Armor', 'Accessory', 'Consumable'];

export const ITEM_BASES = {
  Weapon: [
    { id: 'rusty-blade', name: 'Rusty Blade', damage: 4 },
    { id: 'oak-wand', name: 'Oak Wand', damage: 3, speed: 0.03 },
    { id: 'iron-axe', name: 'Iron Axe', damage: 7, speed: -0.02 },
  ],
  Armor: [
    { id: 'leather-vest', name: 'Leather Vest', defense: 3 },
    { id: 'scale-mail', name: 'Scale Mail', defense: 5, maxHp: 15 },
    { id: 'shadow-cloak', name: 'Shadow Cloak', speed: 0.04, defense: 2 },
  ],
  Accessory: [
    { id: 'amber-charm', name: 'Amber Charm', maxHp: 12 },
    { id: 'crystal-band', name: 'Crystal Band', critChance: 0.04 },
    { id: 'fleet-signet', name: 'Fleet Signet', speed: 0.05 },
  ],
  Consumable: [
    { id: 'small-potion', name: 'Small Potion', heal: 40 },
    { id: 'swift-draught', name: 'Swift Draught', speed: 0.08, duration: 6 },
  ],
};

export const RARITY_TABLE = [
  { id: 'Common', weight: 70, color: '#b8c0c8', power: 1 },
  { id: 'Uncommon', weight: 20, color: '#4ccf7b', power: 1.2 },
  { id: 'Rare', weight: 9, color: '#4da6ff', power: 1.5 },
  { id: 'Epic', weight: 1, color: '#c861ff', power: 2 },
];

export const AFFIXES = [
  { id: 'damage', label: '+Damage', scale: 3 },
  { id: 'maxHp', label: '+HP', scale: 18 },
  { id: 'defense', label: '+Defense', scale: 2 },
  { id: 'speed', label: '+Speed', scale: 0.03 },
];

export const INVENTORY_SIZE = 20;

export const UI_THEMES = {
  standard: {
    name: 'Standard',
    background: '#0d1117',
    panel: '#111827',
    text: '#e2e8f0',
    accent: '#38bdf8',
  },
  highContrast: {
    name: 'High Contrast',
    background: '#000000',
    panel: '#111111',
    text: '#ffffff',
    accent: '#facc15',
  },
};
