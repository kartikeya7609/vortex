// Web Audio API Synthesizer for Avengers Puzzle SFX
let audioCtx = null;
let isMuted = false;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export const soundManager = {
  setMuted(muted) {
    isMuted = muted;
    try {
      localStorage.setItem('avengers_sound_muted', muted ? 'true' : 'false');
    } catch {
      // ignore
    }
  },

  getMuted() {
    try {
      return localStorage.getItem('avengers_sound_muted') === 'true';
    } catch {
      return false;
    }
  },

  playClick() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // ignore audio errors
    }
  },

  playGrab() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(640, ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {
      // ignore
    }
  },

  playSnap(isCorrect = false) {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      if (isCorrect) {
        // High-tech lock-in chime
        const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
        freqs.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.03);

          gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.03 + 0.15);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.03);
          osc.stop(ctx.currentTime + i * 0.03 + 0.15);
        });
      } else {
        // Crisp placement snap
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(580, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.08);

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }
    } catch {
      // ignore
    }
  },

  playShuffle() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      for (let i = 0; i < 4; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const startFreq = 200 + Math.random() * 400;
        osc.frequency.setValueAtTime(startFreq, ctx.currentTime + i * 0.04);
        osc.frequency.exponentialRampToValueAtTime(startFreq * 1.5, ctx.currentTime + i * 0.04 + 0.06);

        gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.04 + 0.06);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.04);
        osc.stop(ctx.currentTime + i * 0.04 + 0.06);
      }
    } catch {
      // ignore
    }
  },

  playWin() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      // Heroic victory arpeggio: C4, E4, G4, C5, E5, G5, C6
      const chord = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        
        // Lowpass filter for warm superhero brass synth tone
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1600, ctx.currentTime);

        const startTime = ctx.currentTime + idx * 0.08;
        const duration = 0.5;

        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      });
    } catch {
      // ignore
    }
  },

  playError() {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.setValueAtTime(120, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // ignore
    }
  }
};
