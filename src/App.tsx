import { useEffect, useMemo, useRef, useState } from 'react';

type ZoneId = 'overworld' | 'subarea';

type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic';

type ItemType = 'Weapon' | 'Armor' | 'Accessory' | 'Consumable';

type AffixType = 'Damage' | 'HP' | 'Defense' | 'Speed';

type SaveSource = 'local' | 'folder';

interface Item {
  id: string;
  name: string;
  type: ItemType;
  rarity: Rarity;
  affixes: Record<AffixType, number>;
  levelReq: number;
  seed: number;
  stackable: boolean;
  quantity: number;
}

interface InventorySlot {
  item: Item | null;
}

interface Enemy {
  id: string;
  type: string;
  hp: number;
  maxHp: number;
  damage: number;
  defense: number;
  speed: number;
  position: Vec2;
  attackCooldown: number;
  lastAttackAt: number;
  xp: number;
  isElite: boolean;
}

interface LootDrop {
  id: string;
  item: Item;
  position: Vec2;
}

interface Projectile {
  id: string;
  position: Vec2;
  velocity: Vec2;
  damage: number;
  createdAt: number;
}

interface FloatingText {
  id: string;
  position: Vec2;
  value: string;
  createdAt: number;
  color: string;
}

interface PlayerStats {
  baseHp: number;
  baseDamage: number;
  baseDefense: number;
  baseSpeed: number;
  baseCrit: number;
}

interface PlayerState {
  position: Vec2;
  hp: number;
  maxHp: number;
  xp: number;
  level: number;
  stats: PlayerStats;
  equipment: {
    Weapon: Item | null;
    Armor: Item | null;
    Accessory: Item | null;
  };
}

interface ZoneState {
  id: ZoneId;
  enemies: Enemy[];
  drops: LootDrop[];
}

interface GameState {
  seed: number;
  zone: ZoneState;
  zonesVisited: Record<ZoneId, boolean>;
  inventory: InventorySlot[];
  player: PlayerState;
  projectiles: Projectile[];
  floatingText: FloatingText[];
  lastMeleeAt: number;
  lastRangedAt: number;
  isDead: boolean;
  muted: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}

interface SaveGame {
  id: string;
  label: string;
  savedAt: number;
  source: SaveSource;
  state: GameState;
}

interface Vec2 {
  x: number;
  y: number;
}

interface SaveManifestEntry {
  id: string;
  label: string;
  file: string;
}

const TILE_SIZE = 32;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 12;
const MAX_LEVEL = 5;
const SAVE_INDEX_KEY = 'arpg_save_index_v0';
const SAVE_PREFIX = 'arpg_save_v0_';

const RARITY_WEIGHTS: Record<Rarity, number> = {
  Common: 0.7,
  Uncommon: 0.2,
  Rare: 0.09,
  Epic: 0.01,
};

const ITEM_POOLS: Record<ItemType, string[]> = {
  Weapon: ['Bronze Blade', 'Oak Bow', 'Iron Saber', 'Hunter Axe'],
  Armor: ['Leather Vest', 'Chain Shirt', 'Guardian Cloak'],
  Accessory: ['Lucky Charm', 'Swift Band', 'Stone Talisman'],
  Consumable: ['Healing Herb', 'Stamina Tonic'],
};

const AFFIXES: AffixType[] = ['Damage', 'HP', 'Defense', 'Speed'];

const CONTROL_BINDINGS: Record<string, string[]> = {
  up: ['w', 'ArrowUp'],
  down: ['s', 'ArrowDown'],
  left: ['a', 'ArrowLeft'],
  right: ['d', 'ArrowRight'],
  melee: [' '],
  ranged: ['f'],
  inventory: ['i'],
  character: ['c'],
  mute: ['m'],
  reset: ['r'],
  save: ['p'],
  load: ['l'],
  toggleContrast: ['h'],
  toggleMotion: ['o'],
};

const ZONES: Record<ZoneId, { map: string[]; spawn: Vec2; exit: Vec2; tier: number }>= {
  overworld: {
    map: [
      '####################',
      '#.............#....#',
      '#.####.........#...#',
      '#....#.............#',
      '#....#....#####....#',
      '#....#....#...#....#',
      '#..........#..#....#',
      '#..######..#..#....#',
      '#..........#.......#',
      '#..#######.........#',
      '#..............E...#',
      '####################',
    ],
    spawn: { x: TILE_SIZE * 2, y: TILE_SIZE * 2 },
    exit: { x: TILE_SIZE * 16, y: TILE_SIZE * 10 },
    tier: 1,
  },
  subarea: {
    map: [
      '####################',
      '#......#...........#',
      '#..##..#..#####..#.#',
      '#..#......#.......##',
      '#..#..###.#..####..#',
      '#.....#...#..#.....#',
      '#..#..#...#..#..#..#',
      '#..#..#...#..#..#..#',
      '#..#..###.#..#..#..#',
      '#.................E#',
      '#..#############...#',
      '####################',
    ],
    spawn: { x: TILE_SIZE * 2, y: TILE_SIZE * 2 },
    exit: { x: TILE_SIZE * 18, y: TILE_SIZE * 9 },
    tier: 2,
  },
};

