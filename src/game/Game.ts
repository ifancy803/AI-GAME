import * as Phaser from 'phaser';
import { AIPlayer } from './AIPlayer';
import { Board } from './Board';
import { formatMoveLabel, formatPatternSummary, translate } from './I18n';
import { LevelGenerator } from './LevelGenerator';
import { SoundController } from './SoundController';
import { LiquidGlassButton } from './ui/LiquidGlassButton';
import { GlassVariant, LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { DifficultyMode, SettingsMenu, ThemeMode } from './ui/SettingsMenu';
import {
  DISPLAY_FONT_FAMILY,
  JOYFUL_SURFACE,
  TILE_ART_DESCRIPTIONS,
  TILE_TEXTURE_KEYS,
  UI_FONT_FAMILY,
  WARM_EASING,
  darken,
  hexToCss,
  lighten,
  mixColor
} from './visuals';
import {
  AIDecision,
  BoardLayout,
  Language,
  LevelConfig,
  Move,
  PlayerSide,
  ScoreBook,
  ThoughtPreview
} from './types';

type StatusState = {
  key: string;
  params?: Record<string, string | number>;
};

type ThoughtState =
  | { mode: 'info' }
  | { mode: 'hint'; preview: ThoughtPreview; depth: number }
  | {
      mode: 'decision';
      preview: ThoughtPreview;
      depth: number;
      candidateIndex: number;
      selected: boolean;
    };

type SceneTheme = {
  mode: ThemeMode;
  variant: GlassVariant;
  background: number;
  backgroundOrbA: number;
  backgroundOrbB: number;
  backgroundOrbC: number;
  accent: number;
  text: string;
  muted: string;
  soft: string;
  panelAccent: number;
};

class Match3Scene extends Phaser.Scene {
  private readonly ai = new AIPlayer(2, 8);
  private readonly sfx = new SoundController();
  private board?: Board;
  private levelId = 1;
  private level!: LevelConfig;
  private language: Language = 'zh';
  private difficulty: DifficultyMode = 'normal';
  private themeMode: ThemeMode = 'light';
  private scores: ScoreBook = { player: 0, ai: 0 };
  private turnsLeft: Record<PlayerSide, number> = { player: 0, ai: 0 };
  private currentTurn: PlayerSide = 'player';
  private busy = false;
  private playerWinStreak = 0;
  private statusState: StatusState = { key: 'yourTurn' };
  private thoughtState: ThoughtState = { mode: 'info' };
  private levelCompleted = false;

  private background!: Phaser.GameObjects.Graphics;
  private backgroundDecor!: Phaser.GameObjects.Container;
  private backgroundDecorElements: Phaser.GameObjects.Image[] = [];
  private hudTop!: LiquidGlassPanel;
  private hudBottom!: LiquidGlassPanel;
  private thoughtPanel!: LiquidGlassPanel;
  private topCenterPanel!: LiquidGlassPanel;
  private actionPanel!: LiquidGlassPanel;
  private playerScorePanel!: LiquidGlassPanel;
  private aiScorePanel!: LiquidGlassPanel;
  private streakPanel!: LiquidGlassPanel;
  private titleText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private detailText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private playerScoreLabel!: Phaser.GameObjects.Text;
  private playerScoreText!: Phaser.GameObjects.Text;
  private aiScoreLabel!: Phaser.GameObjects.Text;
  private aiScoreText!: Phaser.GameObjects.Text;
  private streakLabel!: Phaser.GameObjects.Text;
  private streakText!: Phaser.GameObjects.Text;
  private playerTurnsText!: Phaser.GameObjects.Text;
  private aiTurnsText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private metaText!: Phaser.GameObjects.Text;
  private thoughtTitleText!: Phaser.GameObjects.Text;
  private thoughtBodyText!: Phaser.GameObjects.Text;
  private thoughtViz!: Phaser.GameObjects.Graphics;
  private thoughtVizLabelText!: Phaser.GameObjects.Text;
  private thoughtVizMoveText!: Phaser.GameObjects.Text;
  private thoughtVizMetaText!: Phaser.GameObjects.Text;
  private hintButton!: LiquidGlassButton;
  private restartButton!: LiquidGlassButton;
  private nextButton!: LiquidGlassButton;
  private pauseButton!: LiquidGlassButton;
  private settingsMenu!: SettingsMenu;
  private idleHintTimer?: Phaser.Time.TimerEvent;
  private landscape = false;
  private menuOpen = false;
  private thoughtPanelBounds?: Phaser.Geom.Rectangle;

  constructor() {
    super('Match3Arena');
  }

  public preload(): void {}

  public create(): void {
    this.ensureTextures();
    this.buildBackground();
    this.buildHud();
    this.applyTheme();
    this.input.on('pointerdown', () => this.sfx.unlock());
    this.scale.on('resize', this.layoutScene, this);
    this.startLevel(this.levelId);
    this.layoutScene();
  }

  private ensureTextures(): void {
    if (!this.textures.exists('tile-hint-ring')) {
      const ring = this.add.graphics();
      ring.lineStyle(10, 0xffd9a8, 0.24).strokeRoundedRect(6, 6, 148, 148, 34);
      ring.lineStyle(4, 0xffffff, 0.9).strokeRoundedRect(14, 14, 132, 132, 28);
      ring.generateTexture('tile-hint-ring', 160, 160);
      ring.destroy();
    }

    if (!this.textures.exists('tile-select-ring')) {
      const ring = this.add.graphics();
      ring.lineStyle(10, 0xffb7c3, 0.3).strokeRoundedRect(6, 6, 148, 148, 34);
      ring.lineStyle(4, 0xfff4cf, 0.96).strokeRoundedRect(14, 14, 132, 132, 28);
      ring.generateTexture('tile-select-ring', 160, 160);
      ring.destroy();
    }

    if (!this.textures.exists('tile-backing')) {
      const backing = this.add.graphics();
      backing.fillStyle(0xffffff, 0.96).fillRoundedRect(10, 10, 108, 108, 38);
      backing.fillStyle(0xffffff, 0.42).fillRoundedRect(18, 14, 92, 36, 22);
      backing.lineStyle(4, 0xffffff, 0.82).strokeRoundedRect(12, 12, 104, 104, 36);
      backing.generateTexture('tile-backing', 128, 128);
      backing.destroy();
    }

    if (!this.textures.exists('tile-sheen')) {
      const sheen = this.add.graphics();
      sheen.fillStyle(0xffffff, 0.84).fillCircle(34, 30, 12);
      sheen.fillStyle(0xffffff, 0.52).fillCircle(52, 22, 6);
      sheen.fillStyle(0xffffff, 0.3).fillCircle(48, 44, 4);
      sheen.generateTexture('tile-sheen', 72, 72);
      sheen.destroy();
    }

    if (!this.textures.exists('tile-shadow')) {
      const shadow = this.add.graphics();
      shadow.fillStyle(0x7f5574, 0.42).fillEllipse(50, 14, 86, 20);
      shadow.generateTexture('tile-shadow', 100, 28);
      shadow.destroy();
    }

    if (!this.textures.exists('tile-core-glow')) {
      const glow = this.add.graphics();
      glow.fillStyle(0xffffff, 0.12).fillCircle(64, 64, 56);
      glow.fillStyle(0xffffff, 0.22).fillCircle(64, 64, 40);
      glow.fillStyle(0xffffff, 0.38).fillCircle(64, 64, 24);
      glow.generateTexture('tile-core-glow', 128, 128);
      glow.destroy();
    }

    TILE_TEXTURE_KEYS.forEach((key, index) => {
      if (!this.textures.exists(key)) {
        this.generateIllustratedTileTexture(key, this.level?.palette[index] ?? JOYFUL_SURFACE.apricot, index);
      }
    });

    if (!this.textures.exists('particle-petal')) {
      const petal = this.add.graphics();
      petal.fillStyle(0xffffff, 0.96).fillEllipse(18, 12, 18, 30);
      petal.generateTexture('particle-petal', 36, 36);
      petal.destroy();
    }

    if (!this.textures.exists('particle-heart')) {
      const heart = this.add.graphics();
      heart.fillStyle(0xffffff, 0.96);
      heart.fillCircle(16, 14, 8);
      heart.fillCircle(26, 14, 8);
      heart.fillTriangle(8, 18, 34, 18, 21, 34);
      heart.generateTexture('particle-heart', 42, 40);
      heart.destroy();
    }

    if (!this.textures.exists('particle-bloom')) {
      const bloom = this.add.graphics();
      for (let petalIndex = 0; petalIndex < 5; petalIndex += 1) {
        const angle = (Math.PI * 2 * petalIndex) / 5;
        bloom.fillStyle(0xffffff, 0.92).fillCircle(20 + Math.cos(angle) * 9, 20 + Math.sin(angle) * 9, 8);
      }
      bloom.fillStyle(0xffffff, 0.96).fillCircle(20, 20, 7);
      bloom.generateTexture('particle-bloom', 40, 40);
      bloom.destroy();
    }

    if (!this.textures.exists('particle-soft')) {
      const particle = this.add.graphics();
      particle.fillStyle(0xffffff, 0.1).fillCircle(24, 24, 24);
      particle.fillStyle(0xffffff, 0.26).fillCircle(24, 24, 16);
      particle.fillStyle(0xffffff, 0.82).fillCircle(24, 24, 7);
      particle.generateTexture('particle-soft', 48, 48);
      particle.destroy();
    }

    if (!this.textures.exists('particle-streak')) {
      const streak = this.add.graphics();
      const points = [
        new Phaser.Math.Vector2(5, 14),
        new Phaser.Math.Vector2(28, 4),
        new Phaser.Math.Vector2(48, 14),
        new Phaser.Math.Vector2(28, 24)
      ];

      streak.fillStyle(0xffffff, 0.96).fillPoints(points, true);
      streak.fillStyle(0xffffff, 0.44).fillCircle(28, 14, 10);
      streak.generateTexture('particle-streak', 54, 28);
      streak.destroy();
    }

    if (!this.textures.exists('bg-blob')) {
      const blob = this.add.graphics();
      blob.fillStyle(0xffffff, 0.9);
      blob.fillCircle(34, 28, 24);
      blob.fillCircle(56, 34, 26);
      blob.fillCircle(72, 22, 20);
      blob.fillCircle(88, 40, 22);
      blob.fillCircle(52, 56, 28);
      blob.generateTexture('bg-blob', 120, 96);
      blob.destroy();
    }
  }

  private generateIllustratedTileTexture(key: string, color: number, index: number): void {
    const surface = this.add.graphics();
    const highlight = lighten(color, 0.28);
    const stroke = darken(color, 0.2);

    surface.fillStyle(highlight, 0.28).fillCircle(64, 64, 42);
    surface.lineStyle(4, mixColor(color, 0xffffff, 0.42), 0.34).strokeCircle(64, 64, 40);

    switch (index) {
      case 0:
        for (let petalIndex = 0; petalIndex < 5; petalIndex += 1) {
          const angle = (Math.PI * 2 * petalIndex) / 5 - Math.PI / 2;
          surface.fillStyle(color, 0.98).fillCircle(64 + Math.cos(angle) * 22, 64 + Math.sin(angle) * 22, 18);
        }
        surface.fillStyle(0xfff6c2, 0.98).fillCircle(64, 64, 16);
        break;
      case 1: {
        const star = Array.from({ length: 10 }, (_, pointIndex) => {
          const angle = -Math.PI / 2 + pointIndex * (Math.PI / 5);
          const radius = pointIndex % 2 === 0 ? 34 : 16;
          return new Phaser.Math.Vector2(64 + Math.cos(angle) * radius, 64 + Math.sin(angle) * radius);
        });
        surface.fillStyle(color, 1).fillPoints(star, true);
        surface.lineStyle(4, stroke, 0.24).strokePoints(star, true);
        break;
      }
      case 2:
        surface.fillStyle(color, 0.84).fillCircle(56, 68, 28);
        surface.fillStyle(mixColor(color, 0xffffff, 0.2), 0.76).fillCircle(80, 50, 18);
        surface.fillStyle(0xffffff, 0.48).fillCircle(48, 58, 8);
        surface.fillStyle(0xffffff, 0.34).fillCircle(76, 44, 5);
        break;
      case 3:
        surface.fillStyle(color, 1);
        surface.fillCircle(50, 48, 18);
        surface.fillCircle(78, 48, 18);
        surface.fillTriangle(30, 58, 98, 58, 64, 104);
        break;
      case 4: {
        const leaf = [
          new Phaser.Math.Vector2(64, 20),
          new Phaser.Math.Vector2(92, 42),
          new Phaser.Math.Vector2(76, 100),
          new Phaser.Math.Vector2(64, 108),
          new Phaser.Math.Vector2(52, 100),
          new Phaser.Math.Vector2(36, 42)
        ];
        surface.fillStyle(color, 1).fillPoints(leaf, true);
        surface.lineStyle(3, stroke, 0.24).strokePoints(leaf, true);
        surface.lineStyle(4, mixColor(color, 0xffffff, 0.24), 0.44).lineBetween(64, 28, 64, 96);
        break;
      }
      case 5:
        surface.fillStyle(color, 1).fillCircle(64, 64, 26);
        for (let rayIndex = 0; rayIndex < 8; rayIndex += 1) {
          const angle = (Math.PI * 2 * rayIndex) / 8;
          surface.lineStyle(8, color, 0.96).lineBetween(
            64 + Math.cos(angle) * 34,
            64 + Math.sin(angle) * 34,
            64 + Math.cos(angle) * 46,
            64 + Math.sin(angle) * 46
          );
        }
        break;
      default:
        surface.lineStyle(6, stroke, 0.34).lineBetween(64, 86, 64, 44);
        surface.fillStyle(color, 1).fillEllipse(50, 54, 26, 34);
        surface.fillStyle(mixColor(color, 0xffffff, 0.1), 1).fillEllipse(78, 52, 28, 36);
        break;
    }

    surface.fillStyle(0xffffff, 0.2).fillEllipse(50, 36, 28, 16);
    surface.generateTexture(key, 128, 128);
    surface.destroy();
  }

  private buildBackground(): void {
    this.background = this.add.graphics().setDepth(-40);
    this.backgroundDecor = this.add.container(0, 0).setDepth(-38);
  }

  private refreshBackgroundDecor(width: number, height: number, theme: SceneTheme): void {
    this.backgroundDecorElements.forEach((element) => {
      this.tweens.killTweensOf(element);
      element.destroy();
    });
    this.backgroundDecor.removeAll(false);
    this.backgroundDecorElements = [];

    const specs = [
      { x: width * 0.14, y: height * 0.14, scale: 1.2, alpha: 0.32, tint: theme.backgroundOrbA, texture: 'bg-blob' },
      { x: width * 0.82, y: height * 0.2, scale: 0.92, alpha: 0.28, tint: theme.backgroundOrbB, texture: 'bg-blob' },
      { x: width * 0.18, y: height * 0.84, scale: 0.62, alpha: 0.46, tint: mixColor(theme.backgroundOrbA, 0xffffff, 0.26), texture: 'particle-bloom' },
      { x: width * 0.86, y: height * 0.78, scale: 0.54, alpha: 0.42, tint: mixColor(theme.backgroundOrbB, 0xffffff, 0.34), texture: 'particle-heart' },
      { x: width * 0.58, y: height * 0.12, scale: 0.7, alpha: 0.42, tint: mixColor(theme.backgroundOrbC, 0xffffff, 0.38), texture: 'particle-soft' },
      { x: width * 0.76, y: height * 0.52, scale: 0.34, alpha: 0.36, tint: lighten(theme.backgroundOrbB, 0.24), texture: 'particle-streak' }
    ];

    specs.forEach((spec, index) => {
      const element = this.add
        .image(spec.x, spec.y, spec.texture)
        .setScale(spec.scale)
        .setAlpha(spec.alpha)
        .setTint(spec.tint)
        .setBlendMode(Phaser.BlendModes.SCREEN);

      this.backgroundDecor.add(element);
      this.backgroundDecorElements.push(element);

      this.tweens.add({
        targets: element,
        x: spec.x + Phaser.Math.Between(-18, 22),
        y: spec.y + Phaser.Math.Between(-22, 18),
        angle: Phaser.Math.Between(-8, 8),
        scaleX: spec.scale * Phaser.Math.FloatBetween(0.96, 1.08),
        scaleY: spec.scale * Phaser.Math.FloatBetween(0.96, 1.1),
        alpha: Phaser.Math.Clamp(spec.alpha + Phaser.Math.FloatBetween(-0.08, 0.08), 0.18, 0.54),
        duration: Phaser.Math.Between(4200, 7000),
        ease: WARM_EASING.soft,
        yoyo: true,
        repeat: -1,
        delay: index * 180
      });
    });
  }

  private buildHud(): void {
    const theme = this.getSceneTheme();
    this.hudTop = new LiquidGlassPanel(this, 200, 100, 28, theme.panelAccent, theme.variant);
    this.hudBottom = new LiquidGlassPanel(this, 200, 100, 28, theme.panelAccent, theme.variant);
    this.thoughtPanel = new LiquidGlassPanel(this, 200, 100, 24, theme.panelAccent, theme.variant);
    this.topCenterPanel = new LiquidGlassPanel(this, 220, 54, 18, theme.panelAccent, theme.variant);
    this.actionPanel = new LiquidGlassPanel(this, 240, 60, 20, theme.panelAccent, theme.variant);
    this.playerScorePanel = new LiquidGlassPanel(this, 180, 84, 22, 0xffa9b8, theme.variant);
    this.aiScorePanel = new LiquidGlassPanel(this, 180, 84, 22, 0x8fd7be, theme.variant);
    this.streakPanel = new LiquidGlassPanel(this, 180, 84, 22, 0xffd57a, theme.variant);

    this.hudTop.setDepth(220);
    this.hudBottom.setDepth(220);
    this.thoughtPanel.setDepth(220);
    this.topCenterPanel.setDepth(224);
    this.actionPanel.setDepth(224);
    this.playerScorePanel.setDepth(224);
    this.aiScorePanel.setDepth(224);
    this.streakPanel.setDepth(224);

    this.titleText = this.add.text(0, 0, '', {
      fontFamily: DISPLAY_FONT_FAMILY,
      fontSize: '28px',
      fontStyle: '800',
      color: theme.text
    }).setDepth(250);
    this.levelText = this.add.text(0, 0, '', {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '14px',
      fontStyle: '800',
      color: theme.soft
    }).setDepth(248);
    this.detailText = this.add.text(0, 0, '', {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '13px',
      color: theme.muted
    }).setDepth(248);
    this.turnText = this.add.text(0, 0, '', {
      fontFamily: DISPLAY_FONT_FAMILY,
      fontSize: '15px',
      fontStyle: '800',
      color: theme.text
    }).setDepth(248);
    this.targetText = this.add.text(0, 0, '', {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '14px',
      fontStyle: '700',
      color: theme.text
    }).setDepth(248);
    this.playerScoreLabel = this.add.text(0, 0, '', {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '13px',
      color: theme.muted
    }).setDepth(248);
    this.playerScoreText = this.add.text(0, 0, '', {
      fontFamily: DISPLAY_FONT_FAMILY,
      fontSize: '22px',
      fontStyle: '800',
      color: theme.text
    }).setDepth(252);
    this.aiScoreLabel = this.add.text(0, 0, '', {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '13px',
      color: theme.muted
    }).setDepth(248);
    this.aiScoreText = this.add.text(0, 0, '', {
      fontFamily: DISPLAY_FONT_FAMILY,
      fontSize: '22px',
      fontStyle: '800',
      color: theme.text
    }).setDepth(252);
    this.streakLabel = this.add.text(0, 0, '', {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '13px',
      color: theme.muted
    }).setDepth(248);
    this.streakText = this.add.text(0, 0, '', {
      fontFamily: DISPLAY_FONT_FAMILY,
      fontSize: '22px',
      fontStyle: '800',
      color: theme.text
    }).setDepth(252);
    this.playerTurnsText = this.add.text(0, 0, '', {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '13px',
      color: theme.muted
    }).setDepth(248);
    this.aiTurnsText = this.add.text(0, 0, '', {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '13px',
      color: theme.muted
    }).setDepth(248);
    this.statusText = this.add.text(0, 0, '', {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '15px',
      fontStyle: '700',
      color: theme.text,
      align: 'left'
    }).setDepth(248);
    this.metaText = this.add.text(0, 0, '', {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '13px',
      color: theme.soft
    }).setDepth(248);
    this.thoughtTitleText = this.add.text(0, 0, '', {
      fontFamily: DISPLAY_FONT_FAMILY,
      fontSize: '20px',
      fontStyle: '800',
      color: theme.text
    }).setDepth(248);
    this.thoughtBodyText = this.add.text(0, 0, '', {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '14px',
      color: theme.muted,
      lineSpacing: 4
    }).setDepth(248);
    this.thoughtViz = this.add.graphics().setDepth(247);
    this.thoughtVizLabelText = this.add.text(0, 0, '', {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '13px',
      fontStyle: '800',
      color: theme.soft
    }).setDepth(248);
    this.thoughtVizMoveText = this.add.text(0, 0, '', {
      fontFamily: DISPLAY_FONT_FAMILY,
      fontSize: '16px',
      fontStyle: '800',
      color: theme.text
    }).setDepth(248);
    this.thoughtVizMetaText = this.add.text(0, 0, '', {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '13px',
      color: theme.muted
    }).setDepth(248);

    this.hintButton = new LiquidGlassButton(this, 148, 48, 0xffa5a5, theme.variant, () => {
      void this.showHint();
    });
    this.hintButton.setDepth(260);

    this.restartButton = new LiquidGlassButton(this, 132, 48, 0xffbf77, theme.variant, () => {
      this.sfx.playToggle();
      this.startLevel(this.levelId);
    });
    this.restartButton.setDepth(260);

    this.nextButton = new LiquidGlassButton(this, 156, 48, 0x8ad7b2, theme.variant, () => {
      this.startLevel(this.levelCompleted ? this.levelId + 1 : this.levelId);
    });
    this.nextButton.setDepth(260);
    this.nextButton.setVisible(false);

    this.pauseButton = new LiquidGlassButton(this, 92, 44, theme.panelAccent, theme.variant, () => {
      this.sfx.playToggle();
      this.toggleSettingsMenu();
    });
    this.pauseButton.setDepth(260);

    this.settingsMenu = new SettingsMenu(this, {
      onClose: () => this.toggleSettingsMenu(false),
      onVolumeChange: (value) => this.sfx.setVolume(value),
      onDifficultyChange: (difficulty) => {
        this.difficulty = difficulty;
        this.updateAdaptiveDepth();
        this.refreshAllText();
      },
      onThemeChange: (mode) => {
        this.themeMode = mode;
        this.applyTheme();
      },
      onLanguageChange: (language) => {
        this.language = language;
        this.refreshAllText();
        this.layoutScene();
        this.refreshSettingsMenu();
      }
    });
  }

  private startLevel(levelId: number): void {
    this.levelId = levelId;
    this.level = LevelGenerator.generate(levelId);
    this.updateAdaptiveDepth();
    this.hudTop.setAccent(this.level.accentColor);
    this.hudBottom.setAccent(this.level.accentColor);
    this.thoughtPanel.setAccent(this.level.accentColor);
    this.topCenterPanel.setAccent(this.level.accentColor);
    this.actionPanel.setAccent(this.level.accentColor);
    this.playerScorePanel.setAccent(0xffa9b8);
    this.aiScorePanel.setAccent(0x8fd7be);
    this.streakPanel.setAccent(0xffd57a);
    this.hintButton.setAccent(0xff9fb1);
    this.restartButton.setAccent(0xffbf77);
    this.nextButton.setAccent(0xffd57a);
    this.pauseButton.setAccent(this.getSceneTheme().panelAccent).setVariant(this.getSceneTheme().variant);
    this.scores = { player: 0, ai: 0 };
    this.turnsLeft = {
      player: this.level.turnsPerSide,
      ai: this.level.turnsPerSide
    };
    this.currentTurn = 'player';
    this.busy = false;
    this.levelCompleted = false;
    this.nextButton.setVisible(false);
    this.restartButton.setVisible(true);
    this.hintButton.setVisible(true);
    this.toggleSettingsMenu(false);
    this.cancelIdleHint();
    this.board?.destroy();
    this.board = new Board(
      this,
      this.level,
      async (move) => this.handlePlayerMove(move),
      {
        onValidSwap: () => this.sfx.playSwap(),
        onInvalidSwap: () => this.sfx.playInvalid(),
        onCascade: (step, index) => {
          this.sfx.playCascade(index + 1, step.cleared);

          const duration = Math.min(240, 120 + index * 36 + step.cleared * 12);
          const intensity = Math.min(0.0036, 0.0012 + index * 0.0004 + step.cleared * 0.00016);
          this.cameras.main.shake(duration, intensity);

          if (index > 0 || step.cleared >= 4) {
            const pulse = mixColor(this.level.accentColor, 0xffe4bb, 0.42);
            this.cameras.main.flash(
              Math.min(180, 80 + index * 30 + step.cleared * 10),
              (pulse >> 16) & 0xff,
              (pulse >> 8) & 0xff,
              pulse & 0xff,
              true
            );
          }
        }
      }
    );
    this.board.setPlayerInputEnabled(true);
    this.setStatus('yourTurn');
    this.thoughtState = { mode: 'info' };
    this.layoutScene();
    this.applyTheme();
    this.refreshAllText();
    this.refreshSettingsMenu();
    this.scheduleIdleHint();
  }

  private layoutScene(): void {
    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;
    const safe = 20;
    this.landscape = width >= height;

    let boardBounds: Phaser.Geom.Rectangle;
    let thoughtBounds: Phaser.Geom.Rectangle;

    this.background.clear();
    const theme = this.getSceneTheme();
    this.background.fillGradientStyle(
      theme.background,
      mixColor(theme.background, theme.backgroundOrbA, 0.12),
      mixColor(theme.background, theme.backgroundOrbB, 0.2),
      mixColor(theme.background, theme.backgroundOrbC, 0.22),
      1,
      1,
      1,
      1
    );
    this.background.fillRect(0, 0, width, height);
    this.background.fillStyle(0xffffff, 0.18).fillEllipse(width * 0.18, height * 0.16, width * 0.36, height * 0.24);
    this.background.fillStyle(theme.backgroundOrbA, 0.2).fillEllipse(width * 0.16, height * 0.18, width * 0.3, height * 0.2);
    this.background.fillStyle(theme.backgroundOrbB, 0.18).fillEllipse(width * 0.82, height * 0.72, width * 0.34, height * 0.26);
    this.background.fillStyle(theme.backgroundOrbC, 0.12).fillEllipse(width * 0.54, height * 0.84, width * 0.44, height * 0.18);
    this.background.fillStyle(0xffffff, 0.56).fillRoundedRect(12, 12, width - 24, height - 24, 30);
    this.background.lineStyle(2, 0xffffff, 0.42).strokeRoundedRect(12, 12, width - 24, height - 24, 30);
    this.refreshBackgroundDecor(width, height, theme);

    if (this.landscape) {
      const topHeight = 82;
      const footerHeight = 82;
      const sideWidth = Math.min(312, Math.max(286, width * 0.21));
      const topRect = new Phaser.Geom.Rectangle(18, 18, width - 36, topHeight);
      const footerRect = new Phaser.Geom.Rectangle(18, height - footerHeight - 18, width - 36, footerHeight);
      boardBounds = new Phaser.Geom.Rectangle(
        safe + 48,
        topRect.bottom + 22,
        width - sideWidth - safe * 4 - 64,
        height - topRect.height - footerRect.height - 56
      );
      const thoughtHeight = Math.min(372, Math.max(308, boardBounds.height * 0.86));
      thoughtBounds = new Phaser.Geom.Rectangle(
        boardBounds.right + safe + 10,
        boardBounds.centerY - thoughtHeight * 0.5,
        sideWidth,
        thoughtHeight
      );

      this.hudTop.resize(topRect.x, topRect.y, topRect.width, topRect.height, 28);
      this.hudBottom.resize(footerRect.x, footerRect.y, footerRect.width, footerRect.height, 28);
      this.thoughtPanel.resize(thoughtBounds.x, thoughtBounds.y, thoughtBounds.width, thoughtBounds.height, 24);
      this.topCenterPanel.resize(topRect.centerX - 132, topRect.y + 12, 264, 48, 18);
      this.actionPanel.resize(footerRect.right - 308, footerRect.y + 11, 290, 60, 20);
      this.playerScorePanel.resize(footerRect.x + 14, footerRect.y + 12, 118, 58, 18);
      this.aiScorePanel.resize(footerRect.x + 142, footerRect.y + 12, 118, 58, 18);
      this.streakPanel.resize(footerRect.x + 270, footerRect.y + 12, 118, 58, 18);

      this.titleText.setPosition(34, 28);
      this.levelText.setPosition(34, 56);
      this.detailText.setVisible(false);
      this.turnText.setPosition(topRect.centerX, topRect.y + 22).setOrigin(0.5, 0);
      this.targetText.setPosition(topRect.centerX, topRect.y + 42).setOrigin(0.5, 0);
      this.pauseButton.setPosition(width - 72, 58);

      this.playerScoreLabel.setPosition(footerRect.x + 28, footerRect.y + 22);
      this.playerScoreText.setPosition(footerRect.x + 28, footerRect.y + 40);
      this.playerTurnsText.setPosition(footerRect.x + 28, footerRect.y + 56);
      this.aiScoreLabel.setPosition(footerRect.x + 156, footerRect.y + 22);
      this.aiScoreText.setPosition(footerRect.x + 156, footerRect.y + 40);
      this.aiTurnsText.setPosition(footerRect.x + 156, footerRect.y + 56);
      this.streakLabel.setPosition(footerRect.x + 284, footerRect.y + 22);
      this.streakText.setPosition(footerRect.x + 284, footerRect.y + 40);
      this.hintButton.setPosition(footerRect.right - 214, footerRect.centerY);
      this.restartButton.setPosition(footerRect.right - 86, footerRect.centerY);
      this.nextButton.setPosition(footerRect.right - 86, footerRect.centerY);
      this.thoughtTitleText.setPosition(thoughtBounds.x + 18, thoughtBounds.y + 18);
      this.thoughtBodyText
        .setPosition(thoughtBounds.x + 18, thoughtBounds.y + 66)
        .setWordWrapWidth(thoughtBounds.width - 36)
        .setFixedSize(thoughtBounds.width - 36, 56);
      this.thoughtVizLabelText.setPosition(thoughtBounds.x + 18, thoughtBounds.y + 158);
      this.thoughtVizMoveText.setPosition(thoughtBounds.x + 18, thoughtBounds.y + 178);
      this.thoughtVizMetaText
        .setPosition(thoughtBounds.x + 18, thoughtBounds.y + 204)
        .setWordWrapWidth(thoughtBounds.width - 36)
        .setFixedSize(thoughtBounds.width - 36, 44);
      this.statusText
        .setPosition(thoughtBounds.x + 18, thoughtBounds.bottom - 98)
        .setWordWrapWidth(thoughtBounds.width - 36)
        .setFixedSize(thoughtBounds.width - 36, 36);
      this.metaText
        .setPosition(thoughtBounds.x + 18, thoughtBounds.bottom - 56)
        .setWordWrapWidth(thoughtBounds.width - 36)
        .setFixedSize(thoughtBounds.width - 36, 28);
      this.statusText.setVisible(true);
      this.metaText.setVisible(true);
    } else {
      const topHeight = 146;
      const footerHeight = 250;
      const topRect = new Phaser.Geom.Rectangle(14, 14, width - 28, topHeight);
      const footerRect = new Phaser.Geom.Rectangle(14, height - footerHeight - 14, width - 28, footerHeight);
      boardBounds = new Phaser.Geom.Rectangle(
        safe,
        topRect.bottom + 14,
        width - safe * 2,
        footerRect.y - topRect.bottom - 28
      );
      thoughtBounds = new Phaser.Geom.Rectangle(
        footerRect.x,
        footerRect.y + 76,
        footerRect.width,
        footerRect.height - 90
      );

      this.hudTop.resize(topRect.x, topRect.y, topRect.width, topRect.height, 28);
      this.hudBottom.resize(footerRect.x, footerRect.y, footerRect.width, footerRect.height, 28);
      this.thoughtPanel.resize(thoughtBounds.x, thoughtBounds.y, thoughtBounds.width, thoughtBounds.height, 24);
      this.topCenterPanel.resize(footerRect.x + 18, topRect.y + 86, topRect.width - 36, 46, 18);
      this.actionPanel.resize(footerRect.right - 268, footerRect.y + 102, 250, 58, 20);
      this.playerScorePanel.resize(footerRect.x + 14, footerRect.y + 16, footerRect.width / 3 - 18, 78, 22);
      this.aiScorePanel.resize(footerRect.x + footerRect.width / 3 + 2, footerRect.y + 16, footerRect.width / 3 - 18, 78, 22);
      this.streakPanel.resize(footerRect.x + (footerRect.width / 3) * 2 - 10, footerRect.y + 16, footerRect.width / 3 - 18, 78, 22);

      this.titleText.setPosition(28, 28);
      this.levelText.setPosition(28, 70);
      this.detailText.setVisible(false);
      this.turnText.setPosition(topRect.centerX, topRect.y + 96).setOrigin(0.5, 0);
      this.targetText.setPosition(topRect.centerX, topRect.y + 116).setOrigin(0.5, 0);
      this.pauseButton.setPosition(width - 72, 108);

      this.playerScoreLabel.setPosition(footerRect.x + 28, footerRect.y + 24);
      this.playerScoreText.setPosition(footerRect.x + 28, footerRect.y + 44);
      this.playerTurnsText.setPosition(footerRect.x + 28, footerRect.y + 68);
      this.aiScoreLabel.setPosition(footerRect.centerX - 46, footerRect.y + 24);
      this.aiScoreText.setPosition(footerRect.centerX - 46, footerRect.y + 44);
      this.aiTurnsText.setPosition(footerRect.centerX - 46, footerRect.y + 68);
      this.streakLabel.setPosition(footerRect.right - 132, footerRect.y + 24);
      this.streakText.setPosition(footerRect.right - 132, footerRect.y + 44);
      this.hintButton.setPosition(footerRect.right - 178, footerRect.y + 130);
      this.restartButton.setPosition(footerRect.right - 64, footerRect.y + 130);
      this.nextButton.setPosition(footerRect.right - 64, footerRect.y + 130);
      this.thoughtTitleText.setPosition(thoughtBounds.x + 18, thoughtBounds.y + 14);
      this.thoughtBodyText
        .setPosition(thoughtBounds.x + 18, thoughtBounds.y + 48)
        .setWordWrapWidth(thoughtBounds.width - 36)
        .setFixedSize(thoughtBounds.width - 36, 60);
      this.thoughtVizLabelText.setPosition(thoughtBounds.x + 18, thoughtBounds.y + 128);
      this.thoughtVizMoveText.setPosition(thoughtBounds.x + 18, thoughtBounds.y + 148);
      this.thoughtVizMetaText
        .setPosition(thoughtBounds.x + 18, thoughtBounds.y + 176)
        .setWordWrapWidth(thoughtBounds.width - 36)
        .setFixedSize(thoughtBounds.width - 36, 40);
      this.statusText
        .setPosition(thoughtBounds.x + 18, footerRect.y + 226)
        .setWordWrapWidth(thoughtBounds.width - 36)
        .setFixedSize(thoughtBounds.width - 36, 38);
      this.metaText
        .setPosition(thoughtBounds.x + 18, footerRect.bottom - 42)
        .setWordWrapWidth(thoughtBounds.width - 36)
        .setFixedSize(thoughtBounds.width - 36, 24);
      this.statusText.setVisible(true);
      this.metaText.setVisible(true);
    }

    this.thoughtPanelBounds = new Phaser.Geom.Rectangle(
      thoughtBounds.x,
      thoughtBounds.y,
      thoughtBounds.width,
      thoughtBounds.height
    );
    this.statusText.setWordWrapWidth(
      this.landscape ? thoughtBounds.width - 36 : thoughtBounds.width - 36
    );

    if (this.board) {
      const cellSize = Math.floor(
        Math.min(boardBounds.width / this.level.cols, boardBounds.height / this.level.rows)
      );
      const boardWidth = cellSize * this.level.cols;
      const boardHeight = cellSize * this.level.rows;
      const layout: BoardLayout = {
        x: boardBounds.centerX - boardWidth / 2 + cellSize / 2,
        y: boardBounds.centerY - boardHeight / 2 + cellSize / 2,
        cellSize,
        width: boardWidth,
        height: boardHeight
      };

      this.board.resize(layout);
    }

    this.settingsMenu.layout(width, height, this.landscape);
    this.refreshThoughtVisualization();
  }

  private async handlePlayerMove(move: Move): Promise<boolean> {
    if (!this.board || this.currentTurn !== 'player' || this.busy || this.turnsLeft.player <= 0) {
      return false;
    }

    this.cancelIdleHint();
    this.busy = true;
    const resolution = await this.board.performMove(move, 'player');
    this.busy = false;

    if (!resolution) {
      this.board.setPlayerInputEnabled(true);
      this.scheduleIdleHint();
      return true;
    }

    this.applyTurnResult(resolution.owner, resolution.result.totalScore);
    this.thoughtState = { mode: 'info' };
    this.metaText.setText(
      translate(this.language, 'playerChain', {
        score: resolution.result.totalScore,
        cascades: resolution.result.cascades
      })
    );
    await this.finishTurnFlow('player');
    return true;
  }

  private async runAITurn(): Promise<void> {
    if (!this.board || this.currentTurn !== 'ai' || this.busy || this.turnsLeft.ai <= 0) {
      return;
    }

    this.busy = true;
    const decision = this.ai.analyzeMove(this.board.getSnapshot(), 'ai', this.scores);

    if (!decision) {
      this.setStatus('aiStalled');
      this.busy = false;
      return;
    }

    this.setStatus('aiThinking');
    await this.visualizeDecision(decision);
    const resolution = await this.board.performMove(decision.selected.move, 'ai');
    this.busy = false;

    if (resolution) {
      this.applyTurnResult('ai', resolution.result.totalScore);
      this.metaText.setText(
        translate(this.language, 'aiChain', {
          score: resolution.result.totalScore,
          cascades: resolution.result.cascades
        })
      );
      await this.finishTurnFlow('ai');
    }
  }

  private async visualizeDecision(decision: AIDecision): Promise<void> {
    const candidates = decision.candidates.slice(0, Math.min(3, decision.candidates.length));

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      this.thoughtState = {
        mode: 'decision',
        preview: candidate,
        depth: decision.depthUsed,
        candidateIndex: index,
        selected: candidate === decision.selected
      };
      this.board?.showMovePreview(
        candidate.move,
        candidate.previewCells,
        candidate === decision.selected ? 0xffcf75 : 0xffa4b8
      );
      this.sfx.playAiFocus(index);
      this.refreshAllText();
      await this.wait(candidate === decision.selected ? 320 : 240);
    }
  }

  private async showHint(): Promise<void> {
    if (!this.board || this.currentTurn !== 'player' || this.busy) {
      return;
    }

    const decision = this.ai.analyzeMove(this.board.getSnapshot(), 'player', this.scores);
    const hint = decision?.selected;

    if (!hint || !decision) {
      this.setStatus('noHint');
      return;
    }

    this.board.showHint(hint.move);
    this.board.showMovePreview(hint.move, hint.previewCells, this.level.accentColor);
    this.thoughtState = { mode: 'hint', preview: hint, depth: decision.depthUsed };
    this.sfx.playHint();
    this.setStatus('hintShown');
    this.refreshAllText();
    this.scheduleIdleHint();
  }

  private applyTurnResult(owner: PlayerSide, scoreDelta: number): void {
    this.scores[owner] += scoreDelta;
    this.turnsLeft[owner] = Math.max(0, this.turnsLeft[owner] - 1);

    if (scoreDelta > 0) {
      if (owner === 'player') {
        this.pulseMetric(this.playerScoreText, this.mixColor(0xffa9b8, 0xffd57a, Math.min(1, this.scores.player / this.level.targetScore)), scoreDelta);
      } else {
        this.pulseMetric(this.aiScoreText, this.mixColor(0x8fd7be, 0xffc587, Math.min(1, this.scores.ai / this.level.targetScore)), scoreDelta);
      }
    }
  }

  private async finishTurnFlow(previousOwner: PlayerSide): Promise<void> {
    this.refreshAllText();

    const cleanClear =
      this.scores.player >= this.scores.ai && this.scores.player >= this.level.targetScore;

    if (this.turnsLeft.player === 0 && this.turnsLeft.ai === 0) {
      this.levelCompleted = cleanClear;
      const previousStreak = this.playerWinStreak;
      this.playerWinStreak = cleanClear ? this.playerWinStreak + 1 : 0;
      this.updateAdaptiveDepth();
      if (this.playerWinStreak !== previousStreak) {
        this.pulseMetric(this.streakText, this.mixColor(0xffb0a7, 0xffd57a, Math.min(1, this.playerWinStreak / 5)), this.playerWinStreak);
      }
      this.board?.setPlayerInputEnabled(false);
      this.hintButton.setVisible(false);
      this.restartButton.setVisible(false);
      this.nextButton.setVisible(true);
      this.nextButton.setLabel(translate(this.language, cleanClear ? 'nextLevel' : 'retry'));

      if (cleanClear) {
        this.sfx.playVictory();
        await this.playVictoryCelebration();
      } else {
        this.sfx.playDefeat();
      }

      this.setStatus(
        cleanClear
          ? 'levelClear'
          : this.scores.player >= this.scores.ai
            ? 'levelRetryWin'
            : 'levelRetryLose'
      );
      this.thoughtState = { mode: 'info' };
      this.refreshAllText();
      return;
    }

    const nextTurn = this.nextTurn(previousOwner);
    this.currentTurn = nextTurn;

    if (nextTurn === 'player') {
      this.board?.setPlayerInputEnabled(true);
      this.thoughtState = { mode: 'info' };
      this.setStatus('yourTurnShort');
      this.refreshAllText();
      this.scheduleIdleHint();
      return;
    }

    this.board?.setPlayerInputEnabled(false);
    this.setStatus('aiTurn');
    this.refreshAllText();
    await this.wait(this.level.aiThinkTime);
    await this.runAITurn();
  }

  private nextTurn(previousOwner: PlayerSide): PlayerSide {
    const preferred = previousOwner === 'player' ? 'ai' : 'player';

    if (this.turnsLeft[preferred] > 0) {
      return preferred;
    }

    return previousOwner;
  }

  private setStatus(key: string, params: Record<string, string | number> = {}): void {
    this.statusState = { key, params };
    this.statusText.setText(translate(this.language, key, params));
  }

  private refreshAllText(): void {
    if (!this.level) {
      return;
    }

    this.titleText.setText(translate(this.language, 'title'));
    this.levelText.setText(this.level.name);
    this.detailText.setText(this.getLevelDescription());
    this.turnText.setText(
      translate(this.language, this.currentTurn === 'player' ? 'turnPlayer' : 'turnAi')
    );
    this.targetText
      .setOrigin(this.landscape ? 0 : 1, 0)
      .setText(translate(this.language, 'target', { score: this.level.targetScore }));
    this.playerScoreLabel.setText(translate(this.language, 'sidePlayer'));
    this.playerScoreText.setText(String(this.scores.player));
    this.playerTurnsText.setText(
      translate(this.language, 'roundsLeft', { count: this.turnsLeft.player })
    );
    this.aiScoreLabel.setText(translate(this.language, 'sideAi'));
    this.aiScoreText.setText(String(this.scores.ai));
    this.aiTurnsText.setText(
      translate(this.language, 'roundsLeft', { count: this.turnsLeft.ai })
    );
    this.streakLabel.setText(translate(this.language, 'streak'));
    this.streakText.setText(String(this.playerWinStreak));
    this.hintButton.setLabel(translate(this.language, 'hint'));
    this.restartButton.setLabel(translate(this.language, 'restart'));
    this.nextButton.setLabel(translate(this.language, this.levelCompleted ? 'nextLevel' : 'retry'));
    this.pauseButton.setLabel(translate(this.language, 'pause'));
    this.statusText.setText(
      translate(this.language, this.statusState.key, this.statusState.params ?? {})
    );
    this.metaText.setText(this.getMetaText());
    this.refreshScoreStyles();
    this.refreshThoughtPanel();
    this.refreshSettingsMenu();
    this.refreshThoughtVisualization();
  }

  private refreshThoughtPanel(): void {
    if (this.thoughtState.mode === 'hint') {
      this.thoughtTitleText.setText(translate(this.language, 'hintPanelTitle'));
      this.thoughtBodyText.setText(
        this.buildThoughtText(this.thoughtState.preview, this.thoughtState.depth, true)
      );
      return;
    }

    if (this.thoughtState.mode === 'decision') {
      this.thoughtTitleText.setText(translate(this.language, 'decisionTitle'));
      this.thoughtBodyText.setText(
        this.buildThoughtText(
          this.thoughtState.preview,
          this.thoughtState.depth,
          false,
          this.thoughtState.candidateIndex + 1,
          this.thoughtState.selected
        )
      );
      return;
    }

    this.thoughtTitleText.setText(translate(this.language, 'decisionTitle'));
    this.thoughtBodyText.setText(
      this.landscape
        ? [
            translate(this.language, 'adaptiveDepth', { depth: this.ai.getSearchDepth() }),
            translate(this.language, this.currentTurn === 'player' ? 'hintShown' : 'aiThinking')
          ].join('\n')
        : [
            translate(this.language, 'adaptiveDepth', { depth: this.ai.getSearchDepth() }),
            translate(this.language, 'decisionDepth', {
              depth: this.ai.getSearchDepth(),
              streak: this.playerWinStreak
            }),
            translate(this.language, this.landscape ? 'landscapeHelp' : 'portraitHelp'),
            translate(this.language, 'tapHelp')
          ].join('\n')
    );
  }

  private refreshThoughtVisualization(): void {
    if (!this.thoughtPanelBounds || !this.level) {
      this.thoughtViz.clear();
      this.thoughtVizLabelText.setText('');
      this.thoughtVizMoveText.setText('');
      this.thoughtVizMetaText.setText('');
      return;
    }

    const bounds = this.thoughtPanelBounds;
    const insetX = bounds.x + 18;
    const cardWidth = bounds.width - 36;
    const headerY = bounds.y + 56;
    const summaryCard = new Phaser.Geom.Rectangle(insetX, headerY, cardWidth, 66);
    const visualCard = new Phaser.Geom.Rectangle(insetX, headerY + 92, cardWidth, 92);
    const stateCard = new Phaser.Geom.Rectangle(insetX, bounds.bottom - 92, cardWidth, 66);
    const preview =
      this.thoughtState.mode === 'hint' || this.thoughtState.mode === 'decision'
        ? this.thoughtState.preview
        : undefined;
    const moveLabel = preview
      ? `${formatMoveLabel(preview.move.from.row, preview.move.from.col)} -> ${formatMoveLabel(preview.move.to.row, preview.move.to.col)}`
      : translate(this.language, this.currentTurn === 'player' ? 'hint' : 'decisionTitle');
    const scoreRatio = preview
      ? Phaser.Math.Clamp(preview.totalScore / Math.max(480, this.level.targetScore * 0.36), 0.08, 1)
      : Phaser.Math.Clamp(this.ai.getSearchDepth() / 6, 0.12, 1);
    const comboRatio = preview
      ? Phaser.Math.Clamp(preview.cascades / 5, 0.08, 1)
      : Phaser.Math.Clamp(this.playerWinStreak / 5, 0.06, 1);
    const accent = this.landscape ? this.mixColor(this.level.accentColor, 0xffffff, 0.18) : this.level.accentColor;
    const scoreText = preview
      ? `${translate(this.language, 'scoreShort')} ${preview.totalScore}   ${translate(this.language, 'cascadeShort')} ${preview.cascades}`
      : `${translate(this.language, 'difficulty')} ${translate(this.language, this.difficulty)}   ${translate(this.language, 'adaptiveDepth', { depth: this.ai.getSearchDepth() })}`;
    const metaText = preview
      ? formatPatternSummary(this.language, preview.patterns)
      : translate(this.language, this.currentTurn === 'player' ? 'tapHelp' : 'aiThinking');
    const stateText =
      this.currentTurn === 'player'
        ? translate(this.language, 'yourTurnShort')
        : translate(this.language, 'aiTurn');
    const footerText = `${translate(this.language, 'adaptiveDepth', { depth: this.ai.getSearchDepth() })} · ${translate(this.language, this.landscape ? 'landscapeHelp' : 'portraitHelp')}`;

    this.thoughtViz.clear();
    this.thoughtViz
      .fillStyle(0xfffbf7, 0.84)
      .fillRoundedRect(summaryCard.x, summaryCard.y, summaryCard.width, summaryCard.height, 18)
      .lineStyle(1, mixColor(accent, 0xffffff, 0.42), 0.9)
      .strokeRoundedRect(summaryCard.x, summaryCard.y, summaryCard.width, summaryCard.height, 18)
      .fillStyle(0xfffaf4, 0.78)
      .fillRoundedRect(visualCard.x, visualCard.y, visualCard.width, visualCard.height, 18)
      .lineStyle(1, mixColor(accent, 0xffffff, 0.35), 0.86)
      .strokeRoundedRect(visualCard.x, visualCard.y, visualCard.width, visualCard.height, 18)
      .fillStyle(0xfffbf7, 0.84)
      .fillRoundedRect(stateCard.x, stateCard.y, stateCard.width, stateCard.height, 18)
      .lineStyle(1, mixColor(accent, 0xffffff, 0.42), 0.9)
      .strokeRoundedRect(stateCard.x, stateCard.y, stateCard.width, stateCard.height, 18)
      .fillStyle(0xf3ddd2, 0.9)
      .fillRoundedRect(visualCard.x + 14, visualCard.y + visualCard.height - 24, visualCard.width - 28, 6, 3)
      .fillStyle(accent, 0.9)
      .fillRoundedRect(
        visualCard.x + 14,
        visualCard.y + visualCard.height - 24,
        (visualCard.width - 28) * scoreRatio,
        6,
        3
      )
      .fillStyle(this.mixColor(accent, 0x8fd7be, 0.32), 0.46)
      .fillRoundedRect(
        visualCard.x + 14,
        visualCard.y + visualCard.height - 12,
        (visualCard.width - 28) * comboRatio,
        4,
        2
      );

    this.thoughtVizLabelText.setText(translate(this.language, 'aiVisual'));
    this.thoughtVizMoveText.setText(moveLabel);
    this.thoughtVizMetaText.setText(`${scoreText}\n${metaText}`);
    this.thoughtBodyText.setText(this.thoughtBodyText.text.split('\n').slice(0, 2).join('\n'));
    this.statusText.setText(stateText);
    this.metaText.setText(footerText);
  }

  private buildThoughtText(
    preview: ThoughtPreview,
    depth: number,
    isHint: boolean,
    candidateIndex = 1,
    selected = false
  ): string {
    if (this.landscape) {
      return [
        translate(
          this.language,
          isHint ? 'decisionHint' : selected ? 'decisionSelected' : 'decisionTitle'
        ),
        `${formatMoveLabel(preview.move.from.row, preview.move.from.col)} -> ${formatMoveLabel(preview.move.to.row, preview.move.to.col)}`,
        `${translate(this.language, 'scoreShort')} ${preview.totalScore} · ${translate(this.language, 'cascadeShort')} ${preview.cascades}`
      ].join('\n');
    }

    const lines = [
      translate(this.language, 'decisionDepth', {
        depth,
        streak: this.playerWinStreak
      }),
      translate(this.language, 'decisionCandidate', {
        index: candidateIndex,
        score: preview.totalScore,
        evalScore: Math.round(preview.composite)
      }),
      translate(this.language, 'decisionPatterns', {
        patterns: formatPatternSummary(this.language, preview.patterns),
        cascades: preview.cascades
      }),
      translate(this.language, 'decisionMove', {
        from: formatMoveLabel(preview.move.from.row, preview.move.from.col),
        to: formatMoveLabel(preview.move.to.row, preview.move.to.col)
      })
    ];

    lines.unshift(
      translate(
        this.language,
        isHint ? 'decisionHint' : selected ? 'decisionSelected' : 'decisionTitle'
      )
    );

    return lines.join('\n');
  }

  private getLevelDescription(): string {
    if (this.language === 'zh') {
      return `${this.level.rows}x${this.level.cols} 棋盘 / ${this.level.colorCount} 种积极元素 / 每方 ${this.level.turnsPerSide} 回合`;
    }

    return `${this.level.rows}x${this.level.cols} board / ${this.level.colorCount} uplifting tile types / ${this.level.turnsPerSide} rounds per side`;
  }

  private getMetaText(): string {
    return translate(this.language, 'adaptiveDepth', { depth: this.ai.getSearchDepth() });
  }

  private getSceneTheme(): SceneTheme {
    const accent = this.level?.accentColor ?? JOYFUL_SURFACE.apricot;

    if (this.themeMode === 'dark') {
      return {
        mode: 'dark',
        variant: 'dark',
        background: 0x231b32,
        backgroundOrbA: 0x6b597e,
        backgroundOrbB: 0x3d6a61,
        backgroundOrbC: 0x855c6f,
        accent,
        text: '#fff6ef',
        muted: '#d6c8dd',
        soft: '#f2d9d2',
        panelAccent: mixColor(accent, 0xffffff, 0.12)
      };
    }

    return {
      mode: 'light',
      variant: 'light',
      background: 0xfff3ee,
      backgroundOrbA: 0xffdbe9,
      backgroundOrbB: 0xcdf1df,
      backgroundOrbC: 0xddeaff,
      accent,
      text: '#5d4a64',
      muted: '#856f83',
      soft: '#aa8878',
      panelAccent: mixColor(accent, 0xffffff, 0.42)
    };
  }

  private applyTheme(): void {
    const theme = this.getSceneTheme();
    const scoreLabelColor = theme.mode === 'light' ? '#8a7688' : '#e2d7e6';

    this.hudTop.setAccent(theme.panelAccent).setVariant(theme.variant);
    this.hudBottom.setAccent(theme.panelAccent).setVariant(theme.variant);
    this.thoughtPanel.setAccent(theme.panelAccent).setVariant(theme.variant);
    this.topCenterPanel.setAccent(theme.panelAccent).setVariant(theme.variant);
    this.actionPanel.setAccent(theme.panelAccent).setVariant(theme.variant);
    this.playerScorePanel.setVariant(theme.variant);
    this.aiScorePanel.setVariant(theme.variant);
    this.streakPanel.setVariant(theme.variant);
    this.hintButton.setVariant(theme.variant);
    this.restartButton.setVariant(theme.variant);
    this.nextButton.setVariant(theme.variant);
    this.pauseButton.setAccent(theme.panelAccent).setVariant(theme.variant);

    [
      this.titleText,
      this.turnText,
      this.targetText,
      this.playerScoreText,
      this.aiScoreText,
      this.streakText,
      this.statusText,
      this.thoughtTitleText
    ].forEach((text) => text.setColor(theme.text));

    [
      this.levelText,
      this.metaText,
      this.thoughtVizLabelText
    ].forEach((text) => text.setColor(theme.soft));

    [
      this.detailText,
      this.playerScoreLabel,
      this.aiScoreLabel,
      this.streakLabel,
      this.playerTurnsText,
      this.aiTurnsText,
      this.thoughtBodyText,
      this.thoughtVizMetaText
    ].forEach((text) => text.setColor(scoreLabelColor));

    this.thoughtVizMoveText.setColor(theme.text);

    this.settingsMenu.applyTheme(theme.panelAccent, theme.variant);
    this.layoutScene();

    if (this.level) {
      this.refreshScoreStyles();
      this.refreshSettingsMenu();
    }
  }

  private refreshSettingsMenu(): void {
    this.settingsMenu
      .setLabels({
        title: translate(this.language, 'settings'),
        volume: translate(this.language, 'volume'),
        difficulty: translate(this.language, 'difficulty'),
        theme: translate(this.language, 'theme'),
        language: translate(this.language, 'language'),
        close: translate(this.language, 'close'),
        easy: translate(this.language, 'easy'),
        normal: translate(this.language, 'normal'),
        hard: translate(this.language, 'hard'),
        themeLight: translate(this.language, 'themeLight'),
        themeDark: translate(this.language, 'themeDark'),
        langZh: translate(this.language, 'langZh'),
        langEn: translate(this.language, 'langEn')
      })
      .setVolume(this.sfx.getVolume())
      .setDifficulty(this.difficulty)
      .setTheme(this.themeMode)
      .setLanguage(this.language);
  }

  private toggleSettingsMenu(open = !this.menuOpen): void {
    this.menuOpen = open;
    this.settingsMenu.setVisible(open);
    this.board?.setPlayerInputEnabled(!open && this.currentTurn === 'player' && !this.busy && !this.levelCompleted);
    this.hintButton.root.setAlpha(open ? 0.45 : 1);
    this.restartButton.root.setAlpha(open ? 0.45 : 1);
    this.nextButton.root.setAlpha(open ? 0.45 : 1);
    this.pauseButton.root.setAlpha(open ? 0.9 : 1);
  }

  private updateAdaptiveDepth(): void {
    const profile: Record<DifficultyMode, { base: number; cap: number }> = {
      easy: { base: 1, cap: 4 },
      normal: { base: 2, cap: 5 },
      hard: { base: 3, cap: 6 }
    };
    const current = profile[this.difficulty];

    this.ai.setSearchDepth(Math.min(current.cap, current.base + this.playerWinStreak));
  }

  private scheduleIdleHint(): void {
    this.cancelIdleHint();

    if (this.currentTurn !== 'player' || this.busy) {
      return;
    }

    this.idleHintTimer = this.time.delayedCall(5200, () => {
      void this.showHint();
    });
  }

  private cancelIdleHint(): void {
    this.idleHintTimer?.remove(false);
    this.idleHintTimer = undefined;
  }

  private refreshScoreStyles(): void {
    const playerRatio = Math.min(1, this.scores.player / Math.max(1, this.level.targetScore));
    const aiRatio = Math.min(1, this.scores.ai / Math.max(1, this.level.targetScore));
    const streakRatio = Math.min(1, this.playerWinStreak / 5);

    const playerColor = this.mixColor(0xffa9b8, 0xffd57a, playerRatio);
    const aiColor = this.mixColor(0x8fd7be, 0xffb27d, aiRatio);
    const streakColor = this.mixColor(0xffb1a5, 0xffd57a, streakRatio);

    this.playerScoreText.setColor(this.hexToCss(playerColor));
    this.aiScoreText.setColor(this.hexToCss(aiColor));
    this.streakText.setColor(this.hexToCss(streakColor));
    this.playerScorePanel.setAccent(playerColor);
    this.aiScorePanel.setAccent(aiColor);
    this.streakPanel.setAccent(streakColor);
    this.hudTop.setAccent(this.getSceneTheme().panelAccent);
    this.hudBottom.setAccent(this.getSceneTheme().panelAccent);
    this.thoughtPanel.setAccent(this.getSceneTheme().panelAccent);
    this.hintButton.setAccent(playerColor);
    this.restartButton.setAccent(this.mixColor(0xffbf77, this.level.accentColor, 0.2));
    this.nextButton.setAccent(streakColor);
  }

  private async playVictoryCelebration(): Promise<void> {
    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;
    const camera = this.cameras.main;
    const previousTweenScale = this.tweens.timeScale;
    const previousTimeScale = this.time.timeScale;
    const overlay = this.add.graphics().setDepth(380);
    const bloom = this.add
      .image(width * 0.5, height * 0.46, 'particle-soft')
      .setTint(this.level.accentColor)
      .setAlpha(0.18)
      .setScale(4.8)
      .setDepth(381)
      .setBlendMode(Phaser.BlendModes.ADD);
    const fireworks = this.add.particles(width * 0.5, height * 0.44, 'particle-soft', {
      speed: { min: 120, max: 360 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 900,
      blendMode: Phaser.BlendModes.SCREEN,
      tint: [this.level.accentColor, 0xffd57a, 0xffb3be, 0xffffff]
    }).setDepth(382);
    const streamers = this.add.particles(0, 0, 'particle-petal', {
      x: { min: width * 0.18, max: width * 0.82 },
      y: height * 0.12,
      speedY: { min: 120, max: 240 },
      speedX: { min: -80, max: 80 },
      scale: { start: 0.28, end: 0.04 },
      alpha: { start: 0.86, end: 0 },
      lifespan: 1100,
      blendMode: Phaser.BlendModes.SCREEN,
      tint: [this.level.accentColor, 0xffd57a, 0xffa9b8, 0x8fd7be]
    }).setDepth(382);

    this.tweens.timeScale = 0.7;
    this.time.timeScale = 0.7;
    camera.shake(360, 0.0042);
    camera.flash(200, 255, 232, 205, true);
    fireworks.explode(48, width * 0.5, height * 0.44);
    streamers.explode(36, width * 0.5, height * 0.2);

    overlay.fillStyle(this.level.accentColor, 0.08).fillRect(0, 0, width, height);

    this.tweens.add({
      targets: bloom,
      scaleX: 8.2,
      scaleY: 8.2,
      alpha: 0,
      duration: 720,
      ease: WARM_EASING.lift,
      onComplete: () => bloom.destroy()
    });

    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 760,
      ease: WARM_EASING.reveal,
      onComplete: () => overlay.destroy()
    });

    await this.wait(760);
    fireworks.destroy();
    streamers.destroy();
    this.tweens.timeScale = previousTweenScale;
    this.time.timeScale = previousTimeScale;
  }

  private pulseMetric(target: Phaser.GameObjects.Text, color: number, value: number): void {
    this.tweens.killTweensOf(target);
    this.tweens.add({
      targets: target,
      scaleX: 1.16,
      scaleY: 1.16,
      duration: 160,
      yoyo: true,
      ease: WARM_EASING.settle
    });

    const popup = this.add
      .text(target.x + target.width + 12, target.y + 2, `+${value}`, {
        fontFamily: DISPLAY_FONT_FAMILY,
        fontSize: '18px',
        fontStyle: '800',
        color: this.hexToCss(color)
      })
      .setOrigin(0, 0.5)
      .setDepth(260);

    this.tweens.add({
      targets: popup,
      y: popup.y - 28,
      alpha: 0,
      duration: 520,
      ease: WARM_EASING.reveal,
      onComplete: () => popup.destroy()
    });

    for (let index = 0; index < 5; index += 1) {
      const mote = this.add
        .image(
          target.x + Phaser.Math.Between(-8, Math.max(12, Math.floor(target.width * 0.7))),
          target.y + Phaser.Math.Between(-8, 12),
          index % 2 === 0 ? 'particle-soft' : index % 3 === 0 ? 'particle-heart' : 'particle-petal'
        )
        .setTint(index % 2 === 0 ? color : this.lighten(color, 0.28))
        .setAlpha(0.88)
        .setScale(index % 2 === 0 ? 0.18 : 0.16)
        .setDepth(258)
        .setBlendMode(Phaser.BlendModes.SCREEN);

      this.tweens.add({
        targets: mote,
        x: mote.x + Phaser.Math.Between(-18, 18),
        y: mote.y - Phaser.Math.Between(18, 42),
        alpha: 0,
        scaleX: 0.02,
        scaleY: 0.02,
        duration: Phaser.Math.Between(260, 420),
        ease: WARM_EASING.lift,
        onComplete: () => mote.destroy()
      });
    }
  }

  private lighten(hex: number, factor: number): number {
    const r = (hex >> 16) & 0xff;
    const g = (hex >> 8) & 0xff;
    const b = hex & 0xff;

    return (
      ((Math.round(r + (255 - r) * factor) & 0xff) << 16) |
      ((Math.round(g + (255 - g) * factor) & 0xff) << 8) |
      (Math.round(b + (255 - b) * factor) & 0xff)
    );
  }

  private darken(hex: number, factor: number): number {
    const r = (hex >> 16) & 0xff;
    const g = (hex >> 8) & 0xff;
    const b = hex & 0xff;

    return (
      ((Math.round(r * (1 - factor)) & 0xff) << 16) |
      ((Math.round(g * (1 - factor)) & 0xff) << 8) |
      (Math.round(b * (1 - factor)) & 0xff)
    );
  }

  private mixColor(from: number, to: number, t: number): number {
    const clamped = Phaser.Math.Clamp(t, 0, 1);
    const r = Phaser.Math.Linear((from >> 16) & 0xff, (to >> 16) & 0xff, clamped);
    const g = Phaser.Math.Linear((from >> 8) & 0xff, (to >> 8) & 0xff, clamped);
    const b = Phaser.Math.Linear(from & 0xff, to & 0xff, clamped);

    return ((Math.round(r) & 0xff) << 16) | ((Math.round(g) & 0xff) << 8) | (Math.round(b) & 0xff);
  }

  private hexToCss(hex: number): string {
    return `#${hex.toString(16).padStart(6, '0')}`;
  }

  private wait(delay: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(delay, resolve);
    });
  }
}

export const bootstrapGame = (): Phaser.Game => {
  const config = {
    type: Phaser.AUTO,
    parent: 'app',
    backgroundColor: '#fff3ee',
    scene: [Match3Scene],
    width: 1280,
    height: 720,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    scale: {
      parent: 'app',
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: '100%',
      height: '100%',
      expandParent: true
    }
  };

  return new Phaser.Game(config as unknown as Phaser.Types.Core.GameConfig);
};
