# Browser ARPG v0

A compact, deterministic, Zelda-like action RPG loop built with React + Vite. Explore a two-zone map, fight enemies, collect loot, level up, and save/load runs.

## Quick Start

```bash
npm install
npm run dev
```

Open the local dev URL printed by Vite (usually <http://localhost:5173>).

## How to Play

- **Move:** WASD or Arrow keys
- **Melee attack:** Space
- **Ranged attack:** F
- **Inventory:** I
- **Character sheet:** C
- **Save:** P
- **Load:** L
- **Reset run:** R
- **Mute:** M
- **Reduce motion:** O
- **High contrast:** H

### Core Loop
1. Move through the overworld, defeat enemies, and collect loot.
2. Click items in the inventory to equip or consume them.
3. Reach the glowing exit to enter the sub-area (and auto-save on zone exit).
4. Level up to increase base stats and keep pushing deeper.

## Save/Load System

The game uses JSON save files. There are two supported save sources:

1. **Local saves (default):**
   - Click **Save** or press **P** to write a save to `localStorage`.
   - Click **Load** or press **L** to restore a local save.

2. **Folder saves (ignored in Git):**
   - Create a `saves/` folder in the repository root (it is ignored by `.gitignore`).
   - Place JSON save files in `saves/`.
   - Add a `saves/index.json` manifest pointing to each file so the game can list them:

```json
[
  { "id": "demo-1", "label": "Demo Save", "file": "demo-save.json" }
]
```

   - The Load menu will show entries labeled as **Folder** when it finds `saves/index.json`.

### Exporting Saves

Use **Export JSON** to download a save file. Move the downloaded file into `saves/` and add it to `saves/index.json` if you want it to appear in the Folder list.

## Development Notes

- Built with React + Vite.
- Deterministic RNG seeded per run for combat and loot rolls.
- All state is serialized to JSON for persistence.
