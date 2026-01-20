import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AFFIXES,
  BASE_PLAYER_STATS,
  ENEMIES,
  INVENTORY_SIZE,
  ITEM_BASES,
  KEY_BINDINGS_DEFAULT,
  LEVEL_CAP,
  RARITY_TABLE,
  TILE_SIZE,
  UI_THEMES,
  XP_TABLE,
  ZONES,
} from './game/constants.js';
import { clamp, distance, formatPercent, normalize, safeParseJson, uuid } from './game/utils.js';
import { createRng, hashSeed } from './game/seed.js';

const STORAGE_KEY = 'arpg-save-latest';
const SETTINGS_KEY = 'arpg-settings';

const createItem = (rng, type, baseOverride) => {
  const base = baseOverride || ITEM_BASES[type][Math.floor(rng() * ITEM_BASES[type].length)];
  const rarityRoll = rng() * 100;
  let cumulative = 0;
  const rarity = RARITY_TABLE.find((entry) => {
    cumulative += entry.weight;
    return rarityRoll <= cumulative;
  }) || RARITY_TABLE[0];
  const affixCount = type === 'Consumable' ? 0 : Math.max(1, Math.floor(rng() * 2) + 1);
  const affixes = [];
  const availableAffixes = [...AFFIXES];
  for (let i = 0; i < affixCount && availableAffixes.length; i += 1) {
    const idx = Math.floor(rng() * availableAffixes.length);
    const affix = availableAffixes.splice(idx, 1)[0];
    affixes.push({
      id: affix.id,
      label: affix.label,
      value: Math.round(affix.scale * rarity.power * (0.8 + rng() * 0.4) * 100) / 100,
    });
  }
  return {
    uid: uuid(),
    type,
    baseId: base.id,
    name: base.name,
    rarity: rarity.id,
    color: rarity.color,
    stats: {
      damage: base.damage || 0,
      maxHp: base.maxHp || 0,
      defense: base.defense || 0,
      speed: base.speed || 0,
      critChance: base.critChance || 0,
      heal: base.heal || 0,
      duration: base.duration || 0,
    },
    affixes,
    stack: type === 'Consumable' ? 1 : 0,
  };
};

const calculateStats = (player) => {
  const gear = Object.values(player.equipment)
    .filter(Boolean)
    .flatMap((item) => [item, ...item.affixes.map((affix) => ({ stats: { [affix.id]: affix.value } }))]);
  const combined = gear.reduce(
    (acc, entry) => {
      const stats = entry.stats || {};
      return {
        maxHp: acc.maxHp + (stats.maxHp || 0),
        damage: acc.damage + (stats.damage || 0),
        defense: acc.defense + (stats.defense || 0),
        speedBonus: acc.speedBonus + (stats.speed || 0),
        critChance: acc.critChance + (stats.critChance || 0),
      };
    },
    { maxHp: BASE_PLAYER_STATS.maxHp, damage: BASE_PLAYER_STATS.damage, defense: BASE_PLAYER_STATS.defense, speedBonus: 0, critChance: BASE_PLAYER_STATS.critChance },
  );
  const speed = BASE_PLAYER_STATS.speed * (1 + combined.speedBonus);
  return {
    maxHp: combined.maxHp,
    damage: combined.damage,
    defense: combined.defense,
    speed,
    speedBonus: combined.speedBonus,
    critChance: clamp(combined.critChance, 0, 0.5),
  };
};

const getItemStatTotals = (item) => {
  if (!item) return {};
  return item.affixes.reduce(
    (acc, affix) => ({
      ...acc,
      [affix.id]: (acc[affix.id] || 0) + affix.value,
    }),
    { ...item.stats },
  );
};

const createEnemyState = (rng, enemy, zoneTier, position) => {
  const tierMultiplier = 1 + zoneTier * 0.2;
  return {
    id: uuid(),
    type: enemy,
    name: ENEMIES[enemy].name,
    x: position.x,
    y: position.y,
    hp: Math.round(ENEMIES[enemy].baseHp * tierMultiplier),
    maxHp: Math.round(ENEMIES[enemy].baseHp * tierMultiplier),
    damage: Math.round(ENEMIES[enemy].baseDamage * tierMultiplier),
    speed: ENEMIES[enemy].speed * tierMultiplier,
    attackInterval: ENEMIES[enemy].attackInterval,
    range: ENEMIES[enemy].range,
    xp: Math.round(ENEMIES[enemy].xp * tierMultiplier),
    ranged: Boolean(ENEMIES[enemy].ranged),
    elite: Boolean(ENEMIES[enemy].elite),
    cooldown: 0,
    alive: true,
  };
};