const ENEMY_TYPES = [
  { type: 'Slime', hp: 24, damage: 6, defense: 1, speed: 30, xp: 10 },
  { type: 'Bat', hp: 18, damage: 5, defense: 0, speed: 45, xp: 9 },
  { type: 'Skeleton', hp: 30, damage: 7, defense: 2, speed: 25, xp: 12 },
];

const ELITE_TYPE = { type: 'Ogre', hp: 60, damage: 12, defense: 4, speed: 20, xp: 30 };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

const normalize = (vec: Vec2): Vec2 => {
  const mag = Math.hypot(vec.x, vec.y);
  if (mag === 0) {
    return { x: 0, y: 0 };
  }
  return { x: vec.x / mag, y: vec.y / mag };
};

const withinTile = (x: number, y: number) => {
  const tileX = Math.floor(x / TILE_SIZE);
  const tileY = Math.floor(y / TILE_SIZE);
  return { tileX, tileY };
};

const isWalkable = (zoneId: ZoneId, pos: Vec2) => {
  const { tileX, tileY } = withinTile(pos.x, pos.y);
  const map = ZONES[zoneId].map;
  if (tileY < 0 || tileY >= map.length || tileX < 0 || tileX >= map[0].length) {
    return false;
  }
  return map[tileY][tileX] !== '#';
};

const createRng = (seed: number) => {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => (value = (value * 48271) % 2147483647) / 2147483647;
};

const rollRarity = (rng: () => number): Rarity => {
  const roll = rng();
  let cumulative = 0;
  for (const rarity of Object.keys(RARITY_WEIGHTS) as Rarity[]) {
    cumulative += RARITY_WEIGHTS[rarity];
    if (roll <= cumulative) {
      return rarity;
    }
  }
  return 'Common';
};

const rarityMultiplier = (rarity: Rarity) => {
  switch (rarity) {
    case 'Uncommon':
      return 1.4;
    case 'Rare':
      return 1.8;
    case 'Epic':
      return 2.4;
    default:
      return 1;
  }
};

const computeItemAffixes = (rng: () => number, rarity: Rarity, type: ItemType) => {
  const affixes: Record<AffixType, number> = {
    Damage: 0,
    HP: 0,
    Defense: 0,
    Speed: 0,
  };
  const multiplier = rarityMultiplier(rarity);
  const picks = type === 'Consumable' ? 1 : 2;
  for (let i = 0; i < picks; i += 1) {
    const affix = AFFIXES[Math.floor(rng() * AFFIXES.length)];
    const base = Math.floor(rng() * 3) + 1;
    affixes[affix] += Math.round(base * multiplier);
  }
  return affixes;
};

const createItem = (seed: number, rng: () => number, type?: ItemType): Item => {
  const itemType: ItemType = type ?? (['Weapon', 'Armor', 'Accessory', 'Consumable'][Math.floor(rng() * 4)] as ItemType);
  const rarity = rollRarity(rng);
  const namePool = ITEM_POOLS[itemType];
  const name = namePool[Math.floor(rng() * namePool.length)];
  const affixes = computeItemAffixes(rng, rarity, itemType);
  const stackable = itemType === 'Consumable';
  const levelReq = Math.max(1, Math.min(MAX_LEVEL, Math.ceil(rarityMultiplier(rarity))));
  return {
    id: `${itemType}-${seed}-${Math.floor(rng() * 10000)}`,
    name,
    type: itemType,
    rarity,
    affixes,
    levelReq,
    seed,
    stackable,
    quantity: 1,
  };
};

const applyAffixesToStats = (stats: PlayerStats, item: Item | null) => {
  if (!item) return stats;
  return {
    baseHp: stats.baseHp + item.affixes.HP,
    baseDamage: stats.baseDamage + item.affixes.Damage,
    baseDefense: stats.baseDefense + item.affixes.Defense,
    baseSpeed: stats.baseSpeed + item.affixes.Speed,
    baseCrit: stats.baseCrit,
  };
};

const recalcPlayer = (player: PlayerState) => {
  let stats = { ...player.stats };
  stats = applyAffixesToStats(stats, player.equipment.Weapon);
  stats = applyAffixesToStats(stats, player.equipment.Armor);
  stats = applyAffixesToStats(stats, player.equipment.Accessory);
  stats.baseDefense = Math.max(0, stats.baseDefense);
  stats.baseSpeed = Math.max(20, stats.baseSpeed);
  stats.baseCrit = clamp(stats.baseCrit, 0, 0.5);
  const maxHp = Math.max(1, stats.baseHp);
  return {
    stats,
    maxHp,
  };
};

