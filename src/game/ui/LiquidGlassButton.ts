import * as Phaser from 'phaser';
import { GlassVariant } from './LiquidGlassPanel';
import {
  DISPLAY_FONT_FAMILY,
  UI_FONT_FAMILY,
  WARM_EASING,
  darken,
  hexToCss,
  lighten,
  mixColor
} from '../visuals';

export class LiquidGlassButton {
  public readonly root: Phaser.GameObjects.Container;
  public readonly label: Phaser.GameObjects.Text;

  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly buttonBody: Phaser.GameObjects.Graphics;
  private readonly innerHighlight: Phaser.GameObjects.Graphics;
  private readonly stroke: Phaser.GameObjects.Graphics;
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
    this.radiusPx = Math.max(16, Math.round(height * 0.42));
    this.accent = accent;
    this.variant = variant;

    this.root = scene.add.container(0, 0);
    this.shadow = scene.add.graphics();
    this.glow = scene.add.graphics();
    this.buttonBody = scene.add.graphics();
    this.innerHighlight = scene.add.graphics();
    this.stroke = scene.add.graphics();
    this.pulse = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, '', {
        fontFamily: DISPLAY_FONT_FAMILY,
        fontSize: '18px',
        fontStyle: '800',
        color: '#5b4a63'
      })
      .setOrigin(0.5);

    this.root.add([this.shadow, this.glow, this.buttonBody, this.innerHighlight, this.stroke, this.pulse, this.label]);
    this.redraw();

    this.root.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      Phaser.Geom.Rectangle.Contains
    );

    this.root.on('pointerover', () => this.handleHover(true));
    this.root.on('pointerout', () => this.handleHover(false));
    this.root.on('pointerdown', () => {
      scene.tweens.killTweensOf(this.root);
      scene.tweens.killTweensOf(this.innerHighlight);
      scene.tweens.add({
        targets: this.root,
        scaleX: 0.97,
        scaleY: 0.95,
        y: 1,
        duration: 110,
        yoyo: true,
        ease: WARM_EASING.settle
      });
      scene.tweens.add({
        targets: this.innerHighlight,
        alpha: { from: 0.34, to: 0.12 },
        duration: 110,
        yoyo: true,
        ease: WARM_EASING.reveal
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
    this.radiusPx = Math.max(16, Math.round(height * 0.42));

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
    const topAccent = lighten(this.accent, 0.48);
    const lowAccent = mixColor(this.accent, 0xffffff, 0.66);
    const isLight = this.variant === 'light';
    const bodyTop = isLight ? mixColor(0xffffff, topAccent, 0.42) : mixColor(0x342c46, topAccent, 0.18);
    const bodyBottom = isLight ? mixColor(0xfff7f2, this.accent, 0.18) : mixColor(0x231d34, this.accent, 0.12);

    this.shadow
      .clear()
      .fillStyle(isLight ? darken(this.accent, 0.48) : 0x09060f, isLight ? 0.12 : 0.26)
      .fillRoundedRect(-width / 2, -height / 2 + 5, width, height, radius);

    this.glow
      .clear()
      .fillStyle(this.accent, isLight ? 0.16 : 0.12)
      .fillRoundedRect(-width / 2 - 4, -height / 2 - 3, width + 8, height + 8, radius + 4)
      .fillStyle(topAccent, isLight ? 0.12 : 0.08)
      .fillEllipse(0, -height * 0.08, width * 0.82, height * 1.2);

    this.buttonBody.clear();
    this.buttonBody.fillGradientStyle(bodyTop, topAccent, bodyBottom, lowAccent, 0.96, 0.92, 0.94, 0.92);
    this.buttonBody.fillRoundedRect(-width / 2, -height / 2, width, height, radius);

    this.innerHighlight
      .clear()
      .fillStyle(0xffffff, isLight ? 0.3 : 0.12)
      .fillRoundedRect(-width / 2 + 5, -height / 2 + 4, width - 10, height * 0.46, Math.max(12, radius - 6))
      .fillStyle(lighten(this.accent, 0.58), isLight ? 0.18 : 0.08)
      .fillRoundedRect(-width / 2 + 8, -height * 0.08, width - 16, height * 0.22, Math.max(10, radius - 10));

    this.stroke
      .clear()
      .lineStyle(2, isLight ? mixColor(this.accent, 0xffffff, 0.3) : lowAccent, isLight ? 0.88 : 0.5)
      .strokeRoundedRect(-width / 2, -height / 2, width, height, radius)
      .lineStyle(1, 0xffffff, isLight ? 0.7 : 0.18)
      .strokeRoundedRect(-width / 2 + 4, -height / 2 + 4, width - 8, height - 8, Math.max(12, radius - 6));

    this.pulse
      .clear()
      .lineStyle(2, topAccent, 0.14)
      .strokeRoundedRect(-width / 2 - 3, -height / 2 - 3, width + 6, height + 6, radius + 4);

    this.label.setStyle({
      fontFamily: this.label.text.length <= 3 ? DISPLAY_FONT_FAMILY : UI_FONT_FAMILY,
      color: isLight ? hexToCss(darken(this.accent, 0.5)) : '#fff8f2',
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
        targets: this.root,
        scaleX: 1,
        scaleY: 1,
        y: 0,
        duration: 180,
        ease: WARM_EASING.reveal
      });
      this.scene.tweens.add({
        targets: [this.glow, this.pulse],
        alpha: 1,
        duration: 180,
        ease: WARM_EASING.reveal
      });
      return;
    }

    this.hoverTween = this.scene.tweens.add({
      targets: this.pulse,
      alpha: { from: 0.2, to: 0.64 },
      scaleX: { from: 1, to: 1.05 },
      scaleY: { from: 1, to: 1.05 },
      duration: 720,
      ease: WARM_EASING.soft,
      yoyo: true,
      repeat: -1
    });

    this.scene.tweens.add({
      targets: this.glow,
      alpha: 1.12,
      duration: 180,
      ease: WARM_EASING.reveal
    });

    this.scene.tweens.add({
      targets: this.root,
      scaleX: 1.04,
      scaleY: 1.04,
      y: -1.5,
      duration: 180,
      ease: WARM_EASING.settle
    });
  }

  private emitClickBurst(): void {
    const textures = ['particle-soft', 'particle-petal', 'particle-heart'];

    for (let index = 0; index < 7; index += 1) {
      const angle = (Math.PI * 2 * index) / 7 + Phaser.Math.FloatBetween(-0.18, 0.18);
      const texture = textures[index % textures.length];
      const mote = this.scene.add
        .image(this.root.x, this.root.y, texture)
        .setTint(index % 2 === 0 ? lighten(this.accent, 0.32) : 0xffffff)
        .setScale(texture === 'particle-soft' ? 0.2 : 0.16)
        .setAlpha(0.92)
        .setDepth(this.root.depth + 2)
        .setBlendMode(Phaser.BlendModes.SCREEN);

      this.scene.tweens.add({
        targets: mote,
        x: mote.x + Math.cos(angle) * Phaser.Math.Between(26, 46),
        y: mote.y + Math.sin(angle) * Phaser.Math.Between(18, 32) - 8,
        alpha: 0,
        scaleX: 0.03,
        scaleY: 0.03,
        duration: Phaser.Math.Between(240, 360),
        ease: WARM_EASING.lift,
        onComplete: () => mote.destroy()
      });
    }
  }
}
