export const keybinds = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  melee: ['KeyJ'],
  ranged: ['KeyK'],
} as const;

export type KeybindAction = keyof typeof keybinds;
