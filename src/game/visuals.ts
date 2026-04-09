import * as Phaser from 'phaser';

export const UI_FONT_FAMILY = '"Nunito", "Trebuchet MS", "Segoe UI", sans-serif';
export const DISPLAY_FONT_FAMILY = '"Baloo 2", "Nunito", "Trebuchet MS", sans-serif';

export const TILE_TEXTURE_KEYS = [
  'tile-bloom',
  'tile-star',
  'tile-bubble',
  'tile-heart',
  'tile-leaf',
  'tile-sun',
  'tile-sprout'
] as const;

export const TILE_ART_DESCRIPTIONS = [
  'Rounded five-petal bloom with apricot center and soft cream highlights',
  'Chunky optimistic star with plush points and airy glow',
  'Floating bubble cluster with translucent glass sheen',
  'Friendly heart badge with hand-cut illustration edges',
  'Pastel leaf charm with stitched center vein',
  'Smiling sunburst disc with short playful rays',
  'Two-leaf sprout with tiny stem and hopeful upward motion'
] as const;

export const JOYFUL_TILE_PALETTE: number[] = [
  0xff95ae,
  0xffbf77,
  0x8ad7b2,
  0xff8e95,
  0x7fd1af,
  0xffd46b,
  0x94cfff
];

export const JOYFUL_SURFACE = {
  cream: 0xfffaf5,
  blush: 0xffe8ef,
  apricot: 0xffc79c,
  peach: 0xffd8b4,
  mint: 0xcaf4dd,
  sky: 0xcceaff,
  lilac: 0xe4ddff,
  gold: 0xffd37a,
  coral: 0xff9d8b,
  dusk: 0x755f88,
  ink: 0x534763,
  softInk: 0x776985
} as const;

export const WARM_EASING = {
  soft: 'Sine.InOut',
  settle: 'Back.Out',
  elastic: 'Elastic.Out',
  lift: 'Cubic.Out',
  press: 'Back.In',
  reveal: 'Sine.Out'
} as const;

export const lighten = (hex: number, factor: number): number => {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;

  return (
    ((Math.round(r + (255 - r) * factor) & 0xff) << 16) |
    ((Math.round(g + (255 - g) * factor) & 0xff) << 8) |
    (Math.round(b + (255 - b) * factor) & 0xff)
  );
};

export const darken = (hex: number, factor: number): number => {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;

  return (
    ((Math.round(r * (1 - factor)) & 0xff) << 16) |
    ((Math.round(g * (1 - factor)) & 0xff) << 8) |
    (Math.round(b * (1 - factor)) & 0xff)
  );
};

export const mixColor = (from: number, to: number, amount: number): number => {
  const t = Phaser.Math.Clamp(amount, 0, 1);
  const r = Phaser.Math.Linear((from >> 16) & 0xff, (to >> 16) & 0xff, t);
  const g = Phaser.Math.Linear((from >> 8) & 0xff, (to >> 8) & 0xff, t);
  const b = Phaser.Math.Linear(from & 0xff, to & 0xff, t);

  return ((Math.round(r) & 0xff) << 16) | ((Math.round(g) & 0xff) << 8) | (Math.round(b) & 0xff);
};

export const hexToCss = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;

export const buildWarmLevelName = (levelId: number): string => {
  const prefixes = ['Bloom', 'Sunny', 'Kind', 'Petal', 'Glow', 'Hope', 'Joy'];
  const suffixes = ['Garden', 'Meadow', 'Harbor', 'Canvas', 'Orbit', 'Valley', 'Lagoon'];
  const prefix = prefixes[(levelId - 1) % prefixes.length];
  const suffix = suffixes[(levelId + 2) % suffixes.length];

  return `${prefix} ${suffix} ${levelId.toString().padStart(2, '0')}`;
};
