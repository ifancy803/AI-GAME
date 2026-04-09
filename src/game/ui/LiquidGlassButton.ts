import * as Phaser from 'phaser';
import { GlassVariant } from './LiquidGlassPanel';

export class LiquidGlassButton {
  public readonly root: Phaser.GameObjects.Container;
  public readonly label: Phaser.GameObjects.Text;

  private readonly glow: Phaser.GameObjects.Image;
  private readonly buttonBody: Phaser.GameObjects.Image;
  private readonly accentFrame: Phaser.GameObjects.Image;
  private readonly pulse: Phaser.GameObjects.Graphics;
  private widthPx: number;
  private heightPx: number;
  private radiusPx: number;
  private accent = 0x5dd6ff;
  private variant: GlassVariant = 'light';
  private hoverTween?: Phaser.Tweens.Tween;

  constructor(
    private readonly scene: Phaser.Scene,
    width: number,
    height: number,
    accent: number,
    variant: GlassVariant,
    onClick: () => void
  ) {
    this.widthPx = width;
    this.heightPx = height;
    this.radiusPx = 18;
    this.accent = accent;
    this.variant = variant;

    this.root = scene.add.container(0, 0);
    this.glow = scene.add.image(0, 0, 'ui-button-accent').setOrigin(0.5).setAlpha(0.22);
    this.buttonBody = scene.add.image(0, 0, 'ui-button-glass').setOrigin(0.5);
    this.accentFrame = scene.add.image(0, 0, 'ui-button-accent').setOrigin(0.5).setAlpha(0.38);
    this.pulse = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, '', {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '18px',
        fontStyle: '700',
        color: '#24384d'
      })
      .setOrigin(0.5);

    this.root.add([this.glow, this.buttonBody, this.accentFrame, this.pulse, this.label]);
    this.redraw();

    this.root.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      Phaser.Geom.Rectangle.Contains
    );

    this.root.on('pointerover', () => this.handleHover(true));
    this.root.on('pointerout', () => this.handleHover(false));
    this.root.on('pointerdown', () => {
      scene.tweens.killTweensOf(this.root);
      scene.tweens.add({
        targets: this.root,
        scaleX: 0.96,
        scaleY: 0.96,
        duration: 90,
        yoyo: true,
        ease: 'Quad.Out'
      });
      this.emitClickBurst();
      onClick();
    });
  }

  public setAccent(accent: number): this {
    this.accent = accent;
    this.redraw();

    return this;
  }

  public setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }

  public setVariant(variant: GlassVariant): this {
    this.variant = variant;
    this.redraw();

    return this;
  }

  public resize(width: number, height: number): this {
    this.widthPx = width;
    this.heightPx = height;

    const hitArea = this.root.input?.hitArea;

    if (hitArea instanceof Phaser.Geom.Rectangle) {
      hitArea.setTo(-width / 2, -height / 2, width, height);
    }

    this.redraw();

    return this;
  }

  public setPosition(x: number, y: number): this {
    this.root.setPosition(x, y);
    return this;
  }

  public setDepth(depth: number): this {
    this.root.setDepth(depth);
    return this;
  }

  public setVisible(visible: boolean): this {
    this.root.setVisible(visible);
    return this;
  }

  private redraw(): void {
    const width = this.widthPx;
    const height = this.heightPx;
    const radius = this.radiusPx;
    const topAccent = lighten(this.accent, 0.46);
    const isLight = this.variant === 'light';

    this.glow
      .setDisplaySize(width + 10, height + 10)
      .setTint(this.accent)
      .setAlpha(isLight ? 0.18 : 0.14);

    this.buttonBody
      .setDisplaySize(width, height)
      .setTint(isLight ? 0xffffff : 0xbed0e4)
      .setAlpha(isLight ? 1 : 0.78);

    this.accentFrame
      .setDisplaySize(width, height)
      .setTint(topAccent)
      .setAlpha(isLight ? 0.42 : 0.34);

    this.pulse
      .clear()
      .lineStyle(2, topAccent, 0.12)
      .strokeRoundedRect(-width / 2 - 2, -height / 2 - 2, width + 4, height + 4, radius + 2);

    this.label.setStyle({
      color: isLight ? '#24384d' : '#edf8ff',
      strokeThickness: 0
    });
  }

  private handleHover(active: boolean): void {
    this.hoverTween?.stop();
    this.scene.tweens.killTweensOf(this.glow);
    this.scene.tweens.killTweensOf(this.pulse);
    this.scene.tweens.killTweensOf(this.root);

    if (!active) {
      this.scene.tweens.add({
        targets: [this.glow, this.pulse, this.root],
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 140,
        ease: 'Sine.Out'
      });
      return;
    }

    this.hoverTween = this.scene.tweens.add({
      targets: this.pulse,
      alpha: { from: 0.16, to: 0.52 },
      scaleX: { from: 1, to: 1.04 },
      scaleY: { from: 1, to: 1.04 },
      duration: 620,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1
    });

    this.scene.tweens.add({
      targets: this.glow,
      alpha: 1,
      duration: 140,
      ease: 'Sine.Out'
    });

    this.scene.tweens.add({
      targets: this.root,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 140,
      ease: 'Sine.Out'
    });
  }

  private emitClickBurst(): void {
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI * 2 * index) / 6 + Phaser.Math.FloatBetween(-0.2, 0.2);
      const mote = this.scene.add
        .image(this.root.x, this.root.y, index % 2 === 0 ? 'particle-soft' : 'particle-streak')
        .setTint(index % 2 === 0 ? lighten(this.accent, 0.36) : 0xffffff)
        .setScale(index % 2 === 0 ? 0.24 : 0.14)
        .setAlpha(0.88)
        .setDepth(this.root.depth + 2)
        .setBlendMode(Phaser.BlendModes.ADD);

      this.scene.tweens.add({
        targets: mote,
        x: mote.x + Math.cos(angle) * Phaser.Math.Between(26, 42),
        y: mote.y + Math.sin(angle) * Phaser.Math.Between(16, 30),
        alpha: 0,
        scaleX: 0.02,
        scaleY: 0.02,
        duration: Phaser.Math.Between(220, 320),
        ease: 'Cubic.Out',
        onComplete: () => mote.destroy()
      });
    }
  }
}

const lighten = (hex: number, factor: number): number => {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;

  return (
    ((Math.round(r + (255 - r) * factor) & 0xff) << 16) |
    ((Math.round(g + (255 - g) * factor) & 0xff) << 8) |
    (Math.round(b + (255 - b) * factor) & 0xff)
  );
};
