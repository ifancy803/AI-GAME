export class SoundController {
  private context?: AudioContext;
  private masterGain?: GainNode;
  private volume = 0.12;

  public unlock(): void {
    const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtor) {
      return;
    }

    if (!this.context) {
      this.context = new AudioCtor();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
  }

  public playSwap(): void {
    this.playSequence([
      { time: 0, frequency: 420, duration: 0.05, type: 'triangle', gain: 0.22 },
      { time: 0.04, frequency: 520, duration: 0.06, type: 'triangle', gain: 0.18 }
    ]);
  }

  public playInvalid(): void {
    this.playSequence([
      { time: 0, frequency: 260, duration: 0.08, type: 'square', gain: 0.18 },
      { time: 0.06, frequency: 190, duration: 0.11, type: 'sawtooth', gain: 0.16 }
    ]);
  }

  public playCascade(cascadeIndex: number, cleared: number): void {
    const base = 460 + Math.min(6, cascadeIndex) * 55;
    const accent = base + Math.min(6, Math.floor(cleared / 2)) * 40;

    this.playSequence([
      { time: 0, frequency: base, duration: 0.08, type: 'triangle', gain: 0.2 },
      { time: 0.03, frequency: accent, duration: 0.11, type: 'sine', gain: 0.15 }
    ]);
  }

  public playHint(): void {
    this.playSequence([
      { time: 0, frequency: 660, duration: 0.06, type: 'sine', gain: 0.14 },
      { time: 0.06, frequency: 780, duration: 0.09, type: 'triangle', gain: 0.12 }
    ]);
  }

  public playAiFocus(rank: number): void {
    const frequency = 350 + rank * 70;

    this.playSequence([
      { time: 0, frequency, duration: 0.05, type: 'triangle', gain: 0.12 }
    ]);
  }

  public playVictory(): void {
    this.playSequence([
      { time: 0, frequency: 523, duration: 0.13, type: 'triangle', gain: 0.16 },
      { time: 0.08, frequency: 659, duration: 0.14, type: 'triangle', gain: 0.16 },
      { time: 0.16, frequency: 784, duration: 0.18, type: 'triangle', gain: 0.18 }
    ]);
  }

  public playDefeat(): void {
    this.playSequence([
      { time: 0, frequency: 392, duration: 0.12, type: 'sawtooth', gain: 0.14 },
      { time: 0.1, frequency: 294, duration: 0.16, type: 'sawtooth', gain: 0.14 }
    ]);
  }

  public playToggle(): void {
    this.playSequence([
      { time: 0, frequency: 600, duration: 0.05, type: 'triangle', gain: 0.12 },
      { time: 0.05, frequency: 700, duration: 0.06, type: 'triangle', gain: 0.12 }
    ]);
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));

    if (this.masterGain && this.context) {
      this.masterGain.gain.setValueAtTime(this.volume, this.context.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  private playSequence(
    notes: Array<{
      time: number;
      frequency: number;
      duration: number;
      type: OscillatorType;
      gain: number;
    }>
  ): void {
    this.unlock();

    if (!this.context || !this.masterGain) {
      return;
    }

    const now = this.context.currentTime;

    for (const note of notes) {
      const oscillator = this.context.createOscillator();
      const gainNode = this.context.createGain();

      oscillator.type = note.type;
      oscillator.frequency.setValueAtTime(note.frequency, now + note.time);
      gainNode.gain.setValueAtTime(0.0001, now + note.time);
      gainNode.gain.exponentialRampToValueAtTime(note.gain, now + note.time + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        now + note.time + note.duration
      );

      oscillator.connect(gainNode);
      gainNode.connect(this.masterGain);
      oscillator.start(now + note.time);
      oscillator.stop(now + note.time + note.duration + 0.02);
    }
  }
}