const makeInitialState = (seed = Date.now() % 100000): GameState => {
  const rng = createRng(seed);
  const baseStats: PlayerStats = {
    baseHp: 100,
    baseDamage: 10,
    baseDefense: 2,
    baseSpeed: 120,
    baseCrit: 0.05,
  };

  const equipment = {
    Weapon: createItem(seed + 1, rng, 'Weapon'),
    Armor: null,
    Accessory: null,
  };

  const player: PlayerState = {
    position: { ...ZONES.overworld.spawn },
    hp: 100,
    maxHp: 100,
    xp: 0,
    level: 1,
    stats: baseStats,
    equipment,
  };

  const inventory = Array.from({ length: 20 }, () => ({ item: null }));
  inventory[0].item = createItem(seed + 2, rng, 'Consumable');

  const zone = createZoneState('overworld', seed, rng);
  return {
    seed,
    zone,
    zonesVisited: { overworld: true, subarea: false },
    inventory,
    player,
    projectiles: [],
    floatingText: [],
    lastMeleeAt: 0,
    lastRangedAt: 0,
    isDead: false,
    muted: false,
    reducedMotion: false,
    highContrast: false,
  };
};

const createZoneState = (zoneId: ZoneId, seed: number, rng: () => number): ZoneState => {
  const baseSpawns = zoneId === 'overworld' ? 4 : 6;
  const eliteCount = zoneId === 'subarea' ? 1 : 0;
  const enemies: Enemy[] = [];
  const map = ZONES[zoneId].map;

  const spawnEnemyAt = (typeIndex: number, isElite: boolean) => {
    const base = isElite ? ELITE_TYPE : ENEMY_TYPES[typeIndex % ENEMY_TYPES.length];
    let pos: Vec2 = { x: TILE_SIZE * 2, y: TILE_SIZE * 2 };
    for (let attempts = 0; attempts < 40; attempts += 1) {
      const x = Math.floor(rng() * (MAP_WIDTH - 2)) + 1;
      const y = Math.floor(rng() * (MAP_HEIGHT - 2)) + 1;
      if (map[y][x] === '.') {
        pos = { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 };
        break;
      }
    }
    const tierMultiplier = 1 + (ZONES[zoneId].tier - 1) * 0.35;
    const eliteMultiplier = isElite ? 1.6 : 1;
    enemies.push({
      id: `${zoneId}-${base.type}-${Math.floor(rng() * 10000)}`,
      type: base.type,
      hp: Math.round(base.hp * tierMultiplier * eliteMultiplier),
      maxHp: Math.round(base.hp * tierMultiplier * eliteMultiplier),
      damage: Math.round(base.damage * tierMultiplier * eliteMultiplier),
      defense: Math.round(base.defense * tierMultiplier),
      speed: base.speed,
      position: pos,
      attackCooldown: 900,
      lastAttackAt: 0,
      xp: Math.round(base.xp * tierMultiplier * eliteMultiplier),
      isElite,
    });
  };

  for (let i = 0; i < baseSpawns; i += 1) {
    spawnEnemyAt(i, false);
  }
  for (let i = 0; i < eliteCount; i += 1) {
    spawnEnemyAt(i, true);
  }

  return {
    id: zoneId,
    enemies,
    drops: [],
  };
};

const calculateDamage = (rng: () => number, baseDamage: number, defense: number, critChance: number) => {
  const critRoll = rng();
  const isCrit = critRoll <= critChance;
  const raw = Math.max(1, baseDamage - defense);
  return {
    amount: isCrit ? Math.round(raw * 1.6) : raw,
    isCrit,
  };
};

const calculateXpToNext = (level: number) => 40 + level * 25;

const serializeState = (state: GameState): GameState => JSON.parse(JSON.stringify(state));

const safeLoad = (payload: string): GameState | null => {
  try {
    const parsed = JSON.parse(payload) as GameState;
    if (!parsed.player || !parsed.zone) return null;
    return parsed;
  } catch {
    return null;
  }
};

const useAudio = () => {
  const contextRef = useRef<AudioContext | null>(null);

  const playTone = (frequency: number, duration = 0.08, volume = 0.08) => {
    const context = contextRef.current ?? new AudioContext();
    contextRef.current = context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  };

  return {
    playHit: () => playTone(220),
    playPickup: () => playTone(520),
    playDeath: () => playTone(110, 0.2, 0.1),
  };
};

const listLocalSaves = (): SaveGame[] => {
  const rawIndex = localStorage.getItem(SAVE_INDEX_KEY);
  if (!rawIndex) return [];
  try {
    const entries = JSON.parse(rawIndex) as { id: string; label: string; savedAt: number }[];
    return entries
      .map((entry) => {
        const payload = localStorage.getItem(`${SAVE_PREFIX}${entry.id}`);
        if (!payload) return null;
        const state = safeLoad(payload);
        if (!state) return null;
        return {
          id: entry.id,
          label: entry.label,
          savedAt: entry.savedAt,
          source: 'local',
          state,
        } as SaveGame;
      })
      .filter((entry): entry is SaveGame => Boolean(entry));
  } catch {
    return [];
  }
};

