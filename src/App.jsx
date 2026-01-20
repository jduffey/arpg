import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GAME_CONFIG } from './game/config';
import { ZONES } from './game/data';
import {
  addItemToInventory,
  applyDamage,
  applyXpPenalty,
  buildCombatLogEntry,
  calculatePlayerStats,
  consumeItem,
  createEnemy,
  createInitialPlayer,
  createSeededRun,
  gainXp,
  resolvePlayerAttack,
  rollLoot
} from './game/logic';
import { mulberry32 } from './game/rng';
import {
  loadFromDirectoryHandle,
  deserializeGameState,
  loadFromLocalStorage,
  saveToDirectory,
  saveToLocalStorage
} from './game/save';

const TILE_SIZE = GAME_CONFIG.canvas.tileSize;
const CANVAS_W = GAME_CONFIG.canvas.width;
const CANVAS_H = GAME_CONFIG.canvas.height;

const initialSettings = {
  reducedMotion: false,
  highContrast: false,
  mute: false,
  controls: { ...GAME_CONFIG.controls }
};

const createZoneEnemies = (zoneId) => {
  const zone = ZONES[zoneId];
  return zone.spawns.map((spawn) => {
    const enemy = createEnemy(spawn.type, zone.tier);
    return {
      ...enemy,
      x: spawn.x * TILE_SIZE + TILE_SIZE / 2,
      y: spawn.y * TILE_SIZE + TILE_SIZE / 2
    };
  });
};

