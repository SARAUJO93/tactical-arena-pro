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
  brassWave: OscillatorType;
  brassCutoff: number;
  stringCutoff: number;
  accentKind: 'bell' | 'anvil' | 'darbuka' | 'wood';
  snareSteps: number[];
  hatSteps: number[];
  accentSteps: number[];
  bass: (number | null)[];
  brass: (number | null)[];
  counter: (number | null)[];
  strings: number[][];
}

const BIOME_TRACKS: Record<BiomeTheme['id'], BiomeTrack> = {
  // 1. Bosque Ancestral — Marcha Real Heroica en Re menor (Dm -> Bb -> C -> A7)
  grove: {
    baseBpm: 132,
    brassWave: 'sawtooth',
    brassCutoff: 2450,
    stringCutoff: 1750,
    accentKind: 'wood',
    snareSteps: [4, 12, 14, 15],
    hatSteps: [0, 2, 4, 6, 8, 10, 12, 14],
    accentSteps: [3, 7, 11, 15],
    bass: [
      38, null, null, 38, null, null, 45, null, 38, null, 41, null, 45, null, 41, null,
      34, null, null, 34, null, null, 41, null, 34, null, 38, null, 41, null, 38, null,
      36, null, null, 36, null, null, 43, null, 36, null, 40, null, 43, null, 40, null,
      33, null, null, 33, null, 37, 40, null, 33, null, 37, null, 40, null, 45, null,
    ],
    brass: [
      62, null, null, 65, 69, null, null, 65, 74, null, 72, null, 69, null, 65, null,
      70, null, null, 69, 65, null, null, 62, 70, null, 72, null, 74, null, null, null,
      72, null, null, 70, 67, null, null, 64, 72, null, 74, null, 76, null, 72, null,
      69, null, null, 67, 64, null, 69, null, 73, null, null, 69, 76, null, null, null,
    ],
    counter: [
      null, null, 57, null, null, null, 62, null, null, null, 65, null, null, null, 62, null,
      null, null, 58, null, null, null, 62, null, null, null, 65, null, null, null, 62, null,
      null, null, 60, null, null, null, 64, null, null, null, 67, null, null, null, 64, null,
      null, null, 57, null, null, null, 61, null, null, null, 64, null, null, null, 61, null,
    ],
    strings: [
      [50, 57, 62, 65],
      [46, 53, 58, 62],
      [48, 55, 60, 64],
      [45, 52, 57, 61],
    ],
  },

  // 2. Cumbre Glacial — Asalto Nórdico en Mi menor (Em -> C -> G -> B7)
  frost: {
    baseBpm: 126,
    brassWave: 'sawtooth',
    brassCutoff: 2050,
    stringCutoff: 2250,
    accentKind: 'bell',
    snareSteps: [4, 12, 15],
    hatSteps: [0, 4, 8, 12, 14],
    accentSteps: [0, 6, 10, 14],
    bass: [
      40, null, null, 40, null, 47, null, null, 40, null, 43, null, 47, null, 43, null,
      36, null, null, 36, null, 43, null, null, 36, null, 40, null, 43, null, 40, null,
      43, null, null, 43, null, 38, null, null, 43, null, 47, null, 50, null, 47, null,
      35, null, null, 35, null, 42, null, null, 35, null, 39, null, 42, null, 47, null,
    ],
    brass: [
      64, null, 67, null, 71, null, null, null, 76, null, 74, null, 71, null, 67, null,
      72, null, 71, null, 67, null, null, null, 72, null, 74, null, 76, null, null, null,
      79, null, 76, null, 74, null, null, 71, 74, null, 76, null, 79, null, 74, null,
      71, null, 69, null, 66, null, 71, null, 75, null, null, 71, 76, null, null, null,
    ],
    counter: [
      76, null, null, null, 79, null, 76, null, 83, null, null, null, 79, null, 76, null,
      72, null, null, null, 76, null, 72, null, 79, null, null, null, 76, null, 72, null,
      74, null, null, null, 79, null, 74, null, 83, null, null, null, 79, null, 74, null,
      75, null, null, null, 78, null, 75, null, 83, null, null, null, 78, null, 75, null,
    ],
    strings: [
      [52, 59, 64, 67],
      [48, 55, 60, 64],
      [55, 59, 62, 67],
      [47, 54, 59, 63],
    ],
  },

  // 3. Falla Volcánica — Forja de Obsidiana en Do menor (Cm -> Ab -> Fm -> G7)
  volcano: {
    baseBpm: 140,
    brassWave: 'sawtooth',
    brassCutoff: 1950,
    stringCutoff: 1450,
    accentKind: 'anvil',
    snareSteps: [4, 10, 12, 14, 15],
    hatSteps: [0, 2, 4, 6, 8, 10, 12, 14, 15],
    accentSteps: [2, 6, 10, 14],
    bass: [
      36, 36, null, 36, null, 43, 36, null, 36, null, 39, null, 43, null, 42, null,
      32, 32, null, 32, null, 39, 32, null, 32, null, 36, null, 39, null, 36, null,
      41, 41, null, 41, null, 44, 41, null, 41, null, 39, null, 36, null, 39, null,
      31, null, 31, null, 38, null, 43, null, 31, 31, 35, null, 38, null, 43, null,
    ],
    brass: [
      60, null, null, 63, 67, null, 66, null, 67, null, null, 63, 72, null, 70, null,
      68, null, null, 67, 63, null, null, 60, 68, null, 70, null, 72, null, null, null,
      65, null, null, 68, 72, null, 70, null, 70, null, 68, null, 67, null, 65, null,
      67, null, 66, null, 67, null, 71, null, 74, null, null, 71, 72, null, null, null,
    ],
    counter: [
      48, null, 55, null, 51, null, 55, null, 48, null, 55, null, 54, null, 55, null,
      44, null, 51, null, 48, null, 51, null, 44, null, 51, null, 48, null, 51, null,
      41, null, 48, null, 44, null, 48, null, 41, null, 48, null, 44, null, 48, null,
      43, null, 50, null, 47, null, 50, null, 43, null, 50, null, 55, null, 50, null,
    ],
    strings: [
      [48, 55, 60, 63],
      [44, 51, 56, 60],
      [41, 48, 53, 56],
      [43, 50, 55, 59],
    ],
  },

  // 4. Dunas del Sol — Caravana de Guerra en Re Frigio Dominante (D -> Eb -> Cm -> D)
  desert: {
    baseBpm: 130,
    brassWave: 'sawtooth',
    brassCutoff: 2350,
    stringCutoff: 1900,
    accentKind: 'darbuka',
    snareSteps: [4, 7, 12, 14, 15],
    hatSteps: [0, 3, 6, 8, 11, 14],
    accentSteps: [0, 3, 6, 8, 10, 12, 15],
    bass: [
      38, null, 38, null, 45, null, 38, null, 38, null, 39, null, 45, null, 38, null,
      39, null, 39, null, 46, null, 39, null, 39, null, 43, null, 46, null, 43, null,
      36, null, 36, null, 43, null, 36, null, 36, null, 39, null, 43, null, 39, null,
      38, null, 45, null, 38, null, 42, null, 45, null, 46, null, 45, null, 38, null,
    ],
    brass: [
      62, null, 63, null, 66, null, 69, null, 70, null, 69, null, 66, null, 63, null,
      63, null, 67, null, 70, null, null, 67, 70, null, 69, null, 67, null, 63, null,
      60, null, 63, null, 67, null, 70, null, 69, null, 67, null, 63, null, 62, null,
      66, null, 69, null, 70, null, 69, null, 66, null, 63, null, 62, null, null, null,
    ],
    counter: [
      null, 62, null, 66, null, 69, null, 66, null, 62, null, 66, null, 69, null, 63,
      null, 63, null, 67, null, 70, null, 67, null, 63, null, 67, null, 70, null, 67,
      null, 60, null, 63, null, 67, null, 63, null, 60, null, 63, null, 67, null, 63,
      null, 62, null, 66, null, 69, null, 70, null, 69, null, 66, null, 63, null, 62,
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
  private dryBus: GainNode | null = null;
  private wetBus: GainNode | null = null;
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

        // Compresor master para cohesión y pegada orquestal
        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.value = -16;
        compressor.knee.value = 18;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.005;
        compressor.release.value = 0.14;

        this.musicMasterGain = this.ctx.createGain();
        this.musicMasterGain.gain.value = state.audioEnabled && state.musicMode !== 'off' ? state.musicVolume : 0;

        this.dryBus = this.ctx.createGain();
        this.dryBus.gain.value = 0.82;

        // Reverb procedural de sala de conciertos (ConvolverNode)
        const reverb = this.ctx.createConvolver();
        reverb.buffer = this.createHallImpulse(this.ctx, 1.35, 2.8);
        this.wetBus = this.ctx.createGain();
        this.wetBus.gain.value = 0.34;

        this.dryBus.connect(compressor);
        this.wetBus.connect(reverb);
        reverb.connect(compressor);
        compressor.connect(this.musicMasterGain);
        this.musicMasterGain.connect(this.ctx.destination);

        const len = Math.floor(this.ctx.sampleRate * 0.35);
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
    }
    this.checkObsAudioUnlock();
  }

  private createHallImpulse(ctx: AudioContext, durationSec: number, decay: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * durationSec);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const channelData = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const env = Math.pow(1 - i / length, decay);
        channelData[i] = (Math.random() * 2 - 1) * env * 0.6;
      }
    }
    return impulse;
  }

  private connectToMusicBuses(node: AudioNode, wetAmount = 0.35): void {
    if (!this.ctx || !this.dryBus || !this.wetBus) return;
    node.connect(this.dryBus);
    if (wetAmount > 0) {
      const send = this.ctx.createGain();
      send.gain.value = wetAmount;
      node.connect(send);
      send.connect(this.wetBus);
    }
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
      const target = state.audioEnabled && state.musicMode !== 'off'
        ? (this.isDucked ? state.musicVolume * 0.2 : state.musicVolume)
        : 0;
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
    const base = state.musicMode === 'pulse' ? Math.max(114, track.baseBpm - 10) : track.baseBpm;
    if (state.suddenDeathActive) return Math.round(base * 1.18);
    if (state.frenzyActive) return Math.round(base * 1.07);
    return base;
  }

  private playRoyalStep(step: number, stepSec: number, t: number): void {
    if (!this.ctx || this.ctx.state !== 'running' || !this.dryBus) return;
    const track = BIOME_TRACKS[getActiveBiome().id];
    const idx = step % 64;
    const bar = Math.floor(idx / 16);
    const beatStep = idx % 16;
    const intense = state.suddenDeathActive || state.frenzyActive;

    // 1. Tambores de guerra / Timbales + Sub-bajo orquestal
    const bassNote = track.bass[idx];
    if (bassNote) {
      const f = midiToFreq(bassNote);
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f * 1.45, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.045);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.36, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, t + stepSec * 1.85);
      o.connect(g);
      this.connectToMusicBuses(g, 0.18);
      o.start(t);
      o.stop(t + stepSec * 1.9);

      // Cuerpo grave (sub)
      const sub = this.ctx.createOscillator();
      const sg = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(f * 0.5, t);
      sg.gain.setValueAtTime(0.001, t);
      sg.gain.linearRampToValueAtTime(0.24, t + 0.01);
      sg.gain.exponentialRampToValueAtTime(0.001, t + stepSec * 1.6);
      sub.connect(sg);
      this.connectToMusicBuses(sg, 0.05);
      sub.start(t);
      sub.stop(t + stepSec * 1.65);
    }

    // 2. Cama de cuerdas / Coro suave al inicio de cada compás
    if (beatStep === 0) {
      const chord = track.strings[bar];
      chord.slice(0, 3).forEach((note) => {
        if (!this.ctx) return;
        const pad = this.ctx.createOscillator();
        const pf = this.ctx.createBiquadFilter();
        const pg = this.ctx.createGain();
        pad.type = 'triangle';
        pad.frequency.setValueAtTime(midiToFreq(note), t);
        pf.type = 'lowpass';
        pf.frequency.value = 950;
        pg.gain.setValueAtTime(0.001, t);
        pg.gain.linearRampToValueAtTime(0.045, t + stepSec * 2.5);
        pg.gain.setValueAtTime(0.04, t + stepSec * 12);
        pg.gain.exponentialRampToValueAtTime(0.001, t + stepSec * 15.8);
        pad.connect(pf);
        pf.connect(pg);
        this.connectToMusicBuses(pg, 0.65);
        pad.start(t);
        pad.stop(t + stepSec * 16);
      });
    }

    // 3. Cuerdas Spiccato (ensamble con ligero detune para ancho orquestal)
    const chord = track.strings[bar];
    const strNote = chord[idx % chord.length];
    const s1 = this.ctx.createOscillator();
    const s2 = this.ctx.createOscillator();
    const sf = this.ctx.createBiquadFilter();
    const sg = this.ctx.createGain();
    const sFreq = midiToFreq(strNote);
    s1.type = 'sawtooth';
    s2.type = 'sawtooth';
    s1.frequency.setValueAtTime(sFreq * 0.996, t);
    s2.frequency.setValueAtTime(sFreq * 1.004, t);
    sf.type = 'lowpass';
    sf.Q.value = 1.2;
    sf.frequency.setValueAtTime(intense ? track.stringCutoff * 1.22 : track.stringCutoff, t);
    sf.frequency.exponentialRampToValueAtTime(520, t + stepSec * 0.72);
    sg.gain.setValueAtTime(0.001, t);
    sg.gain.linearRampToValueAtTime(0.055, t + 0.009);
    sg.gain.exponentialRampToValueAtTime(0.001, t + stepSec * 0.78);
    s1.connect(sf);
    s2.connect(sf);
    sf.connect(sg);
    this.connectToMusicBuses(sg, 0.42);
    s1.start(t);
    s2.start(t);
    s1.stop(t + stepSec * 0.82);
    s2.stop(t + stepSec * 0.82);

    // 4. Sección de Metales Heroicos (3 voces con swell de filtro tipo trompa/trompeta)
    const brassNote = track.brass[idx];
    if (brassNote && state.musicMode !== 'pulse') {
      const b1 = this.ctx.createOscillator();
      const b2 = this.ctx.createOscillator();
      const bSub = this.ctx.createOscillator();
      const bf = this.ctx.createBiquadFilter();
      const bg = this.ctx.createGain();
      const freq = midiToFreq(brassNote);

      b1.type = track.brassWave;
      b2.type = track.brassWave;
      bSub.type = 'triangle';
      b1.frequency.setValueAtTime(freq * 0.997, t);
      b2.frequency.setValueAtTime(freq * 1.003, t);
      bSub.frequency.setValueAtTime(freq * 0.5, t);

      bf.type = 'lowpass';
      bf.Q.value = 2.0;
      bf.frequency.setValueAtTime(720, t);
      bf.frequency.linearRampToValueAtTime(intense ? track.brassCutoff * 1.18 : track.brassCutoff, t + 0.055);
      bf.frequency.exponentialRampToValueAtTime(1050, t + stepSec * 2.3);

      bg.gain.setValueAtTime(0.001, t);
      bg.gain.linearRampToValueAtTime(0.115, t + 0.032);
      bg.gain.setValueAtTime(0.095, t + stepSec * 1.2);
      bg.gain.exponentialRampToValueAtTime(0.001, t + stepSec * 2.45);

      b1.connect(bf);
      b2.connect(bf);
      bSub.connect(bf);
      bf.connect(bg);
      this.connectToMusicBuses(bg, 0.55);

      b1.start(t);
      b2.start(t);
      bSub.start(t);
      b1.stop(t + stepSec * 2.5);
      b2.stop(t + stepSec * 2.5);
      bSub.stop(t + stepSec * 2.5);
    }

    // 5. Contramelodía / Detalle característico del bioma
    const counterNote = track.counter[idx];
    if (counterNote && state.musicMode !== 'pulse') {
      const co = this.ctx.createOscillator();
      const cg = this.ctx.createGain();
      co.type = track.accentKind === 'bell' ? 'sine' : 'triangle';
      co.frequency.setValueAtTime(midiToFreq(counterNote), t);
      cg.gain.setValueAtTime(0.001, t);
      cg.gain.linearRampToValueAtTime(track.accentKind === 'bell' ? 0.085 : 0.06, t + 0.008);
      cg.gain.exponentialRampToValueAtTime(0.001, t + stepSec * (track.accentKind === 'bell' ? 1.9 : 1.1));
      co.connect(cg);
      this.connectToMusicBuses(cg, 0.6);
      co.start(t);
      co.stop(t + stepSec * 2.0);
    }

    // 6. Percusión táctica (redoble militar, platillos y acento del bioma)
    if (this.noiseBuffer) {
      if (track.snareSteps.includes(beatStep) || (state.suddenDeathActive && beatStep === 10)) {
        const sn = this.ctx.createBufferSource();
        sn.buffer = this.noiseBuffer;
        const flt = this.ctx.createBiquadFilter();
        flt.type = 'bandpass';
        flt.frequency.value = 1850;
        flt.Q.value = 0.9;
        const g = this.ctx.createGain();
        const accent = beatStep === 4 || beatStep === 12 ? 0.17 : 0.085;
        g.gain.setValueAtTime(accent, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
        sn.connect(flt);
        flt.connect(g);
        this.connectToMusicBuses(g, 0.35);
        sn.start(t);
        sn.stop(t + 0.1);
      }

      if (track.hatSteps.includes(beatStep)) {
        const hh = this.ctx.createBufferSource();
        hh.buffer = this.noiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = idx === 0 ? 4500 : 7200;
        const hg = this.ctx.createGain();
        const isCrash = idx === 0 || (intense && idx === 32);
        hg.gain.setValueAtTime(isCrash ? 0.14 : 0.035, t);
        hg.gain.exponentialRampToValueAtTime(0.001, t + (isCrash ? 0.32 : 0.035));
        hh.connect(hp);
        hp.connect(hg);
        this.connectToMusicBuses(hg, isCrash ? 0.65 : 0.15);
        hh.start(t);
        hh.stop(t + (isCrash ? 0.34 : 0.04));
      }
    }

    // Percusión de color única por bioma (yunque, darbuka, madera)
    if (track.accentSteps.includes(beatStep) && track.accentKind !== 'bell') {
      const ao = this.ctx.createOscillator();
      const ag = this.ctx.createGain();
      if (track.accentKind === 'anvil') {
        ao.type = 'square';
        ao.frequency.setValueAtTime(880, t);
        ao.frequency.exponentialRampToValueAtTime(520, t + 0.07);
        ag.gain.setValueAtTime(0.045, t);
        ag.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      } else if (track.accentKind === 'darbuka') {
        ao.type = 'sine';
        ao.frequency.setValueAtTime(beatStep % 2 === 0 ? 290 : 440, t);
        ao.frequency.exponentialRampToValueAtTime(140, t + 0.06);
        ag.gain.setValueAtTime(0.09, t);
        ag.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
      } else {
        ao.type = 'triangle';
        ao.frequency.setValueAtTime(620, t);
        ao.frequency.exponentialRampToValueAtTime(340, t + 0.04);
        ag.gain.setValueAtTime(0.055, t);
        ag.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      }
      ao.connect(ag);
      this.connectToMusicBuses(ag, 0.3);
      ao.start(t);
      ao.stop(t + 0.1);
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