export type Rng = {
  seed: number;
  next: () => number;
  nextInt: (min: number, max: number) => number;
};

export const createRng = (seed: number): Rng => {
  let current = seed % 2147483647;
  if (current <= 0) current += 2147483646;
  return {
    seed: current,
    next: () => {
      current = (current * 48271) % 2147483647;
      return (current - 1) / 2147483646;
    },
    nextInt: (min, max) => {
      const value = Math.floor(min + (max - min + 1) * (current / 2147483647));
      current = (current * 48271) % 2147483647;
      return value;
    },
  };
};
