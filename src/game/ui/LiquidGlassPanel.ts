import * as Phaser from 'phaser';

export type GlassVariant = 'light' | 'dark';

export class LiquidGlassPanel {
  public readonly root: Phaser.GameObjects.Container;

  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly aura: Phaser.GameObjects.Graphics;
  private readonly panelBody: Phaser.GameObjects.Graphics;
  private readonly shine: Phaser.GameObjects.Graphics;
  private readonly frame: Phaser.GameObjects.Graphics;
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

    this.root.add([this.shadow, this.aura, this.panelBody, this.shine, this.frame]);
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
    const topGlow = lighten(this.accent, 0.44);
    const isLight = this.variant === 'light';

    this.shadow
      .clear()
      .fillStyle(isLight ? 0xc7d6e8 : 0x01040a, isLight ? 0.12 : 0.22)
      .fillRoundedRect(8, 12, width, height, radius);

    this.aura
      .clear()
      .fillStyle(this.accent, isLight ? 0.07 : 0.05)
      .fillRoundedRect(2, 2, width - 4, height - 4, radius)
      .fillStyle(topGlow, isLight ? 0.06 : 0.05)
      .fillEllipse(width * 0.28, height * 0.2, width * 0.5, height * 0.34)
      .fillStyle(lighten(this.accent, 0.24), isLight ? 0.05 : 0.05)
      .fillEllipse(width * 0.78, height * 0.78, width * 0.34, height * 0.42);

    this.panelBody.clear();
    if (isLight) {
      this.panelBody.fillGradientStyle(
        0xf6fbff,
        0xf1f7fc,
        0xe8f0f8,
        0xe2ecf7,
        0.78,
        0.72,
        0.86,
        0.9
      );
    } else {
      this.panelBody.fillGradientStyle(0x15273c, 0x101c2e, 0x0b1220, 0x0a101b, 0.48, 0.4, 0.62, 0.72);
    }
    this.panelBody.fillRoundedRect(0, 0, width, height, radius);

    this.shine
      .clear()
      .fillStyle(0xffffff, isLight ? 0.18 : 0.055)
      .fillRoundedRect(5, 5, width - 10, height * 0.24, Math.max(14, radius - 8))
      .fillStyle(0xffffff, isLight ? 0.05 : 0.018)
      .fillRoundedRect(8, height * 0.38, width - 16, height * 0.18, Math.max(12, radius - 10));

    this.frame
      .clear()
      .lineStyle(2, this.accent, isLight ? 0.18 : 0.22)
      .strokeRoundedRect(0, 0, width, height, radius)
      .lineStyle(1, isLight ? 0xd4e3f3 : 0xffffff, isLight ? 0.8 : 0.1)
      .strokeRoundedRect(4, 4, width - 8, height - 8, Math.max(12, radius - 8));
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
