import * as Phaser from 'phaser';
import { GlassVariant, LiquidGlassPanel } from './LiquidGlassPanel';
import { LiquidGlassButton } from './LiquidGlassButton';
import { DISPLAY_FONT_FAMILY, UI_FONT_FAMILY, lighten, mixColor } from '../visuals';

export type DifficultyMode = 'easy' | 'normal' | 'hard';
export type ThemeMode = 'light' | 'dark';

type MenuLabels = {
  title: string;
  volume: string;
  difficulty: string;
  theme: string;
  language: string;
  close: string;
  easy: string;
  normal: string;
  hard: string;
  themeLight: string;
  themeDark: string;
  langZh: string;
  langEn: string;
};

type Callbacks = {
  onClose: () => void;
  onVolumeChange: (value: number) => void;
  onDifficultyChange: (difficulty: DifficultyMode) => void;
  onThemeChange: (theme: ThemeMode) => void;
  onLanguageChange: (language: 'zh' | 'en') => void;
};

export class SettingsMenu {
  public readonly root: Phaser.GameObjects.Container;

  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly panel: LiquidGlassPanel;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly volumeLabel: Phaser.GameObjects.Text;
  private readonly difficultyLabel: Phaser.GameObjects.Text;
  private readonly themeLabel: Phaser.GameObjects.Text;
  private readonly languageLabel: Phaser.GameObjects.Text;
  private readonly sliderTrack: Phaser.GameObjects.Graphics;
  private readonly sliderFill: Phaser.GameObjects.Graphics;
  private readonly sliderThumb: Phaser.GameObjects.Arc;
  private readonly sliderZone: Phaser.GameObjects.Zone;
  private readonly waveBars: Phaser.GameObjects.Graphics[] = [];
  private readonly closeButton: LiquidGlassButton;
  private readonly difficultyButtons: Record<DifficultyMode, LiquidGlassButton>;
  private readonly themeButtons: Record<ThemeMode, LiquidGlassButton>;
  private readonly languageButtons: Record<'zh' | 'en', LiquidGlassButton>;
  private readonly callbacks: Callbacks;

  private widthPx = 420;
  private heightPx = 440;
  private accent = 0x4fb3ff;
  private variant: GlassVariant = 'light';
  private visible = false;
  private draggingSlider = false;
  private volume = 0.5;
  private difficulty: DifficultyMode = 'normal';
  private theme: ThemeMode = 'light';
  private language: 'zh' | 'en' = 'zh';