const createNewRun = () => {
  const { seed, rng } = createSeededRun();
  const player = createInitialPlayer(seed);
  const overworldEnemies = createZoneEnemies(GAME_CONFIG.zones.overworld);
  return {
    seed,
    rng,
    zoneId: GAME_CONFIG.zones.overworld,
    player,
    enemies: overworldEnemies,
    zoneStates: {
      [GAME_CONFIG.zones.overworld]: {
        enemies: overworldEnemies
      }
    },
    loot: [],
    projectiles: [],
    floatingText: [],
    logs: [buildCombatLogEntry('New run started.')],
    playTimeMs: 0,
    lastAttackMs: 0,
    lastRangedMs: 0,
    lootSeedCounter: 0
  };
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const App = () => {
  const canvasRef = useRef(null);
  const [screen, setScreen] = useState('title');
  const [settings, setSettings] = useState(initialSettings);
  const [showInventory, setShowInventory] = useState(false);
  const [showCharacter, setShowCharacter] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [directoryHandle, setDirectoryHandle] = useState(null);
  const [saveSlots, setSaveSlots] = useState([]);
  const [localSaves, setLocalSaves] = useState([]);
  const [error, setError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const inputRef = useRef({});
  const gameRef = useRef(createNewRun());
  const animationRef = useRef();

  const activeState = gameRef.current;

  const playerStats = useMemo(() => calculatePlayerStats(activeState.player), [activeState.player]);

  const refreshLocalSaves = useCallback(() => {
    setLocalSaves(loadFromLocalStorage());
  }, []);

  const refreshDirectorySaves = useCallback(async () => {
    if (!directoryHandle) return;
    const list = await directoryHandle.values();
    const saves = [];
    for await (const handle of list) {
      if (handle.kind === 'file' && handle.name.endsWith('.json')) {
        saves.push(handle);
      }
    }
    setSaveSlots(saves);
  }, [directoryHandle]);

  const connectSavesFolder = useCallback(async () => {
    try {
      if (!window.showDirectoryPicker) {
        setError('File system access not supported. Using browser storage instead.');
        return;
      }
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      setDirectoryHandle(handle);
    } catch (err) {
      setError('Unable to access saves folder.');
    }
  }, []);

  useEffect(() => {
    refreshLocalSaves();
  }, [refreshLocalSaves]);

  useEffect(() => {
    if (directoryHandle) {
      refreshDirectorySaves();
    }
  }, [directoryHandle, refreshDirectorySaves]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code in settings.controls) {
        inputRef.current[event.code] = true;
      }
      if (event.code === settings.controls.inventory) {
        setShowInventory((prev) => !prev);
      }
      if (event.code === settings.controls.character) {
        setShowCharacter((prev) => !prev);
      }
      if (event.code === settings.controls.settings) {
        setShowSettings((prev) => !prev);
      }
    };

    const handleKeyUp = (event) => {
      if (event.code in settings.controls) {
        inputRef.current[event.code] = false;
      }
    };

    const handleBlur = () => {
      inputRef.current = {};
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [settings.controls]);

  const playSound = useCallback(
    (frequency, duration = 0.1) => {
      if (settings.mute) return;
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'square';
        oscillator.frequency.value = frequency;
        gainNode.gain.value = 0.05;
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + duration);
      } catch (err) {
        console.warn('Audio error', err);
      }
    },
    [settings.mute]
  );

  const resetRun = useCallback(() => {
    gameRef.current = createNewRun();
    setSelectedSlot(null);
    setScreen('game');
    setError('');
  }, []);

  const saveGame = useCallback(async () => {
    const state = gameRef.current;
    const slotId = `slot-${Date.now()}`;
    saveToLocalStorage(slotId, state);
    refreshLocalSaves();

    if (directoryHandle) {
      const filename = `${slotId}.json`;
      await saveToDirectory(directoryHandle, filename, state);
      await refreshDirectorySaves();
    }
  }, [directoryHandle, refreshDirectorySaves, refreshLocalSaves]);

  const loadSave = useCallback(
    async (slot) => {
      try {
        if (slot?.handle) {
          const data = await loadFromDirectoryHandle(slot.handle);
          gameRef.current = {
            ...createNewRun(),
            ...data,
            rng: mulberry32(data.seed)
          };
        } else if (slot?.data) {
          const data = deserializeGameState(slot.data);
          gameRef.current = {
            ...createNewRun(),
            ...data,
            rng: mulberry32(data.seed ?? createSeededRun().seed)
          };
        }
        setScreen('game');
        setSelectedSlot(slot?.name || slot?.id || null);
        setError('');
      } catch (err) {
        setError('Save file corrupt or incompatible.');
      }
    },
    []
  );

  const handleInventoryAction = (index) => {
    const state = gameRef.current;
    const item = state.player.inventory[index];
    if (!item) return;
    if (item.type === 'Consumable') {
      if (consumeItem(state.player, state.player.inventory, index)) {
        playSound(520, 0.08);
      }
      return;
    }
    const current = state.player.gear[item.type];
    state.player.gear[item.type] = item;
    state.player.inventory[index] = current;
    playSound(300, 0.08);
  };

  const getItemDelta = (item) => {
    if (!item || item.type === 'Consumable') return null;
    const current = gameRef.current.player.gear[item.type];
    if (!current) return Object.entries(item.stats);
    const entries = Object.entries(item.stats).map(([key, value]) => {
      const currentValue = current.stats?.[key] || 0;
      return [key, value - currentValue];
    });
    return entries;
  };

  const handleUnequip = (slot) => {
    const state = gameRef.current;
    const item = state.player.gear[slot];
    if (!item) return;
    if (!addItemToInventory(state.player.inventory, item)) {
      setError('Inventory full.');
      return;
    }
    state.player.gear[slot] = null;
  };

  useEffect(() => {
    if (screen !== 'game') return;
    let lastTime = performance.now();

    const step = (time) => {
      const delta = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;
      updateGame(delta);
      drawFrame();
      animationRef.current = requestAnimationFrame(step);
    };

    animationRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationRef.current);
  });

  const updateGame = (delta) => {
    const state = gameRef.current;
    state.playTimeMs += delta * 1000;
    const player = state.player;
    const stats = calculatePlayerStats(player);
    player.maxHp = stats.maxHp;
    player.hp = clamp(player.hp, 0, stats.maxHp);

    if (player.hp <= 0) {
      player.deathCount += 1;
      applyXpPenalty(player);
      player.hp = Math.round(stats.maxHp * 0.5);
      player.x = 2 * TILE_SIZE + TILE_SIZE / 2;
      player.y = 2 * TILE_SIZE + TILE_SIZE / 2;
      state.logs.unshift(buildCombatLogEntry('You fell and returned to the zone start.', 'warn'));
      playSound(120, 0.3);
    }

    const move = getMoveVector();
    if (move.x !== 0 || move.y !== 0) {
      player.facing = move.x === 0 ? (move.y > 0 ? 'down' : 'up') : move.x > 0 ? 'right' : 'left';
    }
    const speed = stats.speed;
    const nextX = player.x + move.x * speed * delta;
    const nextY = player.y + move.y * speed * delta;
    const resolved = resolveCollision(state.zoneId, nextX, nextY);
    player.x = resolved.x;
    player.y = resolved.y;

    handleAttacks(state, stats, delta);
    updateEnemies(state, stats, delta);
    updateProjectiles(state, delta);
    updateFloatingText(state, delta);
    checkLootPickup(state);
    checkZoneExit(state);
  };

  const getMoveVector = () => {
    const input = inputRef.current;
    const up = input[settings.controls.moveUp];
    const down = input[settings.controls.moveDown];
    const left = input[settings.controls.moveLeft];
    const right = input[settings.controls.moveRight];
    let x = 0;
    let y = 0;
    if (up) y -= 1;
    if (down) y += 1;
    if (left) x -= 1;
    if (right) x += 1;
    if (x !== 0 && y !== 0) {
      const length = Math.hypot(x, y);
      x /= length;
      y /= length;
    }
    return { x, y };
  };

  const resolveCollision = (zoneId, nextX, nextY) => {
    const zone = ZONES[zoneId];
    const tileX = Math.floor(nextX / TILE_SIZE);
    const tileY = Math.floor(nextY / TILE_SIZE);
    if (zone.map[tileY]?.[tileX] === '1') {
      return { x: gameRef.current.player.x, y: gameRef.current.player.y };
    }
    return {
      x: clamp(nextX, TILE_SIZE, CANVAS_W - TILE_SIZE),
      y: clamp(nextY, TILE_SIZE, CANVAS_H - TILE_SIZE)
    };
  };

  const handleAttacks = (state, stats, delta) => {
    const now = performance.now();
    const meleePressed = inputRef.current[settings.controls.melee];
    const rangedPressed = inputRef.current[settings.controls.ranged] || inputRef.current.mouseAttack;

    if (meleePressed && now - state.lastAttackMs > GAME_CONFIG.combat.meleeCooldownMs) {
      state.lastAttackMs = now;
      const result = resolvePlayerAttack(stats, state.rng, stats.damage + 4);
      performMeleeHit(state, result);
    }

    if (rangedPressed && now - state.lastRangedMs > GAME_CONFIG.combat.rangedCooldownMs) {
      state.lastRangedMs = now;
      spawnProjectile(state, stats);
    }
  };

  const performMeleeHit = (state, result) => {
    let hit = false;
    state.enemies.forEach((enemy) => {
      const distance = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
      if (distance < 40 && enemy.hp > 0) {
        const dealt = applyDamage(enemy, result.damage);
        state.floatingText.push({
          id: `${Date.now()}-${enemy.id}`,
          x: enemy.x,
          y: enemy.y,
          value: dealt,
          crit: result.isCrit,
          ttl: 0.9
        });
        hit = true;
        if (enemy.hp <= 0) {
          handleEnemyDeath(state, enemy);
        }
      }
    });
    if (hit) {
      playSound(result.isCrit ? 700 : 520, 0.1);
    }
  };

  const spawnProjectile = (state, stats) => {
    const direction = state.player.facing || 'down';
    const vector = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 }
    }[direction];
    state.projectiles.push({
      id: `${Date.now()}-${Math.random()}`,
      x: state.player.x,
      y: state.player.y,
      vx: vector.x * GAME_CONFIG.combat.projectileSpeed,
      vy: vector.y * GAME_CONFIG.combat.projectileSpeed,
      damage: stats.damage + 2,
      ttl: 1.2
    });
    playSound(260, 0.08);
  };

  const updateProjectiles = (state, delta) => {
    state.projectiles.forEach((proj) => {
      proj.x += proj.vx * delta;
      proj.y += proj.vy * delta;
      proj.ttl -= delta;
    });
    state.projectiles = state.projectiles.filter((proj) => proj.ttl > 0);
    state.projectiles.forEach((proj) => {
      state.enemies.forEach((enemy) => {
        if (enemy.hp <= 0) return;
        const distance = Math.hypot(enemy.x - proj.x, enemy.y - proj.y);
        if (distance < 18) {
          const dealt = applyDamage(enemy, proj.damage);
          state.floatingText.push({
            id: `${Date.now()}-${enemy.id}`,
            x: enemy.x,
            y: enemy.y,
            value: dealt,
            crit: false,
            ttl: 0.8
          });
          proj.ttl = 0;
          if (enemy.hp <= 0) {
            handleEnemyDeath(state, enemy);
          }
        }
      });
    });
  };

  const updateEnemies = (state, stats, delta) => {
    state.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      const distance = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
      if (distance < 140) {
        enemy.state = 'chase';
        if (distance > 24) {
          const dx = (state.player.x - enemy.x) / distance;
          const dy = (state.player.y - enemy.y) / distance;
          enemy.x += dx * enemy.speed * delta;
          enemy.y += dy * enemy.speed * delta;
        } else {
          enemy.state = 'attack';
          enemy.attackCooldown -= delta;
          if (enemy.attackCooldown <= 0) {
            const dealt = applyDamage(state.player, enemy.damage);
            state.floatingText.push({
              id: `${Date.now()}-player`,
              x: state.player.x,
              y: state.player.y,
              value: dealt,
              crit: false,
              ttl: 0.8,
              enemy: true
            });
            enemy.attackCooldown = 1.1;
            playSound(180, 0.08);
          }
        }
      } else {
        enemy.state = 'idle';
      }
    });
  };

  const updateFloatingText = (state, delta) => {
    state.floatingText.forEach((text) => {
      text.ttl -= delta;
      text.y -= settings.reducedMotion ? 0 : 10 * delta;
    });
    state.floatingText = state.floatingText.filter((text) => text.ttl > 0);
  };

  const handleEnemyDeath = (state, enemy) => {
    state.logs.unshift(buildCombatLogEntry(`${enemy.name} defeated.`));
    gainXp(state.player, enemy.xp);
    const lootSeed = state.seed + state.lootSeedCounter;
    state.lootSeedCounter += 1;
    const drop = rollLoot(lootSeed, enemy.type);
    state.loot.push({
      ...drop,
      x: enemy.x,
      y: enemy.y
    });
    playSound(400, 0.08);
  };

  const checkLootPickup = (state) => {
    state.loot = state.loot.filter((item) => {
      const distance = Math.hypot(item.x - state.player.x, item.y - state.player.y);
      if (distance < 24) {
        const added = addItemToInventory(state.player.inventory, item);
        if (added) {
          playSound(600, 0.05);
          return false;
        }
      }
      return true;
    });
  };

  const checkZoneExit = (state) => {
    const zone = ZONES[state.zoneId];
    const tileX = Math.floor(state.player.x / TILE_SIZE);
    const tileY = Math.floor(state.player.y / TILE_SIZE);
    const exit = zone.exits.find((edge) => edge.x === tileX && edge.y === tileY);
    if (exit) {
      state.zoneStates[state.zoneId] = {
        enemies: state.enemies
      };
      state.zoneId = exit.target;
      if (!state.zoneStates[exit.target]) {
        state.zoneStates[exit.target] = {
          enemies: createZoneEnemies(exit.target)
        };
      }
      state.enemies = state.zoneStates[exit.target].enemies;
      state.player.x = 2 * TILE_SIZE + TILE_SIZE / 2;
      state.player.y = 2 * TILE_SIZE + TILE_SIZE / 2;
      state.logs.unshift(buildCombatLogEntry(`Entered ${ZONES[exit.target].name}.`));
      saveToLocalStorage('autosave', state);
      refreshLocalSaves();
    }
  };

  const drawFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const zone = ZONES[gameRef.current.zoneId];
    zone.map.forEach((row, y) => {
      row.split('').forEach((tile, x) => {
        ctx.fillStyle = tile === '1' ? '#1d1c22' : '#2c2b32';
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        if (tile === '1') {
          ctx.strokeStyle = '#3f3d49';
          ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      });
    });

    gameRef.current.loot.forEach((item) => {
      ctx.fillStyle = '#f6c453';
      ctx.beginPath();
      ctx.arc(item.x, item.y, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    gameRef.current.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      ctx.fillStyle = enemy.type === 'elite' ? '#f15bb5' : '#4cc9f0';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, 10, 0, Math.PI * 2);
      ctx.fill();
    });

    gameRef.current.projectiles.forEach((proj) => {
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    const player = gameRef.current.player;
    ctx.fillStyle = '#f94144';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 12, 0, Math.PI * 2);
    ctx.fill();

    gameRef.current.floatingText.forEach((text) => {
      ctx.fillStyle = text.enemy ? '#ffafcc' : text.crit ? '#ffd60a' : '#f1faee';
      ctx.font = '12px sans-serif';
      ctx.fillText(text.value, text.x + 8, text.y - 8);
    });
  };

  const equippedWeapon = activeState.player.gear.Weapon?.name || 'Fists';
  const xpToNext = GAME_CONFIG.leveling.xpTable[activeState.player.level + 1] ||
    GAME_CONFIG.leveling.xpTable[activeState.player.level];
  const xpProgress = xpToNext ? activeState.player.xp / xpToNext : 1;

  return (
    <div className={`app ${settings.highContrast ? 'high-contrast' : ''}`}>
      <header className="top-bar">
        <div>
          <h1>ARPG v0</h1>
          <p>Seed: {activeState.seed}</p>
        </div>
        <div className="top-actions">
          <button type="button" onClick={() => setScreen('title')}>Title</button>
          <button type="button" onClick={saveGame}>Save</button>
          <button type="button" onClick={resetRun}>New Run</button>
        </div>
      </header>

      {screen === 'title' && (
        <section className="title-screen">
          <h2>Echoes of V0</h2>
          <p>Explore the overworld, gear up, and breach the Ancient Gate.</p>
          <div className="title-actions">
            <button type="button" onClick={resetRun}>Start New Game</button>
            <button type="button" onClick={connectSavesFolder}>Connect Saves Folder</button>
          </div>
          <div className="save-list">
            <h3>Saved Games</h3>
            <div className="save-group">
              <h4>Folder Saves</h4>
              {saveSlots.length === 0 && <p>No save files found.</p>}
              {saveSlots.map((handle) => (
                <button
                  key={handle.name}
                  type="button"
                  onClick={() => loadSave({ handle, name: handle.name })}
                >
                  {handle.name}
                </button>
              ))}
            </div>
            <div className="save-group">
              <h4>Browser Saves</h4>
              {localSaves.length === 0 && <p>No browser saves found.</p>}
              {localSaves.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => loadSave(slot)}
                >
                  {slot.id}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="error">{error}</p>}
        </section>
      )}

      {screen === 'game' && (
        <main className="game-screen">
          <div className="hud">
            <div className="bar">
              <label>HP</label>
              <div className="bar-track">
                <div
                  className="bar-fill hp"
                  style={{ width: `${(activeState.player.hp / playerStats.maxHp) * 100}%` }}
                />
              </div>
              <span>{Math.round(activeState.player.hp)} / {playerStats.maxHp}</span>
            </div>
            <div className="bar">
              <label>XP</label>
              <div className="bar-track">
                <div
                  className="bar-fill xp"
                  style={{ width: `${Math.min(1, xpProgress) * 100}%` }}
                />
              </div>
              <span>Level {activeState.player.level}</span>
            </div>
            <div className="hud-info">
              <p>Zone: {ZONES[activeState.zoneId].name}</p>
              <p>Weapon: {equippedWeapon}</p>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="game-canvas"
            onPointerDown={() => {
              inputRef.current.mouseAttack = true;
            }}
            onPointerUp={() => {
              inputRef.current.mouseAttack = false;
            }}
            onPointerLeave={() => {
              inputRef.current.mouseAttack = false;
            }}
          />

          <aside className="sidebar">
            <h3>Combat Log</h3>
            <ul>
              {activeState.logs.slice(0, 6).map((entry) => (
                <li key={entry.id} className={entry.type}>{entry.message}</li>
              ))}
            </ul>
            {selectedSlot && <p>Loaded: {selectedSlot}</p>}
          </aside>

          <section className={`panel inventory ${showInventory ? 'open' : ''}`}>
            <header>
              <h3>Inventory</h3>
              <button type="button" onClick={() => setShowInventory(false)}>Close</button>
            </header>
            <div className="grid">
              {activeState.player.inventory.map((item, index) => (
                <button
                  key={`slot-${index}`}
                  type="button"
                  className="slot"
                  onClick={() => handleInventoryAction(index)}
                >
                  {item ? (
                    <div>
                      <strong>{item.name}</strong>
                      <p>{item.type} · {item.rarity}</p>
                      {item.quantity && <p>x{item.quantity}</p>}
                      {getItemDelta(item) && (
                        <ul className="delta">
                          {getItemDelta(item).map(([stat, diff]) => (
                            <li key={stat} className={diff >= 0 ? 'positive' : 'negative'}>
                              {stat}: {diff >= 0 ? '+' : ''}{diff.toFixed(2)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <span>Empty</span>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className={`panel character ${showCharacter ? 'open' : ''}`}>
            <header>
              <h3>Character Sheet</h3>
              <button type="button" onClick={() => setShowCharacter(false)}>Close</button>
            </header>
            <div className="stats">
              <p>Damage: {playerStats.damage}</p>
              <p>Defense: {playerStats.defense}</p>
              <p>Speed: {Math.round(playerStats.speed)}</p>
              <p>Crit Chance: {Math.round(playerStats.critChance * 100)}%</p>
            </div>
            <div className="equipment">
              {Object.entries(activeState.player.gear).map(([slot, item]) => (
                <div key={slot} className="gear-slot">
                  <strong>{slot}</strong>
                  <span>{item ? item.name : 'Empty'}</span>
                  {item && (
                    <button type="button" onClick={() => handleUnequip(slot)}>Unequip</button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className={`panel settings ${showSettings ? 'open' : ''}`}>
            <header>
              <h3>Settings</h3>
              <button type="button" onClick={() => setShowSettings(false)}>Close</button>
            </header>
            <label>
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, reducedMotion: event.target.checked }))
                }
              />
              Reduced Motion
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.highContrast}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, highContrast: event.target.checked }))
                }
              />
              High Contrast
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.mute}
                onChange={(event) => setSettings((prev) => ({ ...prev, mute: event.target.checked }))}
              />
              Mute Audio
            </label>
            <div className="controls">
              <h4>Controls</h4>
              {Object.entries(settings.controls).map(([action, key]) => (
                <div key={action} className="control-row">
                  <span>{action}</span>
                  <input
                    type="text"
                    value={key}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        controls: { ...prev.controls, [action]: event.target.value }
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </section>
        </main>
      )}
    </div>
  );
};

export default App;
