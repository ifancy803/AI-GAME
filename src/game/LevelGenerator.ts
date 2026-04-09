import { LevelConfig, TILE_PALETTE } from './types';

const rotatePalette = (offset: number): number[] => {
  const normalized = offset % TILE_PALETTE.length;

  return TILE_PALETTE.slice(normalized).concat(TILE_PALETTE.slice(0, normalized));
};

export class LevelGenerator {
  public static generate(levelId: number): LevelConfig {
    const tier = Math.max(0, levelId - 1);
    const rows = 7 + Math.min(2, Math.floor(tier / 2));
    const cols = 7 + Math.min(1, Math.floor(tier / 3));
    const colorCount = 5 + Math.min(2, Math.floor(tier / 3));
    const turnsPerSide = 9 + Math.min(4, Math.floor(tier / 2));
    const targetScore = 3400 + tier * 1250 + rows * cols * 24;
    const aiThinkTime = Math.max(360, 900 - tier * 55);
    const palette = rotatePalette(levelId);

    return {
      id: levelId,
      name: `Sector ${levelId.toString().padStart(2, '0')}`,
      description: `${rows}x${cols} grid / ${colorCount} gem types / ${turnsPerSide} rounds per side`,
      rows,
      cols,
      colorCount,
      seed: (0x1f12ab3d + levelId * 7919) >>> 0,
      turnsPerSide,
      targetScore,
      aiThinkTime,
      palette,
      accentColor: palette[(levelId + 2) % palette.length],
      backgroundTop: palette[levelId % palette.length],
      backgroundBottom: palette[(levelId + 4) % palette.length]
    };
  }
}
