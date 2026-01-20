import type { GameState } from './types';
import { deserializeState, serializeState } from './gameLogic';

const STORAGE_KEY = 'arpg-save-v0';

export const saveToLocal = (state: GameState) => {
  const serialized = serializeState(state);
  localStorage.setItem(STORAGE_KEY, serialized);
};

export const loadFromLocal = (): GameState | null => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return deserializeState(raw);
};

export const resetLocalSave = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const saveToDisk = async (state: GameState, name = 'save.json'): Promise<void> => {
  try {
    const payload = { name, data: state };
    await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn('Disk save failed', error);
  }
};

export const loadFromDisk = async (): Promise<GameState | null> => {
  try {
    const response = await fetch('/api/saves');
    if (!response.ok) return null;
    const data = (await response.json()) as { saves: string[] };
    const first = data.saves[0];
    if (!first) return null;
    const saveResponse = await fetch(`/api/save/${first}`);
    if (!saveResponse.ok) return null;
    const raw = await saveResponse.text();
    return deserializeState(raw);
  } catch (error) {
    return null;
  }
};
