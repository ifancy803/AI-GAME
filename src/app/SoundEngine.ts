import type { FeedbackKind } from '../game/types';

interface ToneStep {
  frequency: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export class SoundEngine {
  private context: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const AudioCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtor) {
      return null;
    }

    if (!this.context) {
      this.context = new AudioCtor();
    }

    return this.context;
  }

  resume(): void {
    this.getContext()?.resume().catch(() => undefined);
  }

  private async playSequence(steps: ToneStep[]) {
    const context = this.getContext();

    if (!context) {
      return;
    }

    if (context.state === 'suspended') {
      await context.resume().catch(() => undefined);
    }

    let time = context.currentTime;

    for (const step of steps) {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = step.type ?? 'sine';
      oscillator.frequency.setValueAtTime(step.frequency, time);

      gainNode.gain.setValueAtTime(0.0001, time);
      gainNode.gain.exponentialRampToValueAtTime(step.gain, time + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + step.duration);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start(time);
      oscillator.stop(time + step.duration);

      time += step.duration * 0.72;
    }

    await sleep(0);
  }

  play(kind: FeedbackKind): void {
    const sequences: Record<FeedbackKind, ToneStep[]> = {
      idle: [],
      restart: [
        { frequency: 260, duration: 0.09, gain: 0.022, type: 'triangle' },
        { frequency: 390, duration: 0.13, gain: 0.02, type: 'triangle' },
      ],
      theme: [
        { frequency: 280, duration: 0.08, gain: 0.02, type: 'triangle' },
        { frequency: 420, duration: 0.08, gain: 0.018, type: 'triangle' },
        { frequency: 620, duration: 0.16, gain: 0.02, type: 'sine' },
      ],
      select: [{ frequency: 480, duration: 0.06, gain: 0.01, type: 'triangle' }],
      hint: [
        { frequency: 520, duration: 0.07, gain: 0.012, type: 'sine' },
        { frequency: 780, duration: 0.12, gain: 0.018, type: 'triangle' },
      ],
      invalid: [
        { frequency: 240, duration: 0.08, gain: 0.015, type: 'sawtooth' },
        { frequency: 180, duration: 0.12, gain: 0.014, type: 'sawtooth' },
      ],
      'player-move': [
        { frequency: 420, duration: 0.06, gain: 0.016, type: 'triangle' },
        { frequency: 560, duration: 0.08, gain: 0.018, type: 'triangle' },
        { frequency: 760, duration: 0.15, gain: 0.02, type: 'sine' },
      ],
      'ai-move': [
        { frequency: 260, duration: 0.07, gain: 0.016, type: 'triangle' },
        { frequency: 330, duration: 0.08, gain: 0.017, type: 'triangle' },
        { frequency: 420, duration: 0.14, gain: 0.018, type: 'sine' },
      ],
    };

    const steps = sequences[kind];

    if (steps.length === 0) {
      return;
    }

    void this.playSequence(steps);
  }
}
