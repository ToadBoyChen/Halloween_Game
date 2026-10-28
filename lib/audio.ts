"use client";

// All hub sounds are synthesised with the Web Audio API, so there are no files to ship.

class Haunt {
  ctx: AudioContext | null = null;
  master!: GainNode;
  droneGain!: GainNode;
  heartTimer: ReturnType<typeof setTimeout> | null = null;
  heartRate = 0; // beats per minute, 0 = off
  sirenStop: (() => void) | null = null;

  awaken() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);
    this.startDrone();
  }

  private noiseBuffer(seconds = 2) {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private startDrone() {
    const ctx = this.ctx!;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0.12;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 380;
    filter.connect(this.droneGain).connect(this.master);
    for (const [f, detune] of [[55, 0], [55.4, 7], [82.4, -5], [110.3, 3]]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = 0.25;
      // slow wobble
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + Math.random() * 0.1;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.15;
      lfo.connect(lfoGain).connect(g.gain);
      lfo.start();
      o.connect(g).connect(filter);
      o.start();
    }
    // wind
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer(4);
    wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = "bandpass";
    wf.frequency.value = 500;
    wf.Q.value = 0.8;
    const wg = ctx.createGain();
    wg.gain.value = 0.18;
    const wl = ctx.createOscillator();
    wl.frequency.value = 0.08;
    const wlg = ctx.createGain();
    wlg.gain.value = 300;
    wl.connect(wlg).connect(wf.frequency);
    wl.start();
    wind.connect(wf).connect(wg).connect(this.droneGain);
    wind.start();
  }

  setDrone(level: number) {
    if (!this.ctx) return;
    this.droneGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.8);
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