const buildZoneState = (zone, seed) => {
  const rng = createRng(seed);
  return {
    id: zone.id,
    name: zone.name,
    tier: zone.tier,
    enemies: zone.enemies.map((spawn) => createEnemyState(rng, spawn.type, zone.tier, spawn)),
  };
};

const getTile = (zone, x, y) => {
  if (y < 0 || y >= zone.tiles.length) return '#';
  const row = zone.tiles[y];
  if (x < 0 || x >= row.length) return '#';
  return row[x];
};

const isWalkable = (zone, x, y) => {
  const tile = getTile(zone, x, y);
  return tile !== '#';
};

const createNewGame = (seedString = `seed-${Date.now()}`) => {
  const seed = hashSeed(seedString);
  const rng = createRng(seed);
  const starterWeapon = createItem(rng, 'Weapon', ITEM_BASES.Weapon[0]);
  const starterArmor = createItem(rng, 'Armor', ITEM_BASES.Armor[0]);
  const inventory = Array.from({ length: INVENTORY_SIZE }, () => null);
  inventory[0] = createItem(rng, 'Consumable', ITEM_BASES.Consumable[0]);
  return {
    version: 1,
    seed,
    seedString,
    time: 0,
    zoneId: 'overworld',
    player: {
      x: ZONES.overworld.entry.x + 0.5,
      y: ZONES.overworld.entry.y + 0.5,
      hp: BASE_PLAYER_STATS.maxHp,
      level: 1,
      xp: 0,
      xpToNext: XP_TABLE[1],
      inventory,
      equipment: {
        weapon: starterWeapon,
        armor: starterArmor,
        accessory: null,
      },
      buffs: [],
      isDead: false,
    },
    zones: {
      overworld: buildZoneState(ZONES.overworld, seed),
      shrine: buildZoneState(ZONES.shrine, seed + 1337),
    },
    lootOnGround: {},
    projectiles: [],
    floatingText: [],
    lastSave: null,
  };
};

const computeDamage = (rng, attackerDamage, targetDefense, critChance) => {
  const crit = rng() < critChance;
  const base = Math.max(1, Math.round(attackerDamage - targetDefense));
  return { damage: crit ? Math.round(base * 1.75) : base, crit };
};

const addFloatingText = (state, text, x, y, color = '#fef08a') => {
  state.floatingText.push({ id: uuid(), text, x, y, color, ttl: 1 });
};

