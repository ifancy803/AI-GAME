import * as Phaser from 'phaser';

const GEM_TEXTURE_KEYS = ['gem-red', 'gem-orange', 'gem-yellow', 'gem-green', 'gem-blue'] as const;

export class Tile extends Phaser.GameObjects.Container {
  public row: number;
  public col: number;
  public readonly gemType: number;

  private readonly crystalColor: number;
  private readonly shell: Phaser.GameObjects.Container;
  private readonly aura: Phaser.GameObjects.Image;
  private readonly base: Phaser.GameObjects.Image;
  private readonly facets: Phaser.GameObjects.Image;
  private readonly sheen: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly hintRing: Phaser.GameObjects.Image;
  private readonly selectionRing: Phaser.GameObjects.Image;
  private readonly previewAura: Phaser.GameObjects.Image;
  private hintTween?: Phaser.Tweens.Tween;
  private selectionTween?: Phaser.Tweens.Tween;
  private breatheTween?: Phaser.Tweens.Tween;
  private sheenTween?: Phaser.Tweens.Tween;
  private previewTween?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    row: number,
    col: number,
    type: number,
    size: number,
    color: number
  ) {
    super(scene, 0, 0);

    this.row = row;
    this.col = col;
    this.gemType = type;
    this.crystalColor = color;

    this.shell = scene.add.container(0, 0);
    this.aura = scene.add
      .image(0, 0, 'tile-core-glow')
      .setOrigin(0.5)
      .setTint(color)
      .setAlpha(0.24)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.base = scene.add.image(0, 0, GEM_TEXTURE_KEYS[type] ?? GEM_TEXTURE_KEYS[0]).setOrigin(0.5);
    this.facets = scene.add
      .image(0, 0, 'tile-facet')
      .setOrigin(0.5)
      .setTint(lighten(color, 0.42))
      .setAlpha(0.28)
      .setBlendMode(Phaser.BlendModes.SCREEN);
    this.sheen = scene.add
      .image(0, 0, 'tile-caustic')
      .setOrigin(0.5)
      .setAlpha(0.12)
      .setTint(0xf8fcff)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.label = scene.add
      .text(0, 3, String.fromCharCode(65 + type), {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '24px',
        color: '#35506b',
        fontStyle: '700',
        strokeThickness: 0
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setVisible(false);

    this.shell.add([this.aura, this.base, this.facets, this.sheen, this.label]);

    this.hintRing = scene.add
      .image(0, 0, 'tile-hint-ring')
      .setOrigin(0.5)
      .setVisible(false)
      .setAlpha(0);
    this.selectionRing = scene.add
      .image(0, 0, 'tile-select-ring')
      .setOrigin(0.5)
      .setVisible(false)
      .setAlpha(0);
    this.previewAura = scene.add
      .image(0, 0, 'tile-core-glow')
      .setOrigin(0.5)
      .setVisible(false)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.add([this.previewAura, this.shell, this.hintRing, this.selectionRing]);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size),
      Phaser.Geom.Rectangle.Contains
    );

    scene.add.existing(this);
    this.setTileSize(size);
    this.startIdleMotion();
  }

  public setTileSize(size: number): this {
    this.aura.setDisplaySize(size * 0.98, size * 0.98);
    this.base.setDisplaySize(size * 0.88, size * 0.88);
    this.facets.setDisplaySize(size * 0.86, size * 0.86);
    this.sheen.setDisplaySize(size * 0.56, size * 0.56).setPosition(-size * 0.1, -size * 0.14);
    this.label.setFontSize(Math.max(14, Math.floor(size * 0.22)));
    this.hintRing.setDisplaySize(size * 1.06, size * 1.06);
    this.selectionRing.setDisplaySize(size * 1.08, size * 1.08);
    this.previewAura.setDisplaySize(size * 1.12, size * 1.12);

    if (this.input?.hitArea instanceof Phaser.Geom.Rectangle) {
      this.input.hitArea.setTo(-size / 2, -size / 2, size, size);
    }

    return this;
  }

  public setGridPosition(row: number, col: number): this {
    this.row = row;
    this.col = col;
    this.setDepth(20 + row);

    return this;
  }

  public setDragging(active: boolean): this {
    this.setDepth(active ? 200 : 20 + this.row);
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scaleX: active ? 1.08 : 1,
      scaleY: active ? 1.08 : 1,
      duration: 140,
      ease: 'Sine.Out'
    });

    return this;
  }

  public setHint(active: boolean): this {
    this.hintTween?.stop();

    if (!active) {
      this.hintRing.setVisible(false).setAlpha(0);
      return this;
    }

    this.hintRing.setVisible(true).setAlpha(0.3).setScale(0.92);
    this.hintTween = this.scene.tweens.add({
      targets: this.hintRing,
      alpha: { from: 0.26, to: 0.9 },
      scaleX: { from: 0.92, to: 1.08 },
      scaleY: { from: 0.92, to: 1.08 },
      duration: 560,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1
    });

    return this;
  }

  public setSelected(active: boolean): this {
    this.selectionTween?.stop();

    if (!active) {
      this.selectionRing.setVisible(false).setAlpha(0);
      return this;
    }

    this.selectionRing.setVisible(true).setAlpha(0.45).setScale(0.9);
    this.selectionTween = this.scene.tweens.add({
      targets: this.selectionRing,
      alpha: { from: 0.34, to: 0.84 },
      scaleX: { from: 0.9, to: 1.03 },
      scaleY: { from: 0.9, to: 1.03 },
      duration: 360,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1
    });

    return this;
  }

  public setPreviewGlow(active: boolean, color = this.crystalColor): this {
    this.previewTween?.stop();

    if (!active) {
      this.previewAura.setVisible(false).setAlpha(0);
      this.aura.setAlpha(0.24);
      return this;
    }

    this.previewAura
      .setVisible(true)
      .setTint(lighten(color, 0.24))
      .setAlpha(0.18)
      .setScale(0.96);
    this.aura.setAlpha(0.34);

    this.previewTween = this.scene.tweens.add({
      targets: this.previewAura,
      alpha: { from: 0.14, to: 0.32 },
      scaleX: { from: 0.96, to: 1.04 },
      scaleY: { from: 0.96, to: 1.04 },
      duration: 520,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1
    });

    return this;
  }

  public async burstDestroy(intensity: number): Promise<void> {
    const power = Phaser.Math.Clamp(intensity, 1, 2.8);
    const shardCount = Math.round(6 + power * 3);
    const worldX = this.x;
    const worldY = this.y;
    const glow = this.scene.add
      .image(worldX, worldY, 'tile-core-glow')
      .setTint(lighten(this.crystalColor, 0.22))
      .setAlpha(0.78)
      .setScale(0.42)
      .setDepth(this.depth + 2)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.stopLocalTweens();

    for (let index = 0; index < shardCount; index += 1) {
      const angle = Phaser.Math.FloatBetween(-Math.PI, Math.PI);
      const travel = Phaser.Math.Between(18, 34) * power;
      const shard = this.scene.add
        .image(worldX, worldY, 'tile-shard')
        .setTint(index % 2 === 0 ? this.crystalColor : lighten(this.crystalColor, 0.35))
        .setAlpha(0.95)
        .setDepth(this.depth + 3)
        .setScale(Phaser.Math.FloatBetween(0.28, 0.52) * power)
        .setAngle(Phaser.Math.Between(0, 360))
        .setBlendMode(Phaser.BlendModes.ADD);

      this.scene.tweens.add({
        targets: shard,
        x: worldX + Math.cos(angle) * travel,
        y: worldY + Math.sin(angle) * travel,
        scaleX: 0.04,
        scaleY: 0.04,
        angle: shard.angle + Phaser.Math.Between(-180, 180),
        alpha: 0,
        duration: Phaser.Math.Between(220, 340),
        ease: 'Cubic.Out',
        onComplete: () => shard.destroy()
      });
    }

    this.scene.tweens.add({
      targets: glow,
      scaleX: 1.45 + power * 0.18,
      scaleY: 1.45 + power * 0.18,
      alpha: 0,
      duration: 240,
      ease: 'Quad.Out',
      onComplete: () => glow.destroy()
    });

    await Promise.all([
      tweenAsync(this.scene, this.shell, {
        alpha: 0,
        scaleX: 0.42,
        scaleY: 0.42,
        angle: Phaser.Math.Between(-14, 14),
        duration: 210,
        ease: 'Back.In'
      }),
      tweenAsync(this.scene, this, {
        scaleX: 0.82,
        scaleY: 0.82,
        duration: 210,
        ease: 'Quad.In'
      })
    ]);
  }

  public override destroy(fromScene?: boolean): void {
    this.stopLocalTweens();
    super.destroy(fromScene);
  }

  private startIdleMotion(): void {
    if (this.breatheTween || this.sheenTween) {
      return;
    }

    const offset = (this.row + this.col) * 60;

    this.breatheTween = this.scene.tweens.add({
      targets: this.shell,
      scaleX: { from: 0.992, to: 1.012 },
      scaleY: { from: 1.008, to: 0.994 },
      angle: { from: -0.5, to: 0.6 },
      duration: 2200 + offset,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1
    });

    this.sheenTween = this.scene.tweens.add({
      targets: this.sheen,
      x: { from: -12, to: 10 },
      y: { from: -10, to: 8 },
      alpha: { from: 0.08, to: 0.2 },
      scaleX: { from: 0.96, to: 1.04 },
      scaleY: { from: 0.94, to: 1 },
      duration: 2400 + offset,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1
    });
  }

  private stopLocalTweens(): void {
    this.hintTween?.stop();
    this.selectionTween?.stop();
    this.breatheTween?.stop();
    this.sheenTween?.stop();
    this.previewTween?.stop();
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.shell);
    this.scene.tweens.killTweensOf(this.sheen);
    this.scene.tweens.killTweensOf(this.hintRing);
    this.scene.tweens.killTweensOf(this.selectionRing);
    this.scene.tweens.killTweensOf(this.previewAura);
  }
}

const tweenAsync = (
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject | object,
  config: Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>
): Promise<void> =>
  new Promise((resolve) => {
    scene.tweens.add({
      ...config,
      targets: target,
      onComplete: () => resolve()
    });
  });

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
