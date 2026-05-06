import type { AssetManifest } from '../assets/manifest';

export class AudioManager {
  private context: AudioContext | null = null;
  private muted = false;
  private bgm: HTMLAudioElement | null = null;
  private hitSfx: HTMLAudioElement | null = null;
  private scoreSfx: HTMLAudioElement | null = null;

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    if (this.bgm) {
      this.bgm.muted = this.muted;
      if (this.muted) {
        this.bgm.pause();
      } else {
        void this.bgm.play().catch(() => undefined);
      }
    }
    return this.muted;
  }

  async loadAssets(manifest: AssetManifest): Promise<void> {
    const [bgm, hitSfx, scoreSfx] = await Promise.all([
      loadAudio(manifest.bgm, true),
      loadAudio(manifest.hitSfx, false),
      loadAudio(manifest.scoreSfx, false),
    ]);

    this.bgm = bgm;
    this.hitSfx = hitSfx;
    this.scoreSfx = scoreSfx;
  }

  playBgm(): void {
    if (this.muted || !this.bgm) {
      return;
    }

    this.bgm.currentTime = 0;
    void this.bgm.play().catch(() => undefined);
  }

  playHit(): void {
    if (this.playAudioElement(this.hitSfx)) {
      return;
    }

    this.beep(220, 0.045, 'square', 0.05);
  }

  playScore(): void {
    if (this.playAudioElement(this.scoreSfx)) {
      return;
    }

    this.beep(440, 0.09, 'triangle', 0.06);
    window.setTimeout(() => this.beep(660, 0.11, 'triangle', 0.05), 90);
  }

  private playAudioElement(audio: HTMLAudioElement | null): boolean {
    if (this.muted || !audio) {
      return false;
    }

    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
    return true;
  }

  private beep(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number
  ): void {
    if (this.muted) {
      return;
    }

    const context = this.getContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gain.gain.value = volume;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.stop(context.currentTime + duration);
  }

  private getContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext();
    }

    if (this.context.state === 'suspended') {
      void this.context.resume();
    }

    return this.context;
  }
}

async function loadAudio(path: string, loop: boolean): Promise<HTMLAudioElement | null> {
  if (!path) {
    return null;
  }

  try {
    const response = await fetch(path);
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    audio.loop = loop;
    audio.preload = 'auto';
    audio.volume = loop ? 0.18 : 0.92;
    return audio;
  } catch {
    return null;
  }
}