const saveToLocalStorage = (state) => {
  const payload = {
    version: state.version,
    seed: state.seed,
    seedString: state.seedString,
    time: state.time,
    zoneId: state.zoneId,
    player: state.player,
    zones: state.zones,
    lootOnGround: state.lootOnGround,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return payload;
};

const validateSave = (payload) =>
  payload && payload.player && payload.zones && payload.zoneId && payload.seed !== undefined;

const loadFromStorage = () => {
  const saved = safeParseJson(localStorage.getItem(STORAGE_KEY) || '');
  return validateSave(saved) ? saved : null;
};

const exportSave = (payload) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `arpg-save-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

const importSaveFile = (file, onLoad) => {
  const reader = new FileReader();
  reader.onload = () => {
    const payload = safeParseJson(reader.result);
    if (validateSave(payload)) {
      onLoad(payload);
    } else {
      alert('Invalid or corrupted save file.');
    }
  };
  reader.readAsText(file);
};

const useSound = (muted) => {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current) return;
    audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
  }, []);

  const play = useCallback(
    (type) => {
      if (muted || !audioRef.current) return;
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      const settings = {
        hit: { freq: 180, duration: 0.1 },
        pickup: { freq: 400, duration: 0.12 },
        death: { freq: 80, duration: 0.3 },
      }[type];
      if (!settings) return;
      osc.frequency.value = settings.freq;
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + settings.duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + settings.duration);
    },
    [muted],
  );

  return play;
};

const HUDBar = ({ label, value, max, color }) => (
  <div className="hud-bar">
    <div className="hud-bar__label">{label}</div>
    <div className="hud-bar__track">
      <div
        className="hud-bar__fill"
        style={{ width: `${(value / max) * 100}%`, background: color }}
      />
    </div>
    <div className="hud-bar__value">
      {Math.round(value)} / {Math.round(max)}
    </div>
  </div>
);

export default function App() {
  const [gameState, setGameState] = useState(() => createNewGame());
  const [screen, setScreen] = useState('title');
  const [activePanel, setActivePanel] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [settings, setSettings] = useState(() => {
    const saved = safeParseJson(localStorage.getItem(SETTINGS_KEY) || '');
    return (
      saved || {
        keyBindings: KEY_BINDINGS_DEFAULT,
        reducedMotion: false,
        mute: false,
        theme: 'standard',
      }
    );
  });
  const playSound = useSound(settings.mute);
  const canvasRef = useRef(null);
  const inputRef = useRef({});
  const lastTimeRef = useRef(null);
  const rngRef = useRef(createRng(gameState.seed));
  const fileInputRef = useRef(null);

  const theme = UI_THEMES[settings.theme] || UI_THEMES.standard;

  const playerStats = useMemo(() => calculateStats(gameState.player), [gameState.player]);

  const currentZone = ZONES[gameState.zoneId];
  const zoneState = gameState.zones[gameState.zoneId];

  const updateSettings = (next) => {
    setSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  const handleTogglePanel = (panel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
    setSelectedItem(null);
  };

  const spawnLoot = (state, enemy, position) => {
    const rng = rngRef.current;
    const typeIndex = Math.floor(rng() * 3);
    const type = ['Weapon', 'Armor', 'Accessory'][typeIndex];
    const item = createItem(rng, type);
    const lootId = uuid();
    if (!state.lootOnGround[state.zoneId]) {
      state.lootOnGround[state.zoneId] = [];
    }
    state.lootOnGround[state.zoneId].push({ id: lootId, item, x: position.x, y: position.y });
    console.info('LootDrop', { enemy: enemy.type, rarity: item.rarity });
  };

  const handlePickup = (state, loot) => {
    const inventory = state.player.inventory;
    if (loot.item.type === 'Consumable') {
      const existing = inventory.find(
        (slot) => slot && slot.type === 'Consumable' && slot.baseId === loot.item.baseId,
      );
      if (existing) {
        existing.stack += 1;
        playSound('pickup');
        return true;
      }
    }
    const emptyIndex = inventory.findIndex((slot) => slot === null);
    if (emptyIndex === -1) {
      addFloatingText(state, 'Inventory Full', state.player.x, state.player.y, '#fca5a5');
      return false;
    }
    inventory[emptyIndex] = loot.item;
    playSound('pickup');
    return true;
  };

  const handleEquip = (item) => {
    if (!item) return;
    setGameState((prev) => {
      const next = structuredClone(prev);
      const slotMap = {
        Weapon: 'weapon',
        Armor: 'armor',
        Accessory: 'accessory',
      };
      const slot = slotMap[item.type];
      if (!slot) return prev;
      const existing = next.player.equipment[slot];
      next.player.equipment[slot] = item;
      const index = next.player.inventory.findIndex((entry) => entry && entry.uid === item.uid);
      if (index >= 0) next.player.inventory[index] = existing || null;
      return next;
    });
  };

  const handleConsume = (item) => {
    if (!item) return;
    setGameState((prev) => {
      const next = structuredClone(prev);
      if (item.stats.heal) {
        next.player.hp = clamp(next.player.hp + item.stats.heal, 0, calculateStats(next.player).maxHp);
      }
      if (item.stats.speed && item.stats.duration) {
        next.player.buffs.push({
          id: uuid(),
          stat: 'speed',
          value: item.stats.speed,
          ttl: item.stats.duration,
        });
      }
      const index = next.player.inventory.findIndex((entry) => entry && entry.uid === item.uid);
      if (index >= 0) {
        if (item.stack > 1) {
          next.player.inventory[index] = { ...item, stack: item.stack - 1 };
        } else {
          next.player.inventory[index] = null;
        }
      }
      return next;
    });
  };

  const handleDrop = (item) => {
    if (!item) return;
    setGameState((prev) => {
      const next = structuredClone(prev);
      if (!next.lootOnGround[next.zoneId]) next.lootOnGround[next.zoneId] = [];
      next.lootOnGround[next.zoneId].push({
        id: uuid(),
        item,
        x: next.player.x,
        y: next.player.y,
      });
      const index = next.player.inventory.findIndex((entry) => entry && entry.uid === item.uid);
      if (index >= 0) next.player.inventory[index] = null;
      return next;
    });
  };

  const saveGame = useCallback(
    (state, shouldExport = false) => {
      const payload = saveToLocalStorage(state);
      if (shouldExport) {
        exportSave(payload);
      }
      return payload;
    },
    [],
  );

  const loadGame = (payload) => {
    setGameState(() => ({
      ...payload,
      projectiles: [],
      floatingText: [],
      lastSave: new Date().toISOString(),
    }));
    rngRef.current = createRng(payload.seed);
    setScreen('game');
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      const { code } = event;
      inputRef.current[code] = true;
      if (code === settings.keyBindings.inventory) handleTogglePanel('inventory');
      if (code === settings.keyBindings.character) handleTogglePanel('character');
      if (code === settings.keyBindings.settings) handleTogglePanel('settings');
      if (code === settings.keyBindings.save) saveGame(gameState, true);
      if (code === settings.keyBindings.load) {
        const saved = loadFromStorage();
        if (saved) loadGame(saved);
      }
    };
    const handleKeyUp = (event) => {
      inputRef.current[event.code] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, saveGame, settings.keyBindings]);

  useEffect(() => {
    if (screen !== 'game') return;
    let animationFrame;

    const loop = (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      setGameState((prev) => {
        const next = structuredClone(prev);
        next.time += delta;
        const zone = ZONES[next.zoneId];
        const zoneStateLocal = next.zones[next.zoneId];
        const input = inputRef.current;

        const stats = calculateStats(next.player);
        next.player.buffs = next.player.buffs
          .map((buff) => ({ ...buff, ttl: buff.ttl - delta }))
          .filter((buff) => buff.ttl > 0);
        const speedBuff = next.player.buffs
          .filter((buff) => buff.stat === 'speed')
          .reduce((sum, buff) => sum + buff.value, 0);
        const speedMod = stats.speed * (1 + speedBuff);

        const dx =
          (input[settings.keyBindings.right] ? 1 : 0) -
          (input[settings.keyBindings.left] ? 1 : 0);
        const dy =
          (input[settings.keyBindings.down] ? 1 : 0) -
          (input[settings.keyBindings.up] ? 1 : 0);
        if (!next.player.isDead && (dx || dy)) {
          const normalized = normalize(dx, dy);
          const moveX = normalized.x * speedMod * delta;
          const moveY = normalized.y * speedMod * delta;
          const nextX = clamp(next.player.x + moveX, 0.5, zone.tiles[0].length - 1.5);
          const nextY = clamp(next.player.y + moveY, 0.5, zone.tiles.length - 1.5);
          if (isWalkable(zone, Math.floor(nextX), Math.floor(next.player.y))) {
            next.player.x = nextX;
          }
          if (isWalkable(zone, Math.floor(next.player.x), Math.floor(nextY))) {
            next.player.y = nextY;
          }
        }

        const lootInZone = next.lootOnGround[next.zoneId] || [];
        lootInZone.forEach((loot, index) => {
          if (distance(loot, next.player) < 0.7) {
            if (handlePickup(next, loot)) {
              lootInZone.splice(index, 1);
            }
          }
        });

        if (input[settings.keyBindings.melee] && !next.player.isDead) {
          if (!next.player.meleeCooldown || next.player.meleeCooldown <= 0) {
            next.player.meleeCooldown = 0.6;
            zoneStateLocal.enemies.forEach((enemy) => {
              if (!enemy.alive) return;
              if (distance(enemy, next.player) < 0.9) {
                const result = computeDamage(rngRef.current, stats.damage, 0, stats.critChance);
                enemy.hp -= result.damage;
                addFloatingText(next, `${result.damage}${result.crit ? '!' : ''}`, enemy.x, enemy.y);
                playSound('hit');
                if (enemy.hp <= 0) {
                  enemy.alive = false;
                  addFloatingText(next, 'Defeated', enemy.x, enemy.y, '#a7f3d0');
                  next.player.xp += enemy.xp;
                  spawnLoot(next, enemy, enemy);
                  console.info('EnemyDefeated', { type: enemy.type, xp: enemy.xp });
                }
              }
            });
          }
        }

        if (input[settings.keyBindings.ranged] && !next.player.isDead) {
          if (!next.player.rangedCooldown || next.player.rangedCooldown <= 0) {
            next.player.rangedCooldown = 1.2;
            next.projectiles.push({
              id: uuid(),
              x: next.player.x,
              y: next.player.y,
              vx: 0,
              vy: -1.4,
              damage: stats.damage * 0.8,
              from: 'player',
              ttl: 1.5,
            });
          }
        }

        if (next.player.meleeCooldown) next.player.meleeCooldown -= delta;
        if (next.player.rangedCooldown) next.player.rangedCooldown -= delta;

        next.projectiles = next.projectiles
          .map((proj) => ({
            ...proj,
            x: proj.x + proj.vx * delta * 3,
            y: proj.y + proj.vy * delta * 3,
            ttl: proj.ttl - delta,
          }))
          .filter((proj) => proj.ttl > 0);

        next.projectiles.forEach((proj) => {
          if (proj.from === 'player') {
            zoneStateLocal.enemies.forEach((enemy) => {
              if (!enemy.alive) return;
              if (distance(enemy, proj) < 0.5) {
                const result = computeDamage(rngRef.current, proj.damage, 0, stats.critChance * 0.5);
                enemy.hp -= result.damage;
                proj.ttl = 0;
                addFloatingText(next, `${Math.round(result.damage)}`, enemy.x, enemy.y);
                if (enemy.hp <= 0) {
                  enemy.alive = false;
                  next.player.xp += enemy.xp;
                  spawnLoot(next, enemy, enemy);
                  console.info('EnemyDefeated', { type: enemy.type, xp: enemy.xp });
                }
              }
            });
          } else if (proj.from === 'enemy') {
            if (distance(next.player, proj) < 0.6) {
              const result = computeDamage(rngRef.current, proj.damage, stats.defense, 0);
              next.player.hp = clamp(next.player.hp - result.damage, 0, stats.maxHp);
              addFloatingText(next, `${result.damage}`, next.player.x, next.player.y, '#fca5a5');
              proj.ttl = 0;
            }
          }
        });

        zoneStateLocal.enemies.forEach((enemy) => {
          if (!enemy.alive) return;
          const dist = distance(enemy, next.player);
          if (dist < 5 && !next.player.isDead) {
            const dir = normalize(next.player.x - enemy.x, next.player.y - enemy.y);
            if (dist > 0.8) {
              enemy.x += dir.x * enemy.speed * delta * 0.02;
              enemy.y += dir.y * enemy.speed * delta * 0.02;
            }
            enemy.cooldown -= delta;
            if (enemy.cooldown <= 0 && dist < enemy.range / TILE_SIZE) {
              enemy.cooldown = enemy.attackInterval;
              if (enemy.ranged) {
                next.projectiles.push({
                  id: uuid(),
                  x: enemy.x,
                  y: enemy.y,
                  vx: dir.x,
                  vy: dir.y,
                  damage: enemy.damage,
                  from: 'enemy',
                  ttl: 2,
                });
              } else {
                const result = computeDamage(rngRef.current, enemy.damage, stats.defense, 0);
                next.player.hp = clamp(next.player.hp - result.damage, 0, stats.maxHp);
                addFloatingText(next, `${result.damage}`, next.player.x, next.player.y, '#fca5a5');
              }
            }
          }
        });

        if (next.player.hp <= 0 && !next.player.isDead) {
          next.player.isDead = true;
          playSound('death');
          console.info('PlayerDeath', { zone: next.zoneId, time: next.time });
        }

        if (next.player.isDead) {
          next.player.respawnTimer = (next.player.respawnTimer || 2) - delta;
          if (next.player.respawnTimer <= 0) {
            next.player.isDead = false;
            next.player.respawnTimer = null;
            next.player.hp = stats.maxHp * 0.5;
            const penalty = Math.min(next.player.xpToNext * 0.1, next.player.xp);
            next.player.xp = Math.max(0, next.player.xp - penalty);
            next.player.x = zone.entry.x + 0.5;
            next.player.y = zone.entry.y + 0.5;
          }
        }

        if (next.player.xp >= next.player.xpToNext && next.player.level < LEVEL_CAP) {
          next.player.xp -= next.player.xpToNext;
          next.player.level += 1;
          next.player.hp = clamp(next.player.hp + stats.maxHp * 0.2, 0, stats.maxHp + 10);
          next.player.xpToNext = XP_TABLE[next.player.level] || next.player.xpToNext;
          next.player.levelUpFlash = 0.6;
        }

        if (next.player.level >= LEVEL_CAP) {
          next.player.xp = clamp(next.player.xp, 0, next.player.xpToNext);
        }

        if (next.player.levelUpFlash) {
          next.player.levelUpFlash -= delta;
        }

        next.floatingText = next.floatingText
          .map((entry) => ({ ...entry, y: entry.y - delta * 0.6, ttl: entry.ttl - delta }))
          .filter((entry) => entry.ttl > 0);

        const tile = getTile(zone, Math.floor(next.player.x), Math.floor(next.player.y));
        if (tile === 'E') {
          const nextZoneId = zone.exits.E;
          const targetZone = ZONES[nextZoneId];
          next.zoneId = nextZoneId;
          next.player.x = targetZone.entry.x + 0.5;
          next.player.y = targetZone.entry.y + 0.5;
          console.info('ZoneTransition', { from: zone.id, to: nextZoneId, time: next.time });
          saveGame(next);
        }

        return next;
      });

      animationFrame = requestAnimationFrame(loop);
    };

    animationFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrame);
  }, [screen, settings.keyBindings, playSound, saveGame]);

  useEffect(() => {
    if (screen !== 'game') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      const zone = ZONES[gameState.zoneId];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      zone.tiles.forEach((row, y) => {
        [...row].forEach((tile, x) => {
          if (tile === '#') {
            ctx.fillStyle = '#1f2937';
          } else if (tile === 'E') {
            ctx.fillStyle = '#334155';
          } else if (tile === 'B') {
            ctx.fillStyle = '#1f2a44';
          } else {
            ctx.fillStyle = '#0b1120';
          }
          ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        });
      });

      zoneState.enemies.forEach((enemy) => {
        if (!enemy.alive) return;
        ctx.fillStyle = enemy.elite ? '#fb7185' : '#f97316';
        ctx.beginPath();
        ctx.arc(enemy.x * TILE_SIZE, enemy.y * TILE_SIZE, 10, 0, Math.PI * 2);
        ctx.fill();
      });

      const lootInZone = gameState.lootOnGround[gameState.zoneId] || [];
      lootInZone.forEach((loot) => {
        ctx.fillStyle = loot.item.color || '#f9a8d4';
        ctx.fillRect(loot.x * TILE_SIZE - 6, loot.y * TILE_SIZE - 6, 12, 12);
      });

      gameState.projectiles.forEach((proj) => {
        ctx.fillStyle = proj.from === 'player' ? '#7dd3fc' : '#fca5a5';
        ctx.beginPath();
        ctx.arc(proj.x * TILE_SIZE, proj.y * TILE_SIZE, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = gameState.player.isDead ? '#94a3b8' : '#22c55e';
      ctx.beginPath();
      ctx.arc(gameState.player.x * TILE_SIZE, gameState.player.y * TILE_SIZE, 10, 0, Math.PI * 2);
      ctx.fill();

      gameState.floatingText.forEach((entry) => {
        ctx.fillStyle = entry.color;
        ctx.font = '12px sans-serif';
        ctx.fillText(entry.text, entry.x * TILE_SIZE, entry.y * TILE_SIZE);
      });
    };

    draw();
  }, [gameState, zoneState]);

  const handleStartNew = () => {
    const newState = createNewGame();
    setGameState(newState);
    rngRef.current = createRng(newState.seed);
    setScreen('game');
  };

  const handleLoadLatest = () => {
    const saved = loadFromStorage();
    if (saved) {
      loadGame(saved);
    } else {
      setErrorMessage('No save found in local storage.');
    }
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setGameState(createNewGame());
  };

  const displayedStats = useMemo(() => calculateStats(gameState.player), [gameState.player]);
  const equipmentList = gameState.player.equipment;
  const slotMap = { Weapon: 'weapon', Armor: 'armor', Accessory: 'accessory' };
  const compareSlot = selectedItem ? slotMap[selectedItem.type] : null;
  const equippedItem = compareSlot ? equipmentList[compareSlot] : null;
  const selectedStats = selectedItem ? getItemStatTotals(selectedItem) : null;
  const equippedStats = equippedItem ? getItemStatTotals(equippedItem) : null;

  return (
    <div className="app" style={{ background: theme.background, color: theme.text }}>
      <header className="app__header">
        <div>
          <h1>ARPG v0</h1>
          <p>Seed: {gameState.seedString}</p>
        </div>
        <div className="app__header-buttons">
          {screen === 'game' && (
            <>
              <button onClick={() => handleTogglePanel('inventory')}>Inventory (I)</button>
              <button onClick={() => handleTogglePanel('character')}>Character (C)</button>
              <button onClick={() => handleTogglePanel('settings')}>Settings (O)</button>
              <button onClick={() => saveGame(gameState, true)}>Save</button>
              <button onClick={handleLoadLatest}>Load Latest</button>
            </>
          )}
        </div>
      </header>

      {screen === 'title' && (
        <div className="title-screen">
          <div className="title-screen__panel" style={{ background: theme.panel }}>
            <h2>V0 Loop: Explore → Fight → Loot → Level</h2>
            <p>
              Battle through the Sunset Overworld and descend into the Echo Shrine. Save files are
              stored as JSON and can be loaded back into the game.
            </p>
            <div className="title-screen__buttons">
              <button onClick={handleStartNew}>Start New Game</button>
              <button onClick={handleLoadLatest}>Load Latest Save</button>
              <button onClick={() => fileInputRef.current?.click()}>Load from File</button>
            </div>
            {errorMessage && <p className="error">{errorMessage}</p>}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) importSaveFile(file, loadGame);
              }}
            />
          </div>
        </div>
      )}

      {screen === 'game' && (
        <main className="game">
          <section className="game__left">
            <div className="hud" style={{ background: theme.panel }}>
              <HUDBar
                label="HP"
                value={gameState.player.hp}
                max={displayedStats.maxHp}
                color="#ef4444"
              />
              <HUDBar
                label="XP"
                value={gameState.player.xp}
                max={gameState.player.xpToNext}
                color="#60a5fa"
              />
              <div className="hud__row">
                <div>Level {gameState.player.level}</div>
                <div>Zone: {currentZone.name}</div>
              </div>
              <div className="hud__row">
                <div>Weapon: {equipmentList.weapon?.name}</div>
                <div>Seeded Loot</div>
              </div>
              {gameState.player.levelUpFlash && <div className="hud__level">LEVEL UP!</div>}
            </div>
            <canvas
              ref={canvasRef}
              width={TILE_SIZE * currentZone.tiles[0].length}
              height={TILE_SIZE * currentZone.tiles.length}
              className={settings.reducedMotion ? 'canvas reduced' : 'canvas'}
            />
            <div className="game__tips">
              <p>Move: WASD | Melee: J | Ranged: K</p>
              <p>Pick up items by walking over them. Exit tiles (E) save automatically.</p>
            </div>
          </section>
          <section className="game__right">
            <div className="panel" style={{ background: theme.panel }}>
              <h3>Stats</h3>
              <ul>
                <li>Damage: {Math.round(displayedStats.damage)}</li>
                <li>Defense: {Math.round(displayedStats.defense)}</li>
                <li>Speed: {Math.round(displayedStats.speed)}</li>
                <li>Crit Chance: {formatPercent(displayedStats.critChance)}</li>
              </ul>
              <button onClick={() => saveGame(gameState, true)}>Save + Export JSON</button>
              <button onClick={handleReset}>Reset Save</button>
            </div>
            <div className="panel" style={{ background: theme.panel }}>
              <h3>Zone Tracker</h3>
              <p>Enemies remaining: {zoneState.enemies.filter((enemy) => enemy.alive).length}</p>
              <p>Loot drops: {(gameState.lootOnGround[gameState.zoneId] || []).length}</p>
              <p>Telemetry: check console logs for combat + loot events.</p>
            </div>
          </section>
        </main>
      )}

      {activePanel === 'inventory' && (
        <div className="overlay" role="dialog" aria-label="Inventory">
          <div className="panel overlay__panel" style={{ background: theme.panel }}>
            <h2>Inventory (20 slots)</h2>
            <div className="inventory">
              {gameState.player.inventory.map((item, index) => (
                <button
                  key={item?.uid || index}
                  className={`inventory__slot ${item ? 'filled' : ''}`}
                  onClick={() => setSelectedItem(item)}
                >
                  {item ? (
                    <div>
                      <div style={{ color: item.color }}>{item.name}</div>
                      {item.stack > 0 && <span>x{item.stack}</span>}
                    </div>
                  ) : (
                    <div className="inventory__empty">Empty</div>
                  )}
                </button>
              ))}
            </div>
            {selectedItem && (
              <div className="item-detail">
                <h3 style={{ color: selectedItem.color }}>{selectedItem.name}</h3>
                <p>{selectedItem.type}</p>
                <ul>
                  {Object.entries(selectedItem.stats)
                    .filter(([, value]) => value)
                    .map(([stat, value]) => (
                      <li key={stat}>
                        {stat}: {value}
                      </li>
                    ))}
                  {selectedItem.affixes.map((affix) => (
                    <li key={affix.id}>
                      {affix.label} {affix.value}
                    </li>
                  ))}
                </ul>
                {equippedItem && selectedItem.type !== 'Consumable' && (
                  <div className="compare">
                    <h4>Compare vs Equipped</h4>
                    <ul>
                      {Object.entries(selectedStats)
                        .filter(([, value]) => value)
                        .map(([stat, value]) => {
                          const delta = value - (equippedStats?.[stat] || 0);
                          return (
                            <li key={stat} className={delta >= 0 ? 'pos' : 'neg'}>
                              {stat}: {delta >= 0 ? '+' : ''}
                              {Math.round(delta * 100) / 100}
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                )}
                <div className="item-detail__actions">
                  {selectedItem.type !== 'Consumable' && (
                    <button onClick={() => handleEquip(selectedItem)}>Equip</button>
                  )}
                  {selectedItem.type === 'Consumable' && (
                    <button onClick={() => handleConsume(selectedItem)}>Consume</button>
                  )}
                  <button onClick={() => handleDrop(selectedItem)}>Drop</button>
                </div>
              </div>
            )}
            <button className="close" onClick={() => setActivePanel(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {activePanel === 'character' && (
        <div className="overlay" role="dialog" aria-label="Character">
          <div className="panel overlay__panel" style={{ background: theme.panel }}>
            <h2>Character Sheet</h2>
            <p>Level {gameState.player.level}</p>
            <p>HP {Math.round(gameState.player.hp)} / {Math.round(displayedStats.maxHp)}</p>
            <p>Damage {Math.round(displayedStats.damage)}</p>
            <p>Defense {Math.round(displayedStats.defense)}</p>
            <p>Speed {Math.round(displayedStats.speed)}</p>
            <p>Crit Chance {formatPercent(displayedStats.critChance)}</p>
            <div className="character__equipment">
              <div>
                <strong>Weapon</strong>
                <p>{equipmentList.weapon?.name}</p>
              </div>
              <div>
                <strong>Armor</strong>
                <p>{equipmentList.armor?.name}</p>
              </div>
              <div>
                <strong>Accessory</strong>
                <p>{equipmentList.accessory?.name || 'None'}</p>
              </div>
            </div>
            <button className="close" onClick={() => setActivePanel(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {activePanel === 'settings' && (
        <div className="overlay" role="dialog" aria-label="Settings">
          <div className="panel overlay__panel" style={{ background: theme.panel }}>
            <h2>Settings</h2>
            <label className="setting">
              <span>Mute Audio</span>
              <input
                type="checkbox"
                checked={settings.mute}
                onChange={(event) => updateSettings({ ...settings, mute: event.target.checked })}
              />
            </label>
            <label className="setting">
              <span>Reduced Motion</span>
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(event) =>
                  updateSettings({ ...settings, reducedMotion: event.target.checked })
                }
              />
            </label>
            <label className="setting">
              <span>High Contrast Theme</span>
              <input
                type="checkbox"
                checked={settings.theme === 'highContrast'}
                onChange={(event) =>
                  updateSettings({
                    ...settings,
                    theme: event.target.checked ? 'highContrast' : 'standard',
                  })
                }
              />
            </label>
            <div className="setting-group">
              <h3>Keybindings</h3>
              {Object.entries(settings.keyBindings).map(([action, key]) => (
                <div className="setting-row" key={action}>
                  <span>{action}</span>
                  <input
                    value={key}
                    onChange={(event) =>
                      updateSettings({
                        ...settings,
                        keyBindings: {
                          ...settings.keyBindings,
                          [action]: event.target.value,
                        },
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <p className="hint">Use KeyboardEvent codes (e.g., KeyJ, KeyK, KeyI).</p>
            <button className="close" onClick={() => setActivePanel(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