const listFolderSaves = async (): Promise<SaveGame[]> => {
  try {
    const response = await fetch('/saves/index.json', { cache: 'no-store' });
    if (!response.ok) return [];
    const manifest = (await response.json()) as SaveManifestEntry[];
    const results: SaveGame[] = [];
    for (const entry of manifest) {
      const saveResponse = await fetch(`/saves/${entry.file}`, { cache: 'no-store' });
      if (!saveResponse.ok) continue;
      const payload = await saveResponse.text();
      const state = safeLoad(payload);
      if (!state) continue;
      results.push({
        id: entry.id,
        label: entry.label,
        savedAt: Date.now(),
        source: 'folder',
        state,
      });
    }
    return results;
  } catch {
    return [];
  }
};

const saveToLocalStorage = (state: GameState, label = 'Auto Save') => {
  const id = `${Date.now()}`;
  const snapshot = serializeState(state);
  localStorage.setItem(`${SAVE_PREFIX}${id}`, JSON.stringify(snapshot));
  const rawIndex = localStorage.getItem(SAVE_INDEX_KEY);
  const index = rawIndex ? (JSON.parse(rawIndex) as { id: string; label: string; savedAt: number }[]) : [];
  index.unshift({ id, label, savedAt: Date.now() });
  localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index.slice(0, 8)));
  return id;
};

