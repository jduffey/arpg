export type ZoneId = 'overworld' | 'subarea';

export type StatBlock = {
  maxHp: number;
  damage: number;
  defense: number;
  speed: number;
  critChance: number;
};

export type PlayerState = {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  level: number;
  xp: number;
  baseStats: StatBlock;
  gearStats: StatBlock;
  zoneId: ZoneId;
  inventory: InventorySlot[];
  equipped: EquippedItems;
  lastMeleeAt: number;
  lastRangedAt: number;
  isDead: boolean;
};

export type EnemyType = 'slime' | 'bat' | 'skeleton' | 'elite';

export type EnemyState = {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  zoneId: ZoneId;
  lastAttackAt: number;
};

export type ItemType = 'weapon' | 'armor' | 'accessory' | 'consumable';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic';

export type ItemAffixes = {
  damage: number;
  hp: number;
  defense: number;
  speed: number;
};

export type Item = {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  affixes: ItemAffixes;
  seed: number;
};

export type InventorySlot = {
  item: Item | null;
  quantity: number;
};

export type EquippedItems = {
  weapon: Item | null;
  armor: Item | null;
  accessory: Item | null;
};

export type ZoneState = {
  id: ZoneId;
  enemies: EnemyState[];
  visited: boolean;
};

export type Projectile = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
};

export type GameState = {
  seed: number;
  player: PlayerState;
  zones: Record<ZoneId, ZoneState>;
  projectiles: Projectile[];
  floatingText: FloatingText[];
  muted: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  lastZoneExitAt: number;
  logs: string[];
};

export type FloatingText = {
  id: string;
  x: number;
  y: number;
  value: string;
  createdAt: number;
};
