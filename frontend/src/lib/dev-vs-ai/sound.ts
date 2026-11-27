import type { SoundCue } from "@/lib/dev-vs-ai/core";

/**
 * Lightweight Web Audio API 8-bit chiptune sound synthesizer.
 * Zero external audio files required; gracefully no-ops when muted or unavailable.
 */
export class ChiptuneSoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private lastPlayedAt: Partial<Record<SoundCue["kind"], number>> = {};

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  private playNoise(duration: number, volume: number, delay = 0): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1100, ctx.currentTime + delay);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(ctx.currentTime + delay);
  }

  play(kind: SoundCue["kind"]): void {
    if (this.muted) return;
    const nowMs = performance.now();
    const minGap = kind === "shoot" || kind === "hit" ? 65 : 30;
    if (nowMs - (this.lastPlayedAt[kind] ?? 0) < minGap) return;
    this.lastPlayedAt[kind] = nowMs;

    switch (kind) {
      case "token":
        this.playTone(660, 880, 0.08, "square", 0.07, 0);
        this.playTone(990, 1320, 0.12, "triangle", 0.08, 0.06);
        break;
      case "place":
        this.playTone(260, 440, 0.08, "square", 0.07, 0);
        this.playTone(520, 640, 0.07, "triangle", 0.06, 0.05);
        break;
      case "uninstall":
        this.playTone(420, 200, 0.12, "square", 0.06, 0);
        break;
      case "shoot":
        this.playTone(720, 340, 0.07, "square", 0.035, 0);
        break;
      case "ice":
        this.playTone(980, 620, 0.09, "triangle", 0.045, 0);
        break;
      case "hit":
        this.playTone(210, 120, 0.05, "sawtooth", 0.035, 0);
        break;
      case "explosion":
        this.playNoise(0.28, 0.14, 0);
        this.playTone(150, 45, 0.25, "sawtooth", 0.1, 0);
        break;
      case "broom":
        this.playNoise(0.32, 0.09, 0);
        this.playTone(340, 960, 0.22, "triangle", 0.08, 0.04);
        break;
      case "coffee":
        this.playTone(440, 554, 0.07, "square", 0.07, 0);
        this.playTone(554, 659, 0.07, "square", 0.07, 0.06);
        this.playTone(659, 880, 0.16, "square", 0.08, 0.12);
        break;
      case "wave":
        this.playTone(330, 330, 0.1, "square", 0.07, 0);
        this.playTone(440, 440, 0.1, "square", 0.07, 0.11);
        this.playTone(554, 659, 0.2, "square", 0.08, 0.22);
        break;
      case "boss-lock":
        this.playTone(240, 140, 0.18, "sawtooth", 0.08, 0);
        this.playTone(180, 110, 0.15, "square", 0.06, 0.08);
        break;
      case "victory":
        this.playTone(523, 523, 0.1, "square", 0.08, 0);
        this.playTone(659, 659, 0.1, "square", 0.08, 0.1);
        this.playTone(784, 784, 0.1, "square", 0.08, 0.2);
        this.playTone(1046, 1046, 0.28, "square", 0.09, 0.3);
        break;
      case "defeat":
        this.playTone(392, 349, 0.16, "sawtooth", 0.08, 0);
        this.playTone(349, 293, 0.16, "sawtooth", 0.08, 0.17);
        this.playTone(261, 180, 0.35, "sawtooth", 0.08, 0.34);
        break;
    }
  }

  flush(queue: SoundCue[]): void {
    while (queue.length > 0) {
      const cue = queue.shift();
      if (cue) this.play(cue.kind);
    }
  }
}
