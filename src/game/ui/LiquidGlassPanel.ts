import * as Phaser from 'phaser';
import { darken, lighten, mixColor } from '../visuals';

export type GlassVariant = 'light' | 'dark';

export class LiquidGlassPanel {
  public readonly root: Phaser.GameObjects.Container;

  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly aura: Phaser.GameObjects.Graphics;
  private readonly panelBody: Phaser.GameObjects.Graphics;
  private readonly shine: Phaser.GameObjects.Graphics;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly innerShadow: Phaser.GameObjects.Graphics;
  private widthPx: number;
  private heightPx: number;
  private radiusPx: number;
  private accent = 0x5dd6ff;
  private variant: GlassVariant = 'light';

  constructor(
    private readonly scene: Phaser.Scene,
    width: number,
    height: number,
    radius = 24,
    accent = 0x5dd6ff,
    variant: GlassVariant = 'light'
  ) {
    this.widthPx = width;
    this.heightPx = height;
    this.radiusPx = radius;
    this.accent = accent;
    this.variant = variant;

    this.root = scene.add.container(0, 0);
    this.shadow = scene.add.graphics();
    this.aura = scene.add.graphics();
    this.panelBody = scene.add.graphics();
    this.shine = scene.add.graphics();
    this.frame = scene.add.graphics();
    this.innerShadow = scene.add.graphics();

    this.root.add([this.shadow, this.aura, this.panelBody, this.shine, this.innerShadow, this.frame]);
    this.redraw();
  }

  public resize(x: number, y: number, width: number, height: number, radius = this.radiusPx): this {
    this.root.setPosition(x, y);
    this.widthPx = width;
    this.heightPx = height;
    this.radiusPx = radius;
    this.redraw();

    return this;
  }

  public setAccent(accent: number): this {
    this.accent = accent;
    this.redraw();

    return this;
  }

  public setVariant(variant: GlassVariant): this {
    this.variant = variant;
    this.redraw();

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
    const topGlow = lighten(this.accent, 0.52);
    const warmCream = mixColor(0xfffbf7, topGlow, 0.18);
    const isLight = this.variant === 'light';

    this.shadow
      .clear()
      .fillStyle(isLight ? darken(this.accent, 0.54) : 0x090511, isLight ? 0.1 : 0.26)
      .fillRoundedRect(8, 12, width, height, radius);

    this.aura
      .clear()
      .fillStyle(this.accent, isLight ? 0.08 : 0.07)
      .fillRoundedRect(2, 2, width - 4, height - 4, radius)
      .fillStyle(topGlow, isLight ? 0.1 : 0.07)
      .fillEllipse(width * 0.24, height * 0.16, width * 0.58, height * 0.36)
      .fillStyle(lighten(this.accent, 0.3), isLight ? 0.08 : 0.07)
      .fillEllipse(width * 0.8, height * 0.82, width * 0.38, height * 0.46);

    this.panelBody.clear();
    if (isLight) {
      this.panelBody.fillGradientStyle(
        warmCream,
        mixColor(0xffffff, topGlow, 0.3),
        mixColor(0xfff3f6, this.accent, 0.1),
        mixColor(0xfff8ef, this.accent, 0.14),
        0.82,
        0.74,
        0.9,
        0.94
      );
    } else {
      this.panelBody.fillGradientStyle(0x332944, 0x2a233d, 0x211c31, 0x1c1629, 0.5, 0.44, 0.68, 0.74);
    }
    this.panelBody.fillRoundedRect(0, 0, width, height, radius);

    this.shine
      .clear()
      .fillStyle(0xffffff, isLight ? 0.24 : 0.08)
      .fillRoundedRect(6, 6, width - 12, height * 0.24, Math.max(14, radius - 8))
      .fillStyle(topGlow, isLight ? 0.14 : 0.05)
      .fillRoundedRect(10, height * 0.42, width - 20, height * 0.18, Math.max(12, radius - 10));

    this.innerShadow
      .clear()
      .lineStyle(2, isLight ? darken(this.accent, 0.35) : 0x000000, isLight ? 0.08 : 0.18)
      .strokeRoundedRect(8, 10, width - 16, height - 18, Math.max(14, radius - 10));

    this.frame
      .clear()
      .lineStyle(2, mixColor(this.accent, 0xffffff, 0.2), isLight ? 0.34 : 0.3)
      .strokeRoundedRect(0, 0, width, height, radius)
      .lineStyle(1, isLight ? 0xffffff : topGlow, isLight ? 0.84 : 0.16)
      .strokeRoundedRect(4, 4, width - 8, height - 8, Math.max(12, radius - 8));
  }
}
