import { state } from '../core/GameState';
import { BiomeTheme, getActiveBiome } from '../config/biomes';

const SFX_CD: Record<string, number> = {
  rifle: 70, cannon: 105, jet: 340, tap: 85, shield: 300,
  emp: 350, hack: 350, meteor: 160, panic: 2600, frenzy: 400,
  sudden_horn: 800, nuclear_siren: 700, orbital_boom: 400, victory: 500, follow: 200,
};

function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

interface BiomeTrack {
  baseBpm: number;
  leadWave: OscillatorType;
  stringCutoff: number;
  snareSteps: number[];
  timpani: (number | null)[];
  brass: (number | null)[];
  strings: number[][];
}

const BIOME_TRACKS: Record<BiomeTheme['id'], BiomeTrack> = {
  // 1. Bosque Ancestral — Marcha Real en Re menor (Dm -> Bb -> C -> A7)
  grove: {
    baseBpm: 128,
    leadWave: 'sawtooth',
    stringCutoff: 1450,
    snareSteps: [4, 12, 14, 15],
    timpani: [
      38, null, null, 38, null, null, 45, null, 38, null, 38, null, 45, null, 41, null,
      34, null, null, 34, null, null, 41, null, 34, null, 34, null, 41, null, 38, null,
      36, null, null, 36, null, null, 43, null, 36, null, 36, null, 43, null, 40, null,
      33, null, null, 33, null, null, 40, null, 33, null, 37, null, 40, null, 45, null,
    ],
    brass: [
      62, null, null, 65, 69, null, null, null, 74, null, 72, null, 69, null, 65, null,
      70, null, null, 69, 65, null, null, null, 70, null, 72, null, 74, null, null, null,
      72, null, null, 70, 67, null, null, null, 72, null, 74, null, 76, null, 72, null,
      69, null, null, 67, 64, null, 69, null, 73, null, null, null, 76, null, null, null,
    ],
    strings: [
      [50, 57, 62, 65],
      [46, 53, 58, 62],
      [48, 55, 60, 64],
      [45, 52, 57, 61],
    ],
  },

  // 2. Cumbre Glacial — Batalla Nórdica en Mi menor (Em -> C -> D -> B7)
  frost: {
    baseBpm: 122,
    leadWave: 'triangle',
    stringCutoff: 2100,
    snareSteps: [4, 12, 15],
    timpani: [
      40, null, null, 40, null, 47, null, null, 40, null, null, 47, 43, null, 40, null,
      36, null, null, 36, null, 43, null, null, 36, null, null, 43, 40, null, 36, null,
      38, null, null, 38, null, 45, null, null, 38, null, null, 45, 42, null, 38, null,
      35, null, null, 35, null, 42, null, null, 35, null, 39, null, 42, null, 47, null,
    ],
    brass: [
      64, null, 67, null, 71, null, null, null, 76, null, 74, null, 71, null, 67, null,
      72, null, 71, null, 67, null, null, null, 72, null, 74, null, 76, null, null, null,
      74, null, 71, null, 69, null, null, null, 74, null, 76, null, 78, null, 74, null,
      71, null, 69, null, 66, null, 71, null, 75, null, null, null, 76, null, null, null,
    ],
    strings: [
      [52, 59, 64, 67],
      [48, 55, 60, 64],
      [50, 57, 62, 66],
      [47, 54, 59, 63],
    ],
  },

  // 3. Falla Volcánica — Asedio Pesado en Do menor (Cm -> Ab -> Fm -> G7)
  volcano: {
    baseBpm: 136,
    leadWave: 'sawtooth',
    stringCutoff: 1150,
    snareSteps: [4, 10, 12, 14, 15],
    timpani: [
      36, 36, null, 36, null, 43, 36, null, 36, null, 39, null, 43, null, 42, null,
      32, 32, null, 32, null, 39, 32, null, 32, null, 36, null, 39, null, 36, null,
      41, 41, null, 41, null, 44, 41, null, 41, null, 39, null, 36, null, 39, null,
      31, null, 31, null, 38, null, 43, null, 31, 31, 35, null, 38, null, 43, null,
    ],
    brass: [
      60, null, null, 63, 67, null, 66, null, 67, null, null, null, 72, null, 70, null,
      68, null, null, 67, 63, null, null, null, 68, null, 70, null, 72, null, null, null,
      65, null, null, 68, 72, null, null, null, 70, null, 68, null, 67, null, 65, null,
      67, null, 66, null, 67, null, 71, null, 74, null, null, null, 71, null, null, null,
    ],
    strings: [
      [48, 55, 60, 63],
      [44, 51, 56, 60],
      [41, 48, 53, 56],
      [43, 50, 55, 59],
    ],
  },

  // 4. Dunas del Sol — Batalla del Desierto en Re Frigio Dominante (D -> Eb -> Cm -> D)
  desert: {
    baseBpm: 126,
    leadWave: 'square',
    stringCutoff: 1650,
    snareSteps: [4, 7, 12, 14, 15],
    timpani: [
      38, null, 38, null, 45, null, 38, null, 38, null, 39, null, 45, null, 38, null,
      39, null, 39, null, 46, null, 39, null, 39, null, 43, null, 46, null, 43, null,
      36, null, 36, null, 43, null, 36, null, 36, null, 39, null, 43, null, 39, null,
      38, null, 45, null, 38, null, 42, null, 45, null, 46, null, 45, null, 38, null,
    ],
    brass: [
      62, null, 63, null, 66, null, 69, null, 70, null, 69, null, 66, null, 63, null,
      63, null, 67, null, 70, null, null, null, 70, null, 69, null, 67, null, 63, null,
      60, null, 63, null, 67, null, 70, null, 69, null, 67, null, 63, null, 62, null,
      66, null, 69, null, 70, null, 69, null, 66, null, 63, null, 62, null, null, null,
    ],
    strings: [
      [50, 54, 57, 62],
      [51, 55, 58, 63],
      [48, 51, 55, 60],
      [50, 54, 57, 62],
    ],
  },
};