const exportSaveFile = (state: GameState) => {
  const blob = new Blob([JSON.stringify(serializeState(state), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `save-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const applyItemToInventory = (inventory: InventorySlot[], item: Item): boolean => {
  if (item.stackable) {
    const existingSlot = inventory.find((slot) => slot.item?.id === item.id);
    if (existingSlot?.item) {
      existingSlot.item.quantity += 1;
      return true;
    }
  }

  const emptySlot = inventory.find((slot) => !slot.item);
  if (!emptySlot) return false;
  emptySlot.item = item;
  return true;
};

const consumeItem = (player: PlayerState, item: Item) => {
  if (item.name === 'Healing Herb') {
    player.hp = clamp(player.hp + 25, 0, player.maxHp);
  }
  if (item.name === 'Stamina Tonic') {
    player.hp = clamp(player.hp + 10, 0, player.maxHp);
  }
};

const toHudStat = (value: number) => Math.round(value * 10) / 10;

export default function App() {
  const [uiTick, setUiTick] = useState(0);
  const [showInventory, setShowInventory] = useState(false);
  const [showCharacter, setShowCharacter] = useState(false);
  const [availableSaves, setAvailableSaves] = useState<SaveGame[]>([]);
  const [selectedSaveId, setSelectedSaveId] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(makeInitialState());
  const pressedRef = useRef<Set<string>>(new Set());
  const rngRef = useRef<() => number>(createRng(stateRef.current.seed));
  const lastFrameRef = useRef<number>(0);
  const audio = useAudio();

  const derivedStats = useMemo(() => recalcPlayer(stateRef.current.player), [uiTick]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      pressedRef.current.add(event.key);
      if (CONTROL_BINDINGS.inventory.includes(event.key)) {
        setShowInventory((prev) => !prev);
      }
      if (CONTROL_BINDINGS.character.includes(event.key)) {
        setShowCharacter((prev) => !prev);
      }
      if (CONTROL_BINDINGS.mute.includes(event.key)) {
        stateRef.current.muted = !stateRef.current.muted;
        setUiTick((tick) => tick + 1);
      }
      if (CONTROL_BINDINGS.toggleMotion.includes(event.key)) {
        stateRef.current.reducedMotion = !stateRef.current.reducedMotion;
        setUiTick((tick) => tick + 1);
      }
      if (CONTROL_BINDINGS.toggleContrast.includes(event.key)) {
        stateRef.current.highContrast = !stateRef.current.highContrast;
        setUiTick((tick) => tick + 1);
      }
      if (CONTROL_BINDINGS.reset.includes(event.key)) {
        resetGame();
      }
      if (CONTROL_BINDINGS.save.includes(event.key)) {
        handleSave('Manual Save');
      }
      if (CONTROL_BINDINGS.load.includes(event.key)) {
        handleLoad();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      pressedRef.current.delete(event.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    let frameId = 0;
    const loop = (timestamp: number) => {
      const delta = Math.min(0.05, (timestamp - lastFrameRef.current) / 1000 || 0);
      lastFrameRef.current = timestamp;
      updateGame(delta, timestamp);
      drawGame();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const loadSaves = async () => {
      const localSaves = listLocalSaves();
      const folderSaves = await listFolderSaves();
      const combined = [...localSaves, ...folderSaves];
      setAvailableSaves(combined);
      if (combined.length > 0) {
        setSelectedSaveId(combined[0].id);
      }
    };
    loadSaves();
  }, [uiTick]);

  const updateGame = (delta: number, now: number) => {
    const state = stateRef.current;
    if (state.isDead) return;

    const movement = { x: 0, y: 0 };
    for (const key of CONTROL_BINDINGS.up) {
      if (pressedRef.current.has(key)) movement.y -= 1;
    }
    for (const key of CONTROL_BINDINGS.down) {
      if (pressedRef.current.has(key)) movement.y += 1;
    }
    for (const key of CONTROL_BINDINGS.left) {
      if (pressedRef.current.has(key)) movement.x -= 1;
    }
    for (const key of CONTROL_BINDINGS.right) {
      if (pressedRef.current.has(key)) movement.x += 1;
    }

    const direction = normalize(movement);
    const speedMultiplier = 1 + derivedStats.stats.baseSpeed / 400;
    const moveStep = derivedStats.stats.baseSpeed * speedMultiplier * delta;

    const nextPos = {
      x: state.player.position.x + direction.x * moveStep,
      y: state.player.position.y + direction.y * moveStep,
    };

    if (isWalkable(state.zone.id, { x: nextPos.x, y: state.player.position.y })) {
      state.player.position.x = nextPos.x;
    }
    if (isWalkable(state.zone.id, { x: state.player.position.x, y: nextPos.y })) {
      state.player.position.y = nextPos.y;
    }

    handleAttacks(now);
    updateEnemies(delta, now);
    updateProjectiles(delta, now);
    updateFloatingText(now);
    handleLootPickup();
    handleZoneExit();
  };

  const handleAttacks = (now: number) => {
    const state = stateRef.current;
    const rng = rngRef.current;
    const meleePressed = CONTROL_BINDINGS.melee.some((key) => pressedRef.current.has(key));
    if (meleePressed && now - state.lastMeleeAt >= 450) {
      state.lastMeleeAt = now;
      const attackRange = 36;
      state.zone.enemies.forEach((enemy) => {
        if (enemy.hp <= 0) return;
        if (distance(enemy.position, state.player.position) <= attackRange) {
          const result = calculateDamage(rng, derivedStats.stats.baseDamage, enemy.defense, derivedStats.stats.baseCrit);
          enemy.hp = Math.max(0, enemy.hp - result.amount);
          state.floatingText.push({
            id: `hit-${now}-${enemy.id}`,
            position: { ...enemy.position },
            value: result.isCrit ? `CRIT ${result.amount}` : `-${result.amount}`,
            createdAt: now,
            color: result.isCrit ? '#f6c453' : '#f4f4f4',
          });
          if (!state.muted) audio.playHit();
          if (enemy.hp <= 0) {
            handleEnemyDeath(enemy, now);
          }
        }
      });
      setUiTick((tick) => tick + 1);
    }

    const rangedPressed = CONTROL_BINDINGS.ranged.some((key) => pressedRef.current.has(key));
    if (rangedPressed && now - state.lastRangedAt >= 900) {
      state.lastRangedAt = now;
      const direction = normalize({ x: 1, y: 0 });
      state.projectiles.push({
        id: `proj-${now}`,
        position: { ...state.player.position },
        velocity: { x: direction.x * 220, y: direction.y * 220 },
        damage: Math.max(3, Math.round(derivedStats.stats.baseDamage * 0.7)),
        createdAt: now,
      });
      setUiTick((tick) => tick + 1);
    }
  };

  const updateEnemies = (delta: number, now: number) => {
    const state = stateRef.current;
    state.zone.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      const dist = distance(enemy.position, state.player.position);
      if (dist < 200) {
        const direction = normalize({
          x: state.player.position.x - enemy.position.x,
          y: state.player.position.y - enemy.position.y,
        });
        const moveStep = enemy.speed * delta;
        const nextPos = {
          x: enemy.position.x + direction.x * moveStep,
          y: enemy.position.y + direction.y * moveStep,
        };
        if (isWalkable(state.zone.id, nextPos)) {
          enemy.position = nextPos;
        }

        if (dist <= 28 && now - enemy.lastAttackAt >= enemy.attackCooldown) {
          enemy.lastAttackAt = now;
          const result = calculateDamage(rngRef.current, enemy.damage, derivedStats.stats.baseDefense, 0);
          state.player.hp = Math.max(0, state.player.hp - result.amount);
          state.floatingText.push({
            id: `player-hit-${now}-${enemy.id}`,
            position: { x: state.player.position.x, y: state.player.position.y - 10 },
            value: `-${result.amount}`,
            createdAt: now,
            color: '#ff9a9a',
          });
          if (!state.muted) audio.playHit();
          if (state.player.hp <= 0) {
            handlePlayerDeath(now);
          }
        }
      }
    });
  };

  const updateProjectiles = (delta: number, now: number) => {
    const state = stateRef.current;
    state.projectiles = state.projectiles.filter((projectile) => {
      projectile.position.x += projectile.velocity.x * delta;
      projectile.position.y += projectile.velocity.y * delta;
      if (!isWalkable(state.zone.id, projectile.position)) {
        return false;
      }
      state.zone.enemies.forEach((enemy) => {
        if (enemy.hp <= 0) return;
        if (distance(projectile.position, enemy.position) <= 18) {
          enemy.hp = Math.max(0, enemy.hp - projectile.damage);
          state.floatingText.push({
            id: `proj-hit-${now}-${enemy.id}`,
            position: { ...enemy.position },
            value: `-${projectile.damage}`,
            createdAt: now,
            color: '#b5f4ff',
          });
          if (enemy.hp <= 0) {
            handleEnemyDeath(enemy, now);
          }
          projectile.velocity = { x: 0, y: 0 };
        }
      });
      return now - projectile.createdAt < 2000 && (projectile.velocity.x !== 0 || projectile.velocity.y !== 0);
    });
  };

  const updateFloatingText = (now: number) => {
    const state = stateRef.current;
    state.floatingText = state.floatingText.filter((text) => now - text.createdAt < 800);
  };

  const handleEnemyDeath = (enemy: Enemy, now: number) => {
    const state = stateRef.current;
    const rng = rngRef.current;
    state.player.xp += enemy.xp;
    state.zone.drops.push({
      id: `loot-${enemy.id}`,
      item: createItem(state.seed + Math.floor(rng() * 1000), rng),
      position: { ...enemy.position },
    });
    state.zone.enemies = state.zone.enemies.filter((target) => target.id !== enemy.id);
    if (!state.muted) audio.playPickup();
    handleLevelUp(now);
    setUiTick((tick) => tick + 1);
  };

  const handleLevelUp = (now: number) => {
    const state = stateRef.current;
    while (state.player.level < MAX_LEVEL && state.player.xp >= calculateXpToNext(state.player.level)) {
      state.player.xp -= calculateXpToNext(state.player.level);
      state.player.level += 1;
      state.player.stats.baseHp += 15;
      state.player.stats.baseDamage += 3;
      state.player.stats.baseDefense += 1;
      state.player.stats.baseSpeed += 6;
      const recalculated = recalcPlayer(state.player);
      state.player.maxHp = recalculated.maxHp;
      state.player.hp = clamp(state.player.hp + state.player.maxHp * 0.2, 0, state.player.maxHp);
      state.floatingText.push({
        id: `level-${now}-${state.player.level}`,
        position: { ...state.player.position },
        value: `Level ${state.player.level}!`,
        createdAt: now,
        color: '#90f0a2',
      });
    }
  };

  const handlePlayerDeath = (now: number) => {
    const state = stateRef.current;
    state.isDead = true;
    if (!state.muted) audio.playDeath();
    const xpToNext = calculateXpToNext(state.player.level);
    const penalty = Math.min(state.player.xp, Math.round(xpToNext * 0.1));
    state.player.xp = Math.max(0, state.player.xp - penalty);
    setStatusMessage('You fell! Respawning...');
    setTimeout(() => {
      respawnPlayer(now + 1);
    }, 600);
  };

  const respawnPlayer = (now: number) => {
    const state = stateRef.current;
    state.player.position = { ...ZONES[state.zone.id].spawn };
    state.player.hp = Math.round(state.player.maxHp * 0.5);
    state.isDead = false;
    state.floatingText.push({
      id: `respawn-${now}`,
      position: { ...state.player.position },
      value: 'Respawned',
      createdAt: now,
      color: '#9ad6ff',
    });
    setStatusMessage('');
    setUiTick((tick) => tick + 1);
  };

  const handleLootPickup = () => {
    const state = stateRef.current;
    state.zone.drops = state.zone.drops.filter((drop) => {
      if (distance(drop.position, state.player.position) <= 24) {
        const added = applyItemToInventory(state.inventory, drop.item);
        if (added) {
          if (!state.muted) audio.playPickup();
          setStatusMessage(`Picked up ${drop.item.name}`);
          setUiTick((tick) => tick + 1);
          return false;
        }
      }
      return true;
    });
  };

  const handleZoneExit = () => {
    const state = stateRef.current;
    const exitPos = ZONES[state.zone.id].exit;
    if (distance(state.player.position, exitPos) <= 18) {
      const nextZone = state.zone.id === 'overworld' ? 'subarea' : 'overworld';
      const rng = rngRef.current;
      state.zone = createZoneState(nextZone, state.seed, rng);
      state.player.position = { ...ZONES[nextZone].spawn };
      state.zonesVisited[nextZone] = true;
      handleSave('Zone Exit Auto Save');
      setStatusMessage(`Entered ${nextZone === 'overworld' ? 'Overworld' : 'Sub-area'}`);
      setUiTick((tick) => tick + 1);
    }
  };

  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const state = stateRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const map = ZONES[state.zone.id].map;

    for (let y = 0; y < map.length; y += 1) {
      for (let x = 0; x < map[0].length; x += 1) {
        const tile = map[y][x];
        ctx.fillStyle = tile === '#' ? (state.highContrast ? '#12263a' : '#1b2a38') : state.highContrast ? '#d0f4ff' : '#2c3e50';
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    ctx.fillStyle = state.highContrast ? '#f0ff6b' : '#4dd1ff';
    ctx.beginPath();
    ctx.arc(state.player.position.x, state.player.position.y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = state.highContrast ? '#fff' : '#ffd166';
    ctx.beginPath();
    ctx.arc(ZONES[state.zone.id].exit.x + TILE_SIZE / 2, ZONES[state.zone.id].exit.y + TILE_SIZE / 2, 6, 0, Math.PI * 2);
    ctx.fill();

    state.zone.enemies.forEach((enemy) => {
      ctx.fillStyle = enemy.isElite ? '#d62828' : '#ef476f';
      ctx.beginPath();
      ctx.arc(enemy.position.x, enemy.position.y, enemy.isElite ? 12 : 9, 0, Math.PI * 2);
      ctx.fill();
    });

    state.zone.drops.forEach((drop) => {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(drop.position.x - 5, drop.position.y - 5, 10, 10);
    });

    ctx.fillStyle = '#9bf6ff';
    state.projectiles.forEach((projectile) => {
      ctx.beginPath();
      ctx.arc(projectile.position.x, projectile.position.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    if (!state.reducedMotion) {
      state.floatingText.forEach((text) => {
        const age = (performance.now() - text.createdAt) / 800;
        const offset = age * 16;
        ctx.fillStyle = text.color;
        ctx.font = '12px sans-serif';
        ctx.fillText(text.value, text.position.x - 12, text.position.y - offset);
      });
    }
  };

  const handleEquip = (slotIndex: number) => {
    const state = stateRef.current;
    const slot = state.inventory[slotIndex];
    if (!slot.item) return;
    if (slot.item.type === 'Consumable') {
      consumeItem(state.player, slot.item);
      slot.item.quantity -= 1;
      if (slot.item.quantity <= 0) {
        slot.item = null;
      }
      setUiTick((tick) => tick + 1);
      return;
    }
    if (slot.item.levelReq > state.player.level) {
      setStatusMessage('Level too low to equip.');
      return;
    }

    const currentEquip = state.player.equipment[slot.item.type];
    state.player.equipment[slot.item.type] = slot.item;
    slot.item = currentEquip;
    const recalculated = recalcPlayer(state.player);
    state.player.maxHp = recalculated.maxHp;
    state.player.hp = clamp(state.player.hp, 0, state.player.maxHp);
    setUiTick((tick) => tick + 1);
  };

  const resetGame = () => {
    stateRef.current = makeInitialState();
    rngRef.current = createRng(stateRef.current.seed);
    setUiTick((tick) => tick + 1);
    setStatusMessage('New run started.');
  };

  const handleSave = (label = 'Manual Save') => {
    const id = saveToLocalStorage(stateRef.current, label);
    setStatusMessage(`Saved game (${id}).`);
    setUiTick((tick) => tick + 1);
  };

  const handleExport = () => {
    exportSaveFile(stateRef.current);
    setStatusMessage('Exported save JSON.');
  };

  const handleLoad = () => {
    const chosen = availableSaves.find((save) => save.id === selectedSaveId);
    if (!chosen) {
      setStatusMessage('No save selected.');
      return;
    }
    stateRef.current = serializeState(chosen.state);
    rngRef.current = createRng(stateRef.current.seed);
    setStatusMessage(`Loaded ${chosen.label}.`);
    setUiTick((tick) => tick + 1);
  };

  const handleToggle = (type: 'mute' | 'contrast' | 'motion') => {
    const state = stateRef.current;
    if (type === 'mute') state.muted = !state.muted;
    if (type === 'contrast') state.highContrast = !state.highContrast;
    if (type === 'motion') state.reducedMotion = !state.reducedMotion;
    setUiTick((tick) => tick + 1);
  };

  const state = stateRef.current;
  const xpToNext = calculateXpToNext(state.player.level);

  return (
    <div className={`app ${state.highContrast ? 'high-contrast' : ''}`}>
      <header className="header">
        <div>
          <h1>ARPG v0</h1>
          <p>Overworld + Sub-area | Loot, Level, Repeat</p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={() => handleSave('Manual Save')}>Save</button>
          <button type="button" onClick={handleLoad}>Load</button>
          <button type="button" onClick={handleExport}>Export JSON</button>
          <button type="button" onClick={resetGame}>Reset</button>
        </div>
      </header>

      <main className="main">
        <section className="game-panel">
          <canvas ref={canvasRef} width={MAP_WIDTH * TILE_SIZE} height={MAP_HEIGHT * TILE_SIZE} />
          {state.isDead && (
            <div className="overlay">
              <p>Defeated...</p>
            </div>
          )}
        </section>
        <aside className="hud">
          <div className="hud-section">
            <div className="bar">
              <span>HP</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(state.player.hp / state.player.maxHp) * 100}%` }} />
              </div>
              <span>{Math.round(state.player.hp)} / {Math.round(state.player.maxHp)}</span>
            </div>
            <div className="bar">
              <span>XP</span>
              <div className="bar-track">
                <div className="bar-fill xp" style={{ width: `${(state.player.xp / xpToNext) * 100}%` }} />
              </div>
              <span>{state.player.xp} / {xpToNext}</span>
            </div>
          </div>

          <div className="hud-section">
            <p><strong>Zone:</strong> {state.zone.id === 'overworld' ? 'Overworld' : 'Sub-area'}</p>
            <p><strong>Level:</strong> {state.player.level}</p>
            <p><strong>Weapon:</strong> {state.player.equipment.Weapon?.name ?? 'None'}</p>
          </div>

          <div className="hud-section">
            <h3>Character Stats</h3>
            <ul>
              <li>Damage: {toHudStat(derivedStats.stats.baseDamage)}</li>
              <li>Defense: {toHudStat(derivedStats.stats.baseDefense)}</li>
              <li>Speed: {toHudStat(derivedStats.stats.baseSpeed)}</li>
              <li>Crit Chance: {Math.round(derivedStats.stats.baseCrit * 100)}%</li>
            </ul>
          </div>

          <div className="hud-section">
            <h3>Save Slots</h3>
            <select value={selectedSaveId} onChange={(event) => setSelectedSaveId(event.target.value)}>
              {availableSaves.length === 0 && <option value="">No saves found</option>}
              {availableSaves.map((save) => (
                <option key={`${save.source}-${save.id}`} value={save.id}>
                  [{save.source === 'local' ? 'Local' : 'Folder'}] {save.label}
                </option>
              ))}
            </select>
            <p className="hint">Folder saves are loaded from /saves/index.json.</p>
          </div>

          <div className="hud-section">
            <h3>Settings</h3>
            <div className="settings-row">
              <button type="button" onClick={() => handleToggle('mute')}>{state.muted ? 'Unmute' : 'Mute'} (M)</button>
              <button type="button" onClick={() => handleToggle('motion')}>{state.reducedMotion ? 'Enable Motion' : 'Reduce Motion'} (O)</button>
              <button type="button" onClick={() => handleToggle('contrast')}>{state.highContrast ? 'Default Colors' : 'High Contrast'} (H)</button>
            </div>
          </div>

          <div className="hud-section">
            <h3>Controls</h3>
            <ul className="controls">
              <li>Move: WASD / Arrows</li>
              <li>Melee: Space</li>
              <li>Ranged: F</li>
              <li>Inventory: I</li>
              <li>Character: C</li>
              <li>Save: P</li>
              <li>Load: L</li>
              <li>Reset: R</li>
            </ul>
          </div>
        </aside>
      </main>

      <section className="panels">
        {showInventory && (
          <div className="panel">
            <h2>Inventory</h2>
            <div className="inventory-grid">
              {state.inventory.map((slot, index) => (
                <button
                  key={`slot-${index}`}
                  type="button"
                  className="inventory-slot"
                  onClick={() => handleEquip(index)}
                >
                  {slot.item ? (
                    <div>
                      <strong>{slot.item.name}</strong>
                      <p>{slot.item.type} · {slot.item.rarity}</p>
                      <p>Lvl {slot.item.levelReq}</p>
                      <p className="affix">+{slot.item.affixes.Damage} DMG, +{slot.item.affixes.HP} HP</p>
                      <p className="affix">+{slot.item.affixes.Defense} DEF, +{slot.item.affixes.Speed} SPD</p>
                      {slot.item.stackable && <p>Qty: {slot.item.quantity}</p>}
                    </div>
                  ) : (
                    <span>Empty</span>
                  )}
                </button>
              ))}
            </div>
            <p className="hint">Click an item to equip/use. Consumables restore HP.</p>
          </div>
        )}

        {showCharacter && (
          <div className="panel">
            <h2>Character Sheet</h2>
            <div className="character-grid">
              <div>
                <h3>Equipment</h3>
                <ul>
                  <li>Weapon: {state.player.equipment.Weapon?.name ?? 'None'}</li>
                  <li>Armor: {state.player.equipment.Armor?.name ?? 'None'}</li>
                  <li>Accessory: {state.player.equipment.Accessory?.name ?? 'None'}</li>
                </ul>
              </div>
              <div>
                <h3>Stats</h3>
                <ul>
                  <li>HP: {Math.round(state.player.hp)} / {Math.round(state.player.maxHp)}</li>
                  <li>Damage: {toHudStat(derivedStats.stats.baseDamage)}</li>
                  <li>Defense: {toHudStat(derivedStats.stats.baseDefense)}</li>
                  <li>Speed: {toHudStat(derivedStats.stats.baseSpeed)}</li>
                  <li>Crit: {Math.round(derivedStats.stats.baseCrit * 100)}%</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </section>

      {statusMessage && <div className="toast">{statusMessage}</div>}
    </div>
  );
}
