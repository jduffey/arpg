# ARPG v0 (Browser-based Action RPG)

A compact, deterministic action RPG loop built with React + Vite. Explore an overworld and a sub-area, fight enemies, collect loot, level up, and save your progress.

## Getting Started

### Install

```bash
npm install
```

### Run the Game

```bash
npm run dev
```

Open the URL shown by Vite (usually `http://localhost:5173`).

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## How to Play

### Core Loop

1. Start a new game from the title screen.
2. Move around the overworld and defeat enemies.
3. Pick up loot (added to your inventory automatically).
4. Equip gear from the Inventory tab to improve stats.
5. Step onto the glowing tile to transition zones.
6. Save happens automatically on zone exit.

### Controls

- **Move:** WASD / Arrow Keys
- **Melee Attack:** J
- **Ranged Attack:** K
- **Tabs:** Use the buttons at the top right to open Game / Inventory / Character / Settings panels.

You can rebind keys in `src/game/config.ts`.

### UI Panels

- **Game:** Enemy roster and control reminders.
- **Inventory:** 20-slot grid, consumables stack, equip items directly.
- **Character:** Stat summary with deltas from gear.
- **Settings:** Mute audio, reduced motion, high-contrast, save/load/reset.

## Save / Load

The game uses **JSON-based saves** in two layers:

1. **Local Storage (primary):** Automatic save on zone exit and manual save via Settings.
2. **Disk Saves (dev server only):** Manual save writes to `saves/save.json` via the Vite dev server middleware. The `saves/` directory is gitignored for safe local iteration.

### Save Folder

- Save files are written to the ignored folder `saves/`.
- The game looks for disk saves via the `/api/saves` endpoint exposed by the dev server.
- In production builds, only Local Storage is used.

> Tip: You can reset all local saves via the **Reset Save** button in Settings.

## Accessibility

- Keyboard-only navigation supported.
- Reduced motion toggle.
- High-contrast palette toggle.

## Project Structure

- `src/game`: Core logic (combat, loot, XP, save/load)
- `src/App.tsx`: UI and game loop
- `saves/`: Ignored save data (dev server only)

## Notes

- Loot rolls are deterministic based on a seed per run.
- Enemies are respawned per zone entry with deterministic seeds.
