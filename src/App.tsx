import { useCallback, useEffect, useRef, useState } from 'react';
import './styles.css';
import { TILE_SIZE, zoneMaps, zoneExitTiles, xpCurve } from './game/data';
import {
  checkZoneExit,
  createNewGame,
  equipItem,
  getDamageLabel,
  getStatTotal,
  pruneFloatingText,
  recalcGear,
  resolveMeleeAttack,
  resolveRangedAttack,
  tickEnemies,
  tickProjectiles,
  tryMove,
  useConsumable,
} from './game/gameLogic';
import type { GameState, InventorySlot, ZoneId } from './game/types';
import { loadFromDisk, loadFromLocal, resetLocalSave, saveToDisk, saveToLocal } from './game/save';
import { playSound } from './game/audio';
import { keybinds } from './game/config';

const screenList = ['game', 'inventory', 'character', 'settings'] as const;

type Screen = 'title' | (typeof screenList)[number];

type InputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  melee: boolean;
  ranged: boolean;
};

const emptyInput: InputState = { up: false, down: false, left: false, right: false, melee: false, ranged: false };

const statLabel = (value: number, base: number) => {
  const delta = value - base;
  if (delta === 0) return `${value}`;
  return `${value} (${delta >= 0 ? '+' : ''}${delta.toFixed(2)})`;
};

const InventorySlotCard = ({ slot, onEquip, onUse }: { slot: InventorySlot; onEquip: () => void; onUse: () => void }) => {
  if (!slot.item) {
    return <div className="slot empty">Empty</div>;
  }
  return (
    <div className={`slot filled rarity-${slot.item.rarity}`}>
      <div className="slot-name">{slot.item.name}</div>
      <div className="slot-type">{slot.item.type}</div>
      <div className="slot-affixes">
        +{slot.item.affixes.damage} Dmg, +{slot.item.affixes.hp} HP
      </div>
      <div className="slot-affixes">
        +{slot.item.affixes.defense} Def, +{slot.item.affixes.speed} Spd
      </div>
      {slot.quantity > 1 && <div className="slot-qty">x{slot.quantity}</div>}
      <div className="slot-actions">
        {slot.item.type === 'consumable' ? (
          <button type="button" onClick={onUse}>
            Use
          </button>
        ) : (
          <button type="button" onClick={onEquip}>
            Equip
          </button>
        )}
      </div>
    </div>
  );
};

const MapView = ({ state }: { state: GameState }) => {
  const map = zoneMaps[state.player.zoneId];
  const zoneExit = zoneExitTiles[state.player.zoneId];
  return (
    <div className="map" style={{ width: map[0].length * TILE_SIZE, height: map.length * TILE_SIZE }}>
      {map.map((row, y) =>
        row.split('').map((cell, x) => {
          const isExit = zoneExit && zoneExit.x === x && zoneExit.y === y;
          return (
            <div
              key={`${x}-${y}`}
              className={`tile ${cell === '1' ? 'wall' : 'floor'} ${isExit ? 'exit' : ''}`}
              style={{ width: TILE_SIZE, height: TILE_SIZE, left: x * TILE_SIZE, top: y * TILE_SIZE }}
            />
          );
        })
      )}
      {state.zones[state.player.zoneId].enemies.map((enemy) => (
        <div
          key={enemy.id}
          className={`entity enemy ${enemy.hp <= 0 ? 'dead' : ''} ${enemy.type}`}
          style={{ left: enemy.x * TILE_SIZE, top: enemy.y * TILE_SIZE }}
          title={getDamageLabel(enemy)}
        />
      ))}
      {state.projectiles.map((projectile) => (
        <div
          key={projectile.id}
          className="entity projectile"
          style={{ left: projectile.x * TILE_SIZE, top: projectile.y * TILE_SIZE }}
        />
      ))}
      {state.floatingText.map((text) => (
        <div
          key={text.id}
          className="floating"
          style={{ left: text.x * TILE_SIZE, top: text.y * TILE_SIZE }}
        >
          {text.value}
        </div>
      ))}
      <div
        className="entity player"
        style={{ left: state.player.x * TILE_SIZE, top: state.player.y * TILE_SIZE }}
      />
    </div>
  );
};

const Controls = () => (
  <div className="controls">
    <h3>Controls</h3>
    <ul>
      <li>Move: WASD / Arrow Keys</li>
      <li>Melee: J</li>
      <li>Ranged: K</li>
      <li>Inventory/Character/Settings: Tab buttons</li>
    </ul>
  </div>
);

