export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const distance = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
};

export const normalize = (x, y) => {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
};

export const formatPercent = (value) => `${Math.round(value * 100)}%`;

export const uuid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const safeParseJson = (json) => {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.error('Failed to parse JSON', error);
    return null;
  }
};
