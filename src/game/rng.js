export const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let result = Math.imul(t ^ (t >>> 15), 1 | t);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
};

export const weightedRoll = (rng, table) => {
  const total = table.reduce((sum, entry) => sum + entry.weight, 0);
  const roll = rng() * total;
  let cursor = 0;
  for (const entry of table) {
    cursor += entry.weight;
    if (roll <= cursor) {
      return entry.rarity;
    }
  }
  return table[table.length - 1].rarity;
};
