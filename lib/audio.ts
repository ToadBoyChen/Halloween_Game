"use client";

// All hub sounds are synthesised with the Web Audio API, so there are no files to ship.

class Haunt {
  ctx: AudioContext | null = null;
  master!: GainNode;
  heartTimer: ReturnType<typeof setTimeout> | null = null;
  heartRate = 0; // beats per minute, 0 = off
  sirenStop: (() => void) | null = null;

  // Must be called from a tap/click (browsers block audio until then).
  // There's no ambient sound: only event sounds and the Blood Moon.
  awaken() {
    if (this.ctx) {
      this.ctx.resume().catch(() => {});
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);
  }

  // The Blood Moon: a deep gong, a wolf howl, and a rising choir.
  bloodMoon() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // gong
    for (const [f, amp, decay] of [[55, 0.7, 6], [82.5, 0.35, 4.5], [131, 0.2, 3], [196, 0.12, 2.2]]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + decay + 0.1);
    }
    this.thump(t, 1.4);
    // wolf howl: glide up, hold with vibrato, fall away
    const howl = (start: number, base: number, vol: number) => {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(base * 0.55, start);
      o.frequency.exponentialRampToValueAtTime(base, start + 0.7);
      o.frequency.setValueAtTime(base, start + 1.9);
      o.frequency.exponentialRampToValueAtTime(base * 0.62, start + 3.2);
      const vib = ctx.createOscillator();
      vib.frequency.value = 5.5;
      const vg = ctx.createGain();
      vg.gain.value = base * 0.025;
      vib.connect(vg).connect(o.frequency);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 1800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(vol, start + 0.5);
      g.gain.setValueAtTime(vol, start + 2.2);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 3.4);
      o.connect(f).connect(g).connect(this.master);
      o.start(start);
      vib.start(start);
      o.stop(start + 3.5);
      vib.stop(start + 3.5);
    };
    howl(t + 0.6, 620, 0.22);
    howl(t + 1.1, 780, 0.1);
    // choir swelling up underneath
    const choir = ctx.createBiquadFilter();
    choir.type = "lowpass";
    choir.frequency.setValueAtTime(300, t);
    choir.frequency.exponentialRampToValueAtTime(2400, t + 3.5);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0, t);
    cg.gain.linearRampToValueAtTime(0.06, t + 2.5);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
    choir.connect(cg).connect(this.master);
    for (const f of [220, 261.6, 311.1, 440, 523.3]) {
      for (const d of [-8, 8]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        o.detune.value = d;
        o.connect(choir);
        o.start(t);
        o.stop(t + 5.6);
      }
    }
  }

  // The danger has passed (Blood Moon stopped / Mortals win).
  relief() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const g = ctx.createGain();
      const st = t + i * 0.18;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.12, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 2.2);
      o.connect(g).connect(this.master);
      o.start(st);
      o.stop(st + 2.3);
    });
  }

  // A single toll (voting begins).
  toll() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (const [ratio, amp] of [[1, 0.4], [2.01, 0.2], [2.76, 0.15], [0.5, 0.3]]) {
      const o = ctx.createOscillator();
      o.frequency.value = 262 * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp * 0.6, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 2.6);
    }
  }

  // A deep double knell (someone reported their own death).
  knell() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (const [at, base] of [[0, 147], [1.2, 131]]) {
      for (const [ratio, amp] of [[1, 0.45], [2.01, 0.18], [2.76, 0.12], [0.5, 0.35]]) {
        const o = ctx.createOscillator();
        o.frequency.value = base * ratio;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t + at);
        g.gain.linearRampToValueAtTime(amp * 0.7, t + at + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + at + 3);
        o.connect(g).connect(this.master);
        o.start(t + at);
        o.stop(t + at + 3.1);
      }
    }
    this.thump(t, 0.8);
  }

  private noiseBuffer(seconds = 2) {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  bell() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (let strike = 0; strike < 3; strike++) {
      const st = t + strike * 1.6;
      for (const [ratio, amp] of [[1, 0.5], [2.01, 0.3], [2.76, 0.22], [5.4, 0.1], [0.5, 0.35]]) {
        const o = ctx.createOscillator();
        o.frequency.value = 196 * ratio;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, st);
        g.gain.linearRampToValueAtTime(amp * 0.6, st + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 4);
        o.connect(g).connect(this.master);
        o.start(st);
        o.stop(st + 4.1);
      }
    }
  }

  private thump(at: number, vol = 1) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(70, at);
    o.frequency.exponentialRampToValueAtTime(35, at + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.9 * vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.25);
    o.connect(g).connect(this.master);
    o.start(at);
    o.stop(at + 0.3);
  }

  setHeartbeat(bpm: number) {
    if (!this.ctx) return;
    const was = this.heartRate;
    this.heartRate = bpm;
    if (bpm && !was) this.beat();
    if (!bpm && this.heartTimer) {
      clearTimeout(this.heartTimer);
      this.heartTimer = null;
    }
  }

  private beat = () => {
    if (!this.ctx || !this.heartRate) return;
    const t = this.ctx.currentTime;
    this.thump(t, 0.8);
    this.thump(t + 0.22, 0.55);
    this.heartTimer = setTimeout(this.beat, 60000 / this.heartRate);
  };

  siren(on: boolean) {
    if (!this.ctx) return;
    if (!on) {
      this.sirenStop?.();
      this.sirenStop = null;
      return;
    }
    if (this.sirenStop) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = "triangle";
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.4;
    const lg = ctx.createGain();
    lg.gain.value = 140;
    o.frequency.value = 330;
    lfo.connect(lg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.12, ctx.currentTime, 0.3);
    o.connect(g).connect(this.master);
    o.start();
    lfo.start();
    this.sirenStop = () => {
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      setTimeout(() => {
        o.stop();
        lfo.stop();
      }, 1000);
    };
  }

  whoosh() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(3);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 2;
    f.frequency.setValueAtTime(2000, t);
    f.frequency.exponentialRampToValueAtTime(80, t + 2.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.8, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    // low boom underneath
    this.thump(t + 0.2, 1.2);
  }

  // The Hush: a long "shhhh" that swells and dies away, over a low muffled thud.
  hush() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(3);
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 2400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.4, t + 0.6);
    g.gain.linearRampToValueAtTime(0.25, t + 1.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 2.9);
    this.thump(t, 0.6);
  }

  whisper() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(3);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    // syllable-like bursts
    for (let i = 0; i < 7; i++) {
      const st = t + i * 0.28 + Math.random() * 0.1;
      f.frequency.setValueAtTime(1500 + Math.random() * 2500, st);
      g.gain.linearRampToValueAtTime(0.35, st + 0.05);
      g.gain.linearRampToValueAtTime(0.02, st + 0.22);
    }
    g.gain.linearRampToValueAtTime(0, t + 2.4);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() > 0.5 ? -0.8 : 0.8;
    src.connect(f).connect(g).connect(pan).connect(this.master);
    src.start(t);
    src.stop(t + 2.5);
  }

  sting() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (const f of [233, 247, 262, 349]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 3);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 3.1);
    }
    this.thump(t, 1.3);
  }

  chime() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(1320, t + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 1.3);
  }
}

export const haunt = new Haunt();
