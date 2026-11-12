let sharedAudioCtx: AudioContext | null = null;

export function playSynthesizedClick(freq = 920, gainVal = 0.22): void {
  try {
    if (typeof window === "undefined") return;
    if (!sharedAudioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === "suspended") {
      void sharedAudioCtx.resume();
    }
    const now = sharedAudioCtx.currentTime;
    const osc = sharedAudioCtx.createOscillator();
    const gain = sharedAudioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.45, now + 0.035);
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(sharedAudioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  } catch {
    // Ignore audio context errors prior to user interaction
  }
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || "#38bdf8").replace("#", "");
  const num = Number.parseInt(
    clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean,
    16,
  );
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
