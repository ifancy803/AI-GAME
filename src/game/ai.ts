import { TILES } from './config';
import { formatMoveLabel, listAllMoves, simulateMove } from './engine';
import type { Board, MoveCandidate, TileId } from './types';

function centerBias(boardSize: number, row: number, col: number): number {
  const center = (boardSize - 1) / 2;
  const distance = Math.abs(row - center) + Math.abs(col - center);
  return Math.max(0, 4.8 - distance) * 7;
}

function describeCandidate(candidate: MoveCandidate): string {
  const { cleared, chains, largestMatch } = candidate.result;
  return `预计清除 ${cleared} 枚，${chains} 连锁，最大组合 ${largestMatch}。`;
}

export function analyzeBoard(board: Board, tileIds: TileId[] = TILES.map((tile) => tile.id)): {
  best: MoveCandidate | null;
  topMoves: MoveCandidate[];
  count: number;
} {
  const candidates: MoveCandidate[] = [];

  for (const move of listAllMoves(board)) {
    const result = simulateMove(board, move, tileIds);

    if (!result.valid) {
      continue;
    }

    const heuristic =
      result.score +
      result.chains * 70 +
      result.largestMatch * 34 +
      centerBias(board.length, move.from.row, move.from.col) +
      centerBias(board.length, move.to.row, move.to.col);

    const candidate: MoveCandidate = {
      move,
      result,
      heuristic,
      label: formatMoveLabel(move),
      reason: '',
    };

    candidate.reason = describeCandidate(candidate);
    candidates.push(candidate);
  }

  candidates.sort((left, right) => {
    if (right.heuristic !== left.heuristic) {
      return right.heuristic - left.heuristic;
    }

    return right.result.score - left.result.score;
  });

  return {
    best: candidates[0] ?? null,
    topMoves: candidates.slice(0, 3),
    count: candidates.length,
  };
}
