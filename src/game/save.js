const LOCAL_STORAGE_KEY = 'arpg-v0-saves';

export const serializeGameState = (state) => ({
  meta: {
    version: 'v0',
    savedAt: new Date().toISOString(),
    zoneId: state.zoneId,
    seed: state.seed,
    playTimeMs: state.playTimeMs
  },
  player: state.player,
  zoneStates: state.zoneStates,
  enemies: state.enemies,
  loot: state.loot,
  projectiles: state.projectiles
});

export const deserializeGameState = (data) => {
  if (!data?.player || !data?.meta) {
    throw new Error('Save data missing required fields.');
  }
  return {
    zoneId: data.meta.zoneId,
    seed: data.meta.seed,
    player: data.player,
    zoneStates: data.zoneStates || {},
    enemies: data.enemies || [],
    loot: data.loot || [],
    projectiles: data.projectiles || [],
    playTimeMs: data.meta.playTimeMs || 0
  };
};

export const saveToLocalStorage = (slotId, state) => {
  const existing = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
  existing[slotId] = serializeGameState(state);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing));
};

export const loadFromLocalStorage = () => {
  const existing = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
  return Object.entries(existing).map(([id, data]) => ({ id, data }));
};

export const saveToDirectory = async (directoryHandle, filename, state) => {
  const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(serializeGameState(state), null, 2));
  await writable.close();
};

export const listSavesInDirectory = async (directoryHandle) => {
  const saves = [];
  for await (const [name, handle] of directoryHandle.entries()) {
    if (handle.kind === 'file' && name.endsWith('.json')) {
      saves.push({ name, handle });
    }
  }
  return saves;
};

export const loadFromDirectoryHandle = async (fileHandle) => {
  const file = await fileHandle.getFile();
  const text = await file.text();
  const json = JSON.parse(text);
  return deserializeGameState(json);
};
