# ARPG v0 (React + Vite)

A browser-based action RPG prototype with deterministic combat, seeded loot, and a compact two-zone overworld. The game loop covers exploration, combat, loot, leveling, and persistence.

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Install & Run
```bash
npm install
npm run dev
```
Then open the printed local URL (usually `http://localhost:5173`).

### Build
```bash
npm run build
npm run preview
```

## How to Play

### Controls
- **Move:** `WASD`
- **Melee Attack:** `J`
- **Ranged Attack:** `K`
- **Inventory:** `I`
- **Character Sheet:** `C`
- **Settings:** `O`
- **Save (export JSON):** `P`
- **Load Latest (local storage):** `L`

You can rebind keys from the Settings panel using KeyboardEvent codes (for example, `KeyF`).

### Gameplay Loop
1. Start a new game from the Title screen.
2. Explore the **Sunset Overworld**, defeat enemies, and pick up loot by walking over it.
3. Step on the **E** tile to transition into the **Echo Shrine** (auto-saves on transition).
4. Equip stronger gear, gain XP, and level up to Level 5.
5. If you die, you respawn at the zone entry with 50% HP and a small XP penalty.

### Inventory & Gear
- The inventory is a 20-slot grid.
- Click items to equip, consume, or drop them.
- Compare gear stats against your currently equipped item in the same slot.
- Consumables stack and can be used for healing or temporary speed buffs.

## Save / Load System

The game uses a simple JSON save format:
- **Auto-save**: on zone transitions.
- **Manual save**: the Save button (or `P`) stores state in `localStorage` and downloads a `.json` save file.
- **Load**: Load the latest local save or import a JSON file.

### Ignored Save Folder
A `saves/` folder exists at the repo root and is ignored by Git. Save files should be stored there locally.

**Suggested workflow:**
1. Use **Save + Export JSON** to download a save file.
2. Move the JSON file into the local `saves/` directory.
3. Use **Load from File** and select the JSON from that folder.

## Accessibility
- Keyboard-only navigation via keybinds and focusable UI elements.
- Reduced motion toggle.
- High-contrast theme option.

## Notes
- Loot generation is deterministic per run (seeded RNG).
- Combat resolution is deterministic and uses seeded randomness for crits and loot.
- Audio uses simple synth tones and can be muted globally.
