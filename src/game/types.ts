export type PlayerSide = 'player' | 'ai';
export type Language = 'en' | 'zh';

export interface GridPosition {
  row: number;
  col: number;
}

export interface Move {
  from: GridPosition;
  to: GridPosition;
}

export interface MatchGroup {
  direction: 'horizontal' | 'vertical';
  type: number;
  cells: GridPosition[];
}

export interface TileDrop {
  fromRow: number;
  toRow: number;
  col: number;
  type: number;
}

export interface TileSpawn {
  row: number;
  col: number;
  type: number;
  spawnRow: number;
}

export interface CascadeStep {
  matchedCells: GridPosition[];
  groups: MatchGroup[];
  score: number;
  cleared: number;
  drops: TileDrop[];
  spawns: TileSpawn[];
  board: number[][];
}

export interface BoardSnapshot {
  rows: number;
  cols: number;
  colorCount: number;
  rngState: number;
  grid: number[][];
}

export interface SimulationResult {
  valid: boolean;
  totalScore: number;
  totalCleared: number;
  cascades: number;
  greedyScore: number;
  steps: CascadeStep[];
  finalSnapshot: BoardSnapshot;
}

export interface SimulatedMove {
  move: Move;
  result: SimulationResult;
}

export interface MoveEvaluation {
  move: Move;
  totalScore: number;
  greedyScore: number;
  cascades: number;
  opponentPressure: number;
  composite: number;
}

export interface ThoughtPattern {
  direction: 'horizontal' | 'vertical';
  size: number;
}

export interface ThoughtPreview extends MoveEvaluation {
  previewCells: GridPosition[];
  patterns: ThoughtPattern[];
}

export interface AIDecision {
  selected: ThoughtPreview;
  candidates: ThoughtPreview[];
  depthUsed: number;
}

export interface ScoreBook {
  player: number;
  ai: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  description: string;
  rows: number;
  cols: number;
  colorCount: number;
  seed: number;
  turnsPerSide: number;
  targetScore: number;
  aiThinkTime: number;
  palette: number[];
  accentColor: number;
  backgroundTop: number;
  backgroundBottom: number;
}

export interface BoardLayout {
  x: number;
  y: number;
  cellSize: number;
  width: number;
  height: number;
}

export interface TurnResolution {
  move: Move;
  owner: PlayerSide;
  result: SimulationResult;
}

export interface BoardCallbacks {
  onValidSwap?: (owner: PlayerSide, move: Move) => void;
  onInvalidSwap?: (owner: PlayerSide, move: Move) => void;
  onCascade?: (step: CascadeStep, index: number) => void;
}

export const TILE_PALETTE: number[] = [
  0xff6b6b,
  0xff9f43,
  0xffdd59,
  0x1dd1a1,
  0x54a0ff,
  0x7d5fff,
  0xf368e0,
  0x48dbfb
];

export const EMPTY_TILE = -1;
