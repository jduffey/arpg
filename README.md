# ARPG v0 (React + Vite)

A compact browser-based action RPG loop inspired by classic exploration games and loot-driven progression. The v0 build includes a fixed overworld, a harder sub-area, deterministic combat/loot, and local JSON saves.

## Getting Started

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

## How to Play

- **Move:** W/A/S/D
- **Melee:** Space
- **Ranged:** F or left-click on the battlefield
- **Inventory:** I
- **Character Sheet:** C
- **Settings:** Escape

### Core Loop

1. Clear enemies and collect loot drops (gold orbs).
2. Open the inventory (I) to equip upgrades or consume potions.
3. Level up to increase base stats and recover HP.
4. Walk to the glowing exit tiles to travel between the Overworld and Ancient Gate.
5. Save your run from the top bar.

## Save/Load System

This project supports two save mechanisms:

1. **Folder-based JSON saves (recommended):**
   - Create a folder named `public/saves` in the repo (already ignored by Git).
   - On the title screen, click **Connect Saves Folder** and select the `public/saves` folder.
   - Use the **Save** button during play to write a JSON file into that folder.
   - The **Saved Games** list will populate with any `.json` files found there.

2. **Browser storage fallback:**
   - If the File System Access API is not available, saves are stored in `localStorage`.
   - These appear under **Browser Saves** on the title screen.

> **Note:** The File System Access API requires a Chromium-based browser.

## Configuration

Key bindings are editable inside the Settings panel. Tuning levers such as loot rarity, base stats, and enemy tiers live in the config files under `src/game`.

## Build

```bash
npm run build
npm run preview
```
