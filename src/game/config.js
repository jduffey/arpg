export const GAME_CONFIG = {
  canvas: {
    width: 640,
    height: 360,
    tileSize: 32
  },
  controls: {
    moveUp: 'KeyW',
    moveDown: 'KeyS',
    moveLeft: 'KeyA',
    moveRight: 'KeyD',
    melee: 'Space',
    ranged: 'KeyF',
    inventory: 'KeyI',
    character: 'KeyC',
    settings: 'Escape'
  },
  player: {
    base: {
      maxHp: 100,
      damage: 10,
      defense: 2,
      speed: 120,
      critChance: 0.05
    }
  },
  combat: {
    meleeCooldownMs: 350,
    rangedCooldownMs: 900,
    projectileSpeed: 260,
    critMultiplier: 1.5
  },
  leveling: {
    maxLevel: 5,
    xpTable: [0, 0, 40, 90, 150, 230],
    hpRestoreOnLevel: 0.2
  },
  loot: {
    rarityRolls: [
      { rarity: 'Common', weight: 70 },
      { rarity: 'Uncommon', weight: 20 },
      { rarity: 'Rare', weight: 9 },
      { rarity: 'Epic', weight: 1 }
    ],
    affixRanges: {
      Common: { min: 1, max: 2 },
      Uncommon: { min: 2, max: 4 },
      Rare: { min: 4, max: 7 },
      Epic: { min: 6, max: 10 }
    }
  },
  zones: {
    overworld: 'overworld',
    subArea: 'sub-area'
  }
};

export const UI_CONFIG = {
  reducedMotion: false,
  highContrast: false
};