  constructor(
    private readonly scene: Phaser.Scene,
    callbacks: Callbacks
  ) {
    this.callbacks = callbacks;
    this.root = scene.add.container(0, 0).setDepth(700).setVisible(false);
    this.overlay = scene.add.rectangle(0, 0, 10, 10, 0xfff4ee, 0.56).setOrigin(0);
    this.panel = new LiquidGlassPanel(scene, this.widthPx, this.heightPx, 28, this.accent, this.variant);
    this.titleText = scene.add.text(0, 0, '', {
      fontFamily: DISPLAY_FONT_FAMILY,
      fontSize: '28px',
      fontStyle: '800',
      color: '#5d4a64'
    });
    this.volumeLabel = this.createSectionText(scene);
    this.difficultyLabel = this.createSectionText(scene);
    this.themeLabel = this.createSectionText(scene);
    this.languageLabel = this.createSectionText(scene);
    this.sliderTrack = scene.add.graphics();
    this.sliderFill = scene.add.graphics();
    this.sliderThumb = scene.add.circle(0, 0, 9, 0xffffff, 0.95);
    this.sliderZone = scene.add.zone(0, 0, 10, 10).setOrigin(0, 0);
    this.closeButton = new LiquidGlassButton(scene, 108, 44, this.accent, this.variant, () => {
      this.callbacks.onClose();
    });

    this.difficultyButtons = {
      easy: new LiquidGlassButton(scene, 92, 42, this.accent, this.variant, () => {
        this.setDifficulty('easy', true);
      }),
      normal: new LiquidGlassButton(scene, 92, 42, this.accent, this.variant, () => {
        this.setDifficulty('normal', true);
      }),
      hard: new LiquidGlassButton(scene, 92, 42, this.accent, this.variant, () => {
        this.setDifficulty('hard', true);
      })
    };

    this.themeButtons = {
      light: new LiquidGlassButton(scene, 126, 42, this.accent, this.variant, () => {
        this.setTheme('light', true);
      }),
      dark: new LiquidGlassButton(scene, 126, 42, this.accent, this.variant, () => {
        this.setTheme('dark', true);
      })
    };

    this.languageButtons = {
      zh: new LiquidGlassButton(scene, 92, 42, this.accent, this.variant, () => {
        this.setLanguage('zh', true);
      }),
      en: new LiquidGlassButton(scene, 92, 42, this.accent, this.variant, () => {
        this.setLanguage('en', true);
      })
    };

    this.sliderZone.setInteractive();
    this.sliderZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.draggingSlider = true;
      this.updateSliderFromPointer(pointer, true);
    });
    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.draggingSlider && this.visible) {
        this.updateSliderFromPointer(pointer, true);
      }
    });
    scene.input.on('pointerup', () => {
      this.draggingSlider = false;
    });
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.updateWaveBars, this);

    this.root.add([
      this.overlay,
      this.panel.root,
      this.titleText,
      this.volumeLabel,
      this.difficultyLabel,
      this.themeLabel,
      this.languageLabel,
      this.sliderTrack,
      this.sliderFill,
      this.sliderThumb,
      this.sliderZone,
      this.closeButton.root,
      this.difficultyButtons.easy.root,
      this.difficultyButtons.normal.root,
      this.difficultyButtons.hard.root,
      this.themeButtons.light.root,
      this.themeButtons.dark.root,
      this.languageButtons.zh.root,
      this.languageButtons.en.root
    ]);

    for (let index = 0; index < 12; index += 1) {
      const bar = scene.add.graphics();
      this.waveBars.push(bar);
      this.root.add(bar);
    }
  }

  public layout(viewportWidth: number, viewportHeight: number, landscape: boolean): void {
    this.overlay.setSize(viewportWidth, viewportHeight);

    this.widthPx = landscape ? 440 : Math.min(420, viewportWidth - 32);
    this.heightPx = landscape ? 456 : 468;
    const x = landscape ? viewportWidth - this.widthPx - 26 : (viewportWidth - this.widthPx) * 0.5;
    const y = landscape ? viewportHeight * 0.5 - this.heightPx * 0.5 : 28;

    this.panel.resize(x, y, this.widthPx, this.heightPx, 28);
    this.titleText.setPosition(x + 24, y + 20);
    this.closeButton.setPosition(x + this.widthPx - 66, y + 32);
    this.volumeLabel.setPosition(x + 24, y + 84);
    this.sliderZone.setPosition(x + 24, y + 120).setSize(this.widthPx - 48, 48);
    this.drawSlider();

    this.difficultyLabel.setPosition(x + 24, y + 176);
    this.difficultyButtons.easy.setPosition(x + 72, y + 232);
    this.difficultyButtons.normal.setPosition(x + 178, y + 232);
    this.difficultyButtons.hard.setPosition(x + 284, y + 232);

    this.themeLabel.setPosition(x + 24, y + 284);
    this.themeButtons.light.setPosition(x + 92, y + 340);
    this.themeButtons.dark.setPosition(x + 234, y + 340);

    this.languageLabel.setPosition(x + 24, y + 392);
    this.languageButtons.zh.setPosition(x + 72, y + 426);
    this.languageButtons.en.setPosition(x + 178, y + 426);
  }

  public setVisible(visible: boolean): this {
    this.visible = visible;
    this.root.setVisible(visible);
    this.draggingSlider = false;
    return this;
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public applyTheme(accent: number, variant: GlassVariant): this {
    this.accent = accent;
    this.variant = variant;
    this.panel.setAccent(accent).setVariant(variant);
    this.closeButton.setAccent(accent).setVariant(variant);

    for (const button of Object.values(this.difficultyButtons)) {
      button.setAccent(accent).setVariant(variant);
    }
    for (const button of Object.values(this.themeButtons)) {
      button.setAccent(accent).setVariant(variant);
    }
    for (const button of Object.values(this.languageButtons)) {
      button.setAccent(accent).setVariant(variant);
    }

    const textColor = variant === 'light' ? '#5d4a64' : '#fff7f1';
    this.titleText.setColor(textColor);
    this.volumeLabel.setColor(textColor);
    this.difficultyLabel.setColor(textColor);
    this.themeLabel.setColor(textColor);
    this.languageLabel.setColor(textColor);
    this.overlay.fillColor = variant === 'light' ? 0xfff4ee : 0x201729;
    this.overlay.fillAlpha = variant === 'light' ? 0.56 : 0.64;
    this.drawSlider();
    this.refreshSelections();

    return this;
  }

  public setLabels(labels: MenuLabels): this {
    this.titleText.setText(labels.title);
    this.volumeLabel.setText(labels.volume);
    this.difficultyLabel.setText(labels.difficulty);
    this.themeLabel.setText(labels.theme);
    this.languageLabel.setText(labels.language);
    this.closeButton.setLabel(labels.close);
    this.difficultyButtons.easy.setLabel(labels.easy);
    this.difficultyButtons.normal.setLabel(labels.normal);
    this.difficultyButtons.hard.setLabel(labels.hard);
    this.themeButtons.light.setLabel(labels.themeLight);
    this.themeButtons.dark.setLabel(labels.themeDark);
    this.languageButtons.zh.setLabel(labels.langZh);
    this.languageButtons.en.setLabel(labels.langEn);

    return this;
  }

  public setVolume(volume: number): this {
    this.volume = Phaser.Math.Clamp(volume, 0, 1);
    this.drawSlider();

    return this;
  }

  public setDifficulty(difficulty: DifficultyMode, emit = false): this {
    this.difficulty = difficulty;
    this.refreshSelections();

    if (emit) {
      this.callbacks.onDifficultyChange(difficulty);
    }

    return this;
  }

  public setTheme(theme: ThemeMode, emit = false): this {
    this.theme = theme;
    this.refreshSelections();

    if (emit) {
      this.callbacks.onThemeChange(theme);
    }

    return this;
  }

  public setLanguage(language: 'zh' | 'en', emit = false): this {
    this.language = language;
    this.refreshSelections();

    if (emit) {
      this.callbacks.onLanguageChange(language);
    }

    return this;
  }

  private createSectionText(scene: Phaser.Scene): Phaser.GameObjects.Text {
    return scene.add.text(0, 0, '', {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '16px',
      fontStyle: '800',
      color: '#5d4a64'
    });
  }

  private updateSliderFromPointer(pointer: Phaser.Input.Pointer, emit: boolean): void {
    const trackX = this.sliderZone.x;
    const trackWidth = this.sliderZone.width;
    const ratio = Phaser.Math.Clamp((pointer.x - trackX) / trackWidth, 0, 1);

    this.setVolume(ratio);

    if (emit) {
      this.callbacks.onVolumeChange(this.volume);
    }
  }

  private drawSlider(): void {
    const x = this.sliderZone.x;
    const y = this.sliderZone.y + 22;
    const width = this.sliderZone.width;
    const fillWidth = width * this.volume;
    const trackColor = this.variant === 'light' ? 0xf5ddd2 : 0x352943;
    const accentLight = lighten(this.accent, 0.24);

    this.sliderTrack
      .clear()
      .fillStyle(trackColor, this.variant === 'light' ? 0.92 : 0.8)
      .fillRoundedRect(x, y, width, 8, 4)
      .fillStyle(0xffffff, this.variant === 'light' ? 0.58 : 0.12)
      .fillRoundedRect(x + 2, y + 1, width - 4, 3, 2);

    this.sliderFill
      .clear()
      .fillStyle(this.accent, 0.88)
      .fillRoundedRect(x, y, fillWidth, 8, 4)
      .fillStyle(lighten(this.accent, 0.44), 0.44)
      .fillRoundedRect(x, y, fillWidth, 3, 2);

    this.sliderThumb
      .setPosition(x + fillWidth, y + 4)
      .setRadius(9)
      .setFillStyle(mixColor(accentLight, 0xffffff, 0.2), 0.98)
      .setStrokeStyle(2, 0xffffff, this.variant === 'light' ? 0.9 : 0.5);
  }

  private refreshSelections(): void {
    const accent = this.accent;
    const inactive = this.variant === 'light' ? mixColor(0xd8b8c8, 0xe8dfeb, 0.5) : 0x7f6995;

    this.difficultyButtons.easy.setAccent(this.difficulty === 'easy' ? accent : inactive);
    this.difficultyButtons.normal.setAccent(this.difficulty === 'normal' ? accent : inactive);
    this.difficultyButtons.hard.setAccent(this.difficulty === 'hard' ? accent : inactive);
    this.themeButtons.light.setAccent(this.theme === 'light' ? accent : inactive);
    this.themeButtons.dark.setAccent(this.theme === 'dark' ? accent : inactive);
    this.languageButtons.zh.setAccent(this.language === 'zh' ? accent : inactive);
    this.languageButtons.en.setAccent(this.language === 'en' ? accent : inactive);
  }

  private updateWaveBars(): void {
    if (!this.visible) {
      return;
    }

    const baseX = this.sliderZone.x;
    const baseY = this.sliderZone.y - 16;
    const amplitude = 8 + this.volume * 12;

    for (let index = 0; index < this.waveBars.length; index += 1) {
      const phase = this.scene.time.now * 0.008 + index * 0.55;
      const height = 8 + Math.abs(Math.sin(phase)) * amplitude;
      const x = baseX + index * 14;
      const bar = this.waveBars[index];

      bar
        .clear()
        .fillStyle(
          index / this.waveBars.length <= this.volume
            ? this.accent
            : this.variant === 'light'
              ? mixColor(0xffd9cc, 0xe8dcef, 0.42)
              : 0x5e4b74,
          0.82
        )
        .fillRoundedRect(x, baseY - height, 8, height, 4);
    }
  }
}