export class SynthEngine {
  private ctx: AudioContext | null = null;
  private musicMasterGain: GainNode | null = null;
  private customAudioEl: HTMLAudioElement | null = null;
  private customMediaNode: MediaElementAudioSourceNode | null = null;
  private customObjectUrl: string | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private seqTimer: ReturnType<typeof setInterval> | null = null;
  private seqStep = 0;
  private nextStepTime = 0;
  private duckTimer: ReturnType<typeof setTimeout> | null = null;
  private isDucked = false;
  private sfxLast: Record<string, number> = {};

  init(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
        this.musicMasterGain = this.ctx.createGain();
        this.musicMasterGain.gain.value = state.audioEnabled && state.musicMode !== 'off' ? state.musicVolume : 0;
        this.musicMasterGain.connect(this.ctx.destination);

        const len = Math.floor(this.ctx.sampleRate * 0.25);
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
    }
    this.checkObsAudioUnlock();
  }

  checkObsAudioUnlock(): void {
    const btn = document.getElementById('obsAudioUnlock');
    if (!btn) return;
    if (!this.ctx || !state.audioEnabled || state.musicMode === 'off') {
      btn.classList.add('hidden');
      return;
    }
    btn.classList.toggle('hidden', this.ctx.state !== 'suspended');
  }

  unlock(): void {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this.checkObsAudioUnlock();
        this.applyMusicMode();
      }).catch(() => {});
    }
  }

  syncVolume(): void {
    if (this.musicMasterGain && this.ctx) {
      const target = state.audioEnabled && state.musicMode !== 'off' ? (this.isDucked ? state.musicVolume * 0.2 : state.musicVolume) : 0;
      this.musicMasterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    }
    if (this.customAudioEl) {
      this.customAudioEl.volume = state.audioEnabled ? state.musicVolume : 0;
    }
  }

  duck(durationMs = 2800): void {
    if (!this.ctx || !this.musicMasterGain || state.musicMode === 'off') return;
    const now = this.ctx.currentTime;
    this.isDucked = true;
    this.musicMasterGain.gain.cancelScheduledValues(now);
    this.musicMasterGain.gain.setTargetAtTime(state.musicVolume * 0.2, now, 0.08);
    if (this.duckTimer) clearTimeout(this.duckTimer);
    this.duckTimer = setTimeout(() => {
      this.isDucked = false;
      this.syncVolume();
    }, durationMs);
  }

  getCurrentBPM(): number {
    const track = BIOME_TRACKS[getActiveBiome().id];
    const base = state.musicMode === 'pulse' ? Math.max(110, track.baseBpm - 10) : track.baseBpm;
    return state.suddenDeathActive ? Math.round(base * 1.18) : base;
  }

  private playRoyalStep(step: number, stepSec: number, t: number): void {
    if (!this.ctx || this.ctx.state !== 'running' || !this.musicMasterGain) return;
    const track = BIOME_TRACKS[getActiveBiome().id];
    const idx = step % 64;
    const bar = Math.floor(idx / 16);
    const beatStep = idx % 16;

    // 1. Timbales épicos (Timpani)
    const timpNote = track.timpani[idx];
    if (timpNote) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const f = midiToFreq(timpNote);
      o.type = 'triangle';
      o.frequency.setValueAtTime(f * 1.18, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.32, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + stepSec * 1.6);
      o.connect(g);
      g.connect(this.musicMasterGain);
      o.start(t);
      o.stop(t + stepSec * 1.65);
    }

    // 2. Cuerdas staccato / Arpegio del bioma
    const chord = track.strings[bar];
    const strNote = chord[idx % chord.length];
    const so = this.ctx.createOscillator();
    const sf = this.ctx.createBiquadFilter();
    const sg = this.ctx.createGain();
    so.type = 'sawtooth';
    so.frequency.setValueAtTime(midiToFreq(strNote), t);
    sf.type = 'lowpass';
    sf.frequency.setValueAtTime(track.stringCutoff, t);
    sf.frequency.exponentialRampToValueAtTime(520, t + stepSec * 0.7);
    sg.gain.setValueAtTime(0.001, t);
    sg.gain.linearRampToValueAtTime(0.075, t + 0.01);
    sg.gain.exponentialRampToValueAtTime(0.001, t + stepSec * 0.78);
    so.connect(sf);
    sf.connect(sg);
    sg.connect(this.musicMasterGain);
    so.start(t);
    so.stop(t + stepSec * 0.8);

    // 3. Fanfarria de Metales / Melodía principal del bioma
    const brassNote = track.brass[idx];
    if (brassNote && state.musicMode !== 'pulse') {
      const b1 = this.ctx.createOscillator();
      const b2 = this.ctx.createOscillator();
      const bf = this.ctx.createBiquadFilter();
      const bg = this.ctx.createGain();
      const freq = midiToFreq(brassNote);
      b1.type = track.leadWave;
      b2.type = 'triangle';
      b1.frequency.setValueAtTime(freq, t);
      b2.frequency.setValueAtTime(freq * 1.005, t);
      bf.type = 'lowpass';
      bf.Q.value = 1.6;
      bf.frequency.setValueAtTime(900, t);
      bf.frequency.linearRampToValueAtTime(2600, t + 0.04);
      bf.frequency.exponentialRampToValueAtTime(1200, t + stepSec * 2.2);
      bg.gain.setValueAtTime(0.001, t);
      bg.gain.linearRampToValueAtTime(0.15, t + 0.025);
      bg.gain.exponentialRampToValueAtTime(0.001, t + stepSec * 2.3);
      b1.connect(bf);
      b2.connect(bf);
      bf.connect(bg);
      bg.connect(this.musicMasterGain);
      b1.start(t);
      b2.start(t);
      b1.stop(t + stepSec * 2.35);
      b2.stop(t + stepSec * 2.35);
    }

    // 4. Tambor de marcha militar del bioma
    if (this.noiseBuffer && track.snareSteps.includes(beatStep)) {
      const sn = this.ctx.createBufferSource();
      sn.buffer = this.noiseBuffer;
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.value = 1750;
      const g = this.ctx.createGain();
      const accent = beatStep === 4 || beatStep === 12 ? 0.16 : 0.08;
      g.gain.setValueAtTime(accent, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
      sn.connect(flt);
      flt.connect(g);
      g.connect(this.musicMasterGain);
      sn.start(t);
      sn.stop(t + 0.09);
    }
  }

  private startSequencer(): void {
    this.stopSequencer();
    this.init();
    if (!this.ctx) return;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.seqTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running' || !state.audioEnabled) return;
      if (state.musicMode === 'off' || state.musicMode === 'mp3') return;
      const bpm = this.getCurrentBPM();
      const bpmBadge = document.getElementById('bpmBadge');
      if (bpmBadge) bpmBadge.textContent = `${bpm} BPM`;
      const stepSec = 60 / bpm / 4;
      while (this.nextStepTime < this.ctx.currentTime + 0.12) {
        this.playRoyalStep(this.seqStep++, stepSec, this.nextStepTime);
        this.nextStepTime += stepSec;
      }
    }, 25);
  }

  private stopSequencer(): void {
    if (this.seqTimer) {
      clearInterval(this.seqTimer);
      this.seqTimer = null;
    }
  }

  applyMusicMode(): void {
    this.init();
    if (this.customAudioEl) {
      try { this.customAudioEl.pause(); } catch {}
    }
    this.stopSequencer();
    this.syncVolume();
    if (!state.audioEnabled || state.musicMode === 'off') return;
    if (state.musicMode === 'mp3') {
      if (this.customAudioEl) this.customAudioEl.play().catch(() => {});
    } else {
      this.startSequencer();
    }
  }

  loadCustomFile(file: File): void {
    this.init();
    if (!this.customAudioEl) {
      this.customAudioEl = new Audio();
      this.customAudioEl.loop = true;
      if (this.ctx && this.musicMasterGain) {
        this.customMediaNode = this.ctx.createMediaElementSource(this.customAudioEl);
        this.customMediaNode.connect(this.musicMasterGain);
      }
    }
    if (this.customObjectUrl) {
      URL.revokeObjectURL(this.customObjectUrl);
    }
    this.customObjectUrl = URL.createObjectURL(file);
    this.customAudioEl.src = this.customObjectUrl;
    state.musicMode = 'mp3';
    this.applyMusicMode();
    const lbl = document.getElementById('musicTrackLabel');
    if (lbl) lbl.textContent = `MP3 activo: ${file.name}`;
  }

  playSFX(type: string): void {
    if (!state.audioEnabled) return;
    const nowMs = performance.now();
    if (nowMs - (this.sfxLast[type] || 0) < (SFX_CD[type] || 80)) return;
    this.sfxLast[type] = nowMs;

    this.init();
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;

    const tone = (freq1: number, freq2: number, dur: number, wave: OscillatorType = 'triangle', vol = 0.14) => {
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = wave;
      o.frequency.setValueAtTime(freq1, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.01);
    };

    switch (type) {
      case 'rifle': tone(520, 180, 0.06, 'square', 0.045); break;
      case 'cannon': tone(140, 38, 0.22, 'sawtooth', 0.16); break;
      case 'jet': tone(420, 1100, 0.28, 'sawtooth', 0.08); break;
      case 'tap': tone(660, 880, 0.07, 'sine', 0.07); break;
      case 'shield': tone(360, 720, 0.3, 'sine', 0.14); break;
      case 'emp': tone(900, 90, 0.35, 'sawtooth', 0.15); break;
      case 'hack': tone(520, 1040, 0.26, 'square', 0.11); break;
      case 'meteor': tone(180, 42, 0.3, 'sawtooth', 0.15); break;
      case 'panic': tone(740, 520, 0.22, 'square', 0.1); break;
      case 'frenzy': tone(440, 880, 0.32, 'triangle', 0.16); break;
      case 'sudden_horn': tone(185, 138, 0.55, 'sawtooth', 0.18); break;
      case 'nuclear_siren': tone(420, 860, 0.5, 'sawtooth', 0.16); break;
      case 'orbital_boom': tone(110, 28, 0.65, 'sawtooth', 0.22); break;
      case 'victory': tone(523, 784, 0.45, 'triangle', 0.18); break;
      case 'follow': tone(587, 880, 0.14, 'sine', 0.09); break;
    }
  }

  speak(text: string): void {
    if (!state.ttsEnabled || !state.audioEnabled || typeof speechSynthesis === 'undefined') return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'es-MX';
      u.rate = 1.1;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {}
  }
}