import * as Phaser from 'phaser';
import {
  TILE_TEXTURE_KEYS,
  UI_FONT_FAMILY,
  WARM_EASING,
  darken,
  hexToCss,
  lighten,
  mixColor
} from './visuals';

export class Tile extends Phaser.GameObjects.Container {
  public row: number;
  public col: number;
  public readonly gemType: number;

  private readonly tileColor: number;
  private readonly shell: Phaser.GameObjects.Container;
  private readonly dropShadow: Phaser.GameObjects.Image;
  private readonly aura: Phaser.GameObjects.Image;
  private readonly backing: Phaser.GameObjects.Image;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly sparkle: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly hintRing: Phaser.GameObjects.Image;
  private readonly selectionRing: Phaser.GameObjects.Image;
  private readonly previewAura: Phaser.GameObjects.Image;
  private hintTween?: Phaser.Tweens.Tween;
  private selectionTween?: Phaser.Tweens.Tween;
  private breatheTween?: Phaser.Tweens.Tween;
  private sparkleTween?: Phaser.Tweens.Tween;
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
    this.tileColor = color;

    this.shell = scene.add.container(0, 0);
    this.dropShadow = scene.add.image(0, 8, 'tile-shadow').setOrigin(0.5).setAlpha(0.18);
    this.aura = scene.add
      .image(0, 0, 'tile-core-glow')
      .setOrigin(0.5)
      .setTint(lighten(color, 0.16))
      .setAlpha(0.34)
      .setBlendMode(Phaser.BlendModes.SCREEN);
    this.backing = scene.add
      .image(0, 0, 'tile-backing')
      .setOrigin(0.5)
      .setTint(mixColor(color, 0xffffff, 0.24));
    this.icon = scene.add
      .image(0, 0, TILE_TEXTURE_KEYS[type] ?? TILE_TEXTURE_KEYS[0])
      .setOrigin(0.5)
      .setTint(color);
    this.sparkle = scene.add
      .image(0, 0, 'tile-sheen')
      .setOrigin(0.5)
      .setTint(0xffffff)
      .setAlpha(0.62)
      .setBlendMode(Phaser.BlendModes.SCREEN);
    this.label = scene.add
      .text(0, 0, ['B', 'S', 'O', 'H', 'L', 'U', 'P'][type] ?? 'J', {
        fontFamily: UI_FONT_FAMILY,
        fontSize: '16px',
        color: hexToCss(darken(color, 0.42)),
        fontStyle: '800'
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.shell.add([this.dropShadow, this.aura, this.backing, this.icon, this.sparkle, this.label]);

    this.hintRing = scene.add.image(0, 0, 'tile-hint-ring').setOrigin(0.5).setVisible(false).setAlpha(0);
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
      .setBlendMode(Phaser.BlendModes.SCREEN);

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
    this.dropShadow.setDisplaySize(size * 0.84, size * 0.28);
    this.aura.setDisplaySize(size * 1.18, size * 1.18);
    this.backing.setDisplaySize(size * 0.94, size * 0.94);
    this.icon.setDisplaySize(size * 0.7, size * 0.7);
    this.sparkle.setDisplaySize(size * 0.48, size * 0.48).setPosition(size * 0.08, -size * 0.12);
    this.label.setFontSize(Math.max(12, Math.floor(size * 0.18)));
    this.hintRing.setDisplaySize(size * 1.14, size * 1.14);
    this.selectionRing.setDisplaySize(size * 1.18, size * 1.18);
    this.previewAura.setDisplaySize(size * 1.28, size * 1.28);

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
    this.setDepth(active ? 220 : 20 + this.row);
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scaleX: active ? 1.12 : 1,
      scaleY: active ? 1.12 : 1,
      angle: active ? Phaser.Math.FloatBetween(-2.2, 2.2) : 0,
      duration: active ? 180 : 160,
      ease: active ? WARM_EASING.settle : WARM_EASING.reveal
    });

