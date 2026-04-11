export type TileId = 'ember' | 'aqua' | 'flora' | 'nova' | 'pulse' | 'void';

export interface TileDefinition {
  id: TileId;
  label: string;
  symbol: string;
}

export type Board = TileId[][];

export interface CellPosition {
  row: number;
  col: number;
}

export interface Move {
  from: CellPosition;
  to: CellPosition;
}

export interface ResolutionResult {
  valid: boolean;
  board: Board;
  score: number;
  cleared: number;
  chains: number;
  largestMatch: number;
}

export interface MoveCandidate {
  move: Move;
  result: ResolutionResult;
  heuristic: number;
  label: string;
  reason: string;
}

export interface ArenaTheme {
  id: string;
  name: string;
  strapline: string;
  goalScore: number;
  rounds: number;
  shellGradient: string;
  accent: string;
  accentSoft: string;
  accentWarm: string;
}

export interface HistoryEntry {
  actor: 'player' | 'ai';
  label: string;
  score: number;
  chains: number;
  cleared: number;
}

export interface ResolutionSummary {
  actor: 'player' | 'ai';
  score: number;
  chains: number;
  cleared: number;
  label: string;
}

export type FeedbackKind =
  | 'idle'
  | 'restart'
  | 'theme'
  | 'select'
  | 'hint'
  | 'invalid'
  | 'player-move'
  | 'ai-move';

export interface FeedbackEvent {
  kind: FeedbackKind;
  stamp: number;
}

export interface GameState {
  themeIndex: number;
  theme: ArenaTheme;
  board: Board;
  phase: 'player' | 'ai' | 'complete';
  round: number;
  roundsTotal: number;
  goalScore: number;
  playerScore: number;
  aiScore: number;
  selected: CellPosition | null;
  hint: Move | null;
  status: string;
  availableMoves: number;
  aiInsights: MoveCandidate[];
  history: HistoryEntry[];
  lastResolution: ResolutionSummary | null;
  feedback: FeedbackEvent;
}
