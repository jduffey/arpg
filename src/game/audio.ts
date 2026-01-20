export type SoundType = 'hit' | 'pickup' | 'death';

let audioContext: AudioContext | null = null;

const getContext = () => {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
};

export const playSound = (type: SoundType, muted: boolean) => {
  if (muted) return;
  try {
    const context = getContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = type === 'hit' ? 220 : type === 'pickup' ? 520 : 140;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  } catch (error) {
    console.error('Audio error', error);
  }
};