    return this;
  }

  public setHint(active: boolean): this {
    this.hintTween?.stop();

    if (!active) {
      this.hintRing.setVisible(false).setAlpha(0);
      return this;
    }

    this.hintRing.setVisible(true).setAlpha(0.38).setScale(0.9);
    this.hintTween = this.scene.tweens.add({
      targets: this.hintRing,
      alpha: { from: 0.28, to: 0.92 },
      scaleX: { from: 0.9, to: 1.08 },
      scaleY: { from: 0.9, to: 1.08 },
      duration: 680,
      ease: WARM_EASING.soft,
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

    this.selectionRing.setVisible(true).setAlpha(0.42).setScale(0.92);
    this.selectionTween = this.scene.tweens.add({
      targets: this.selectionRing,
      alpha: { from: 0.28, to: 0.82 },
      scaleX: { from: 0.92, to: 1.04 },
      scaleY: { from: 0.92, to: 1.04 },
      duration: 460,
      ease: WARM_EASING.soft,
      yoyo: true,
      repeat: -1
    });

    return this;
  }

  public setPreviewGlow(active: boolean, color = this.tileColor): this {
    this.previewTween?.stop();

    if (!active) {
      this.previewAura.setVisible(false).setAlpha(0);
      this.aura.setAlpha(0.34);
      return this;
    }

    this.previewAura
      .setVisible(true)
      .setTint(lighten(color, 0.22))
      .setAlpha(0.24)
      .setScale(0.92);
    this.aura.setAlpha(0.48);

    this.previewTween = this.scene.tweens.add({
      targets: this.previewAura,
      alpha: { from: 0.18, to: 0.38 },
      scaleX: { from: 0.92, to: 1.06 },
      scaleY: { from: 0.92, to: 1.06 },
      duration: 560,
      ease: WARM_EASING.soft,
      yoyo: true,
      repeat: -1
    });

    return this;
  }

  public async burstDestroy(intensity: number): Promise<void> {
    const power = Phaser.Math.Clamp(intensity, 1, 2.9);
    const sparkleCount = Math.round(8 + power * 4);
    const worldX = this.x;
    const worldY = this.y;
    const halo = this.scene.add
      .image(worldX, worldY, 'tile-core-glow')
      .setTint(lighten(this.tileColor, 0.28))
      .setAlpha(0.82)
      .setScale(0.34)
      .setDepth(this.depth + 2)
      .setBlendMode(Phaser.BlendModes.SCREEN);

    this.stopLocalTweens();

    for (let index = 0; index < sparkleCount; index += 1) {
      const angle = Phaser.Math.FloatBetween(-Math.PI, Math.PI);
      const travel = Phaser.Math.Between(20, 38) * power;
      const texture = index % 3 === 0 ? 'particle-heart' : index % 2 === 0 ? 'particle-petal' : 'particle-bloom';
      const mote = this.scene.add
        .image(worldX, worldY, texture)
        .setTint(index % 2 === 0 ? this.tileColor : lighten(this.tileColor, 0.36))
        .setAlpha(0.94)
        .setDepth(this.depth + 3)
        .setScale(Phaser.Math.FloatBetween(0.18, 0.34) * power)
        .setAngle(Phaser.Math.Between(0, 360))
        .setBlendMode(Phaser.BlendModes.SCREEN);

      this.scene.tweens.add({
        targets: mote,
        x: worldX + Math.cos(angle) * travel,
        y: worldY + Math.sin(angle) * travel - Phaser.Math.Between(4, 14),
        scaleX: 0.03,
        scaleY: 0.03,
        angle: mote.angle + Phaser.Math.Between(-80, 120),
        alpha: 0,
        duration: Phaser.Math.Between(280, 420),
        ease: WARM_EASING.lift,
        onComplete: () => mote.destroy()
      });
    }

    this.scene.tweens.add({
      targets: halo,
      scaleX: 1.52 + power * 0.22,
      scaleY: 1.52 + power * 0.22,
      alpha: 0,
      duration: 300,
      ease: WARM_EASING.lift,
      onComplete: () => halo.destroy()
    });

    await Promise.all([
      tweenAsync(this.scene, this.shell, {
        alpha: 0,
        scaleX: 0.48,
        scaleY: 0.48,
        y: this.shell.y - 8,
        duration: 230,
        ease: WARM_EASING.press
      }),
      tweenAsync(this.scene, this, {
        scaleX: 0.86,
        scaleY: 0.86,
        duration: 230,
        ease: WARM_EASING.press
      })
    ]);
  }

  public override destroy(fromScene?: boolean): void {
    this.stopLocalTweens();
    super.destroy(fromScene);
  }

  private startIdleMotion(): void {
    if (this.breatheTween || this.sparkleTween) {
      return;
    }

    const offset = (this.row * 91 + this.col * 53) % 380;

    this.breatheTween = this.scene.tweens.add({
      targets: this.shell,
      scaleX: { from: 0.992, to: 1.028 },
      scaleY: { from: 1.006, to: 0.986 },
      y: { from: -1.5, to: 1.5 },
      angle: { from: -0.8, to: 0.8 },
      duration: 2200 + offset,
      ease: WARM_EASING.soft,
      yoyo: true,
      repeat: -1
    });

    this.sparkleTween = this.scene.tweens.add({
      targets: this.sparkle,
      x: { from: 6, to: 12 },
      y: { from: -12, to: -18 },
      alpha: { from: 0.28, to: 0.74 },
      scaleX: { from: 0.9, to: 1.12 },
      scaleY: { from: 0.9, to: 1.12 },
      duration: 2400 + offset,
      ease: WARM_EASING.soft,
      yoyo: true,
      repeat: -1
    });
  }

  private stopLocalTweens(): void {
    this.hintTween?.stop();
    this.selectionTween?.stop();
    this.breatheTween?.stop();
    this.sparkleTween?.stop();
    this.previewTween?.stop();
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.shell);
    this.scene.tweens.killTweensOf(this.sparkle);
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