const TitleScreen = ({ onNew, onLoad }: { onNew: () => void; onLoad: () => void }) => (
  <div className="title-screen">
    <h1>ARPG v0</h1>
    <p>Explore a compact overworld, defeat foes, and gear up for the sub-area.</p>
    <div className="title-actions">
      <button type="button" onClick={onNew}>
        Start New Game
      </button>
      <button type="button" onClick={onLoad}>
        Load Game
      </button>
    </div>
  </div>
);

const zoneLabel: Record<ZoneId, string> = {
  overworld: 'Overworld',
  subarea: 'Sub-Area',
};

function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [state, setState] = useState<GameState | null>(null);
  const inputRef = useRef<InputState>({ ...emptyInput });
  const lastTick = useRef<number | null>(null);
  const lastInventoryCount = useRef<number>(0);
  const lastHp = useRef<number>(0);

  const startNew = () => {
    const newState = createNewGame();
    setState(newState);
    setScreen('game');
    saveToLocal(newState);
  };

  const loadGame = useCallback(async () => {
    const local = loadFromLocal();
    if (local) {
      setState(recalcGear(local));
      setScreen('game');
      return;
    }
    const disk = await loadFromDisk();
    if (disk) {
      setState(recalcGear(disk));
      setScreen('game');
      return;
    }
    alert('No save found. Start a new game!');
  }, []);

  useEffect(() => {
    const bindLookup = Object.entries(keybinds).reduce<Record<string, keyof typeof keybinds>>((acc, [action, keys]) => {
      keys.forEach((key) => {
        acc[key] = action as keyof typeof keybinds;
      });
      return acc;
    }, {});
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const action = bindLookup[event.code];
      if (action) {
        inputRef.current[action] = true;
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      const action = bindLookup[event.code];
      if (action && action !== 'melee' && action !== 'ranged') {
        inputRef.current[action] = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const hasState = Boolean(state);

  useEffect(() => {
    if (!hasState) return;
    let frameId = 0;
    const loop = (timestamp: number) => {
      if (!lastTick.current) lastTick.current = timestamp;
      const deltaMs = timestamp - lastTick.current;
      const delta = Math.min(deltaMs / 1000, 0.05);
      lastTick.current = timestamp;
      setState((current) => {
        if (!current) return current;
        const input = inputRef.current;
        const dirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        const dirY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
        let normalizedX = dirX;
        let normalizedY = dirY;
        if (dirX !== 0 && dirY !== 0) {
          const scale = 1 / Math.sqrt(2);
          normalizedX *= scale;
          normalizedY *= scale;
        }
        let nextState = tryMove(current, normalizedX * delta, normalizedY * delta);
        if (input.melee) {
          nextState = resolveMeleeAttack(nextState, timestamp);
          input.melee = false;
          playSound('hit', nextState.muted);
        }
        if (input.ranged) {
          nextState = resolveRangedAttack(nextState, timestamp);
          input.ranged = false;
        }
        nextState = tickProjectiles(nextState, delta);
        nextState = tickEnemies(nextState, timestamp, delta);
        nextState = checkZoneExit(nextState, timestamp);
        nextState = pruneFloatingText(nextState, timestamp);
        return nextState;
      });
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [hasState]);

  useEffect(() => {
    if (!state) return;
    const inventoryCount = state.player.inventory.filter((slot) => slot.item).length;
    if (inventoryCount > lastInventoryCount.current) {
      playSound('pickup', state.muted);
    }
    lastInventoryCount.current = inventoryCount;
  }, [state]);

  useEffect(() => {
    if (!state) return;
    if (lastHp.current > 0 && state.player.hp === 0) {
      playSound('death', state.muted);
    }
    lastHp.current = state.player.hp;
  }, [state]);

  useEffect(() => {
    if (!state) return;
    saveToLocal(state);
  }, [state?.lastZoneExitAt]);

  if (!state) {
    return (
      <div className="app">
        <TitleScreen onNew={startNew} onLoad={loadGame} />
      </div>
    );
  }

  const stats = getStatTotal(state.player);
  const xpToNext = state.player.level < 5 ? xpCurveLabel(state.player.level) : 'Max';

  const handleEquip = (index: number) => setState((current) => (current ? equipItem(current, index) : current));
  const handleUse = (index: number) => setState((current) => (current ? useConsumable(current, index) : current));

  const handleSave = async () => {
    saveToLocal(state);
    await saveToDisk(state, 'save.json');
    alert('Saved to local storage and /saves/save.json (dev server).');
  };

  const handleReset = () => {
    resetLocalSave();
    setState(null);
    setScreen('title');
  };

  return (
    <div className={`app ${state.highContrast ? 'high-contrast' : ''} ${state.reducedMotion ? 'reduced-motion' : ''}`}>
      <header>
        <div>
          <h2>ARPG v0</h2>
          <p>{zoneLabel[state.player.zoneId]}</p>
        </div>
        <div className="header-actions">
          {screenList.map((screenName) => (
            <button
              key={screenName}
              type="button"
              className={screen === screenName ? 'active' : ''}
              onClick={() => setScreen(screenName)}
            >
              {screenName}
            </button>
          ))}
        </div>
      </header>

      <main>
        <section className="game-panel">
          <div className="hud">
            <div className="bar">
              <span>HP</span>
              <progress value={state.player.hp} max={stats.maxHp} />
              <span>
                {Math.round(state.player.hp)} / {stats.maxHp}
              </span>
            </div>
            <div className="bar">
              <span>XP</span>
              <progress value={state.player.xp} max={state.player.level < 5 ? xpCurveValue(state.player.level) : 1} />
              <span>{xpToNext}</span>
            </div>
            <div className="hud-info">
              <span>Level {state.player.level}</span>
              <span>Weapon: {state.player.equipped.weapon?.name ?? 'None'}</span>
            </div>
          </div>
          <MapView state={state} />
        </section>

        <section className="side-panel">
          {screen === 'game' && (
            <div className="panel-content">
              <h3>Adventure Log</h3>
              <p>Explore the zone and reach the glowing tile to transition.</p>
              <div className="log-grid">
                {state.zones[state.player.zoneId].enemies.map((enemy) => (
                  <div key={enemy.id} className={`enemy-card ${enemy.type}`}>
                    <h4>{enemy.type}</h4>
                    <p>
                      HP {enemy.hp}/{enemy.maxHp}
                    </p>
                  </div>
                ))}
              </div>
              <Controls />
            </div>
          )}

          {screen === 'inventory' && (
            <div className="panel-content">
              <h3>Inventory</h3>
              <div className="inventory-grid">
                {state.player.inventory.map((slot, index) => (
                  <InventorySlotCard
                    key={`slot-${index}`}
                    slot={slot}
                    onEquip={() => handleEquip(index)}
                    onUse={() => handleUse(index)}
                  />
                ))}
              </div>
            </div>
          )}

          {screen === 'character' && (
            <div className="panel-content">
              <h3>Character Sheet</h3>
              <div className="stats-grid">
                <div>
                  <strong>HP</strong>
                  <span>{statLabel(stats.maxHp, state.player.baseStats.maxHp)}</span>
                </div>
                <div>
                  <strong>Damage</strong>
                  <span>{statLabel(stats.damage, state.player.baseStats.damage)}</span>
                </div>
                <div>
                  <strong>Defense</strong>
                  <span>{statLabel(stats.defense, state.player.baseStats.defense)}</span>
                </div>
                <div>
                  <strong>Speed</strong>
                  <span>{statLabel(stats.speed, state.player.baseStats.speed)}</span>
                </div>
                <div>
                  <strong>Crit Chance</strong>
                  <span>{(stats.critChance * 100).toFixed(1)}%</span>
                </div>
              </div>
              <div className="equipped">
                <h4>Equipped</h4>
                <p>Weapon: {state.player.equipped.weapon?.name ?? 'None'}</p>
                <p>Armor: {state.player.equipped.armor?.name ?? 'None'}</p>
                <p>Accessory: {state.player.equipped.accessory?.name ?? 'None'}</p>
              </div>
            </div>
          )}

          {screen === 'settings' && (
            <div className="panel-content">
              <h3>Settings</h3>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={state.muted}
                  onChange={() => setState((current) => (current ? { ...current, muted: !current.muted } : current))}
                />
                Mute audio
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={state.reducedMotion}
                  onChange={() => setState((current) => (current ? { ...current, reducedMotion: !current.reducedMotion } : current))}
                />
                Reduced motion
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={state.highContrast}
                  onChange={() => setState((current) => (current ? { ...current, highContrast: !current.highContrast } : current))}
                />
                High contrast
              </label>
              <div className="settings-actions">
                <button type="button" onClick={handleSave}>
                  Save Game
                </button>
                <button type="button" onClick={loadGame}>
                  Load Game
                </button>
                <button type="button" onClick={handleReset}>
                  Reset Save
                </button>
              </div>
              <p className="hint">Saving on zone exit happens automatically.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const xpCurveValue = (level: number) => (level < 5 ? xpCurve[level] : 1);
const xpCurveLabel = (level: number) => (level < 5 ? `${xpCurveValue(level)} XP to next` : 'Max');

export default App;
