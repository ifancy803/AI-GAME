import { BOARD_SIZE } from './config';
import type { Board, CellPosition, Move, ResolutionResult, TileId } from './types';

const SCORE_PER_TILE = 65;
const CHAIN_MULTIPLIER = 24;
const LARGE_MATCH_BONUS = 55;

type MutableBoard = (TileId | null)[][];

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function samePosition(a: CellPosition, b: CellPosition): boolean {
  return a.row === b.row && a.col === b.col;
}

function positionKey(position: CellPosition): string {
  return `${position.row}:${position.col}`;
}

function swap(board: Board, from: CellPosition, to: CellPosition): void {
  const next = board[from.row][from.col];
  board[from.row][from.col] = board[to.row][to.col];
  board[to.row][to.col] = next;
}

function isInside(position: CellPosition, size: number): boolean {
  return position.row >= 0 && position.row < size && position.col >= 0 && position.col < size;
}

export function isAdjacent(a: CellPosition, b: CellPosition): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function randomTile(tileIds: TileId[]): TileId {
  return tileIds[Math.floor(Math.random() * tileIds.length)];
}

function buildSeedBoard(size: number, tileIds: TileId[]): Board {
  const board: Board = [];

  for (let row = 0; row < size; row += 1) {
    const nextRow: TileId[] = [];

    for (let col = 0; col < size; col += 1) {
      const allowed = tileIds.filter((tileId) => {
        const hasHorizontalRun =
          col >= 2 && nextRow[col - 1] === tileId && nextRow[col - 2] === tileId;
        const hasVerticalRun =
          row >= 2 && board[row - 1][col] === tileId && board[row - 2][col] === tileId;

        return !hasHorizontalRun && !hasVerticalRun;
      });

      nextRow.push(randomTile(allowed.length > 0 ? allowed : tileIds));
    }

    board.push(nextRow);
  }

  return board;
}

function collectGroups(board: Board): CellPosition[][] {
  const size = board.length;
  const groups: CellPosition[][] = [];

  for (let row = 0; row < size; row += 1) {
    let runStart = 0;

    while (runStart < size) {
      let runEnd = runStart + 1;

      while (runEnd < size && board[row][runEnd] === board[row][runStart]) {
        runEnd += 1;
      }

      if (runEnd - runStart >= 3) {
        const group: CellPosition[] = [];

        for (let col = runStart; col < runEnd; col += 1) {
          group.push({ row, col });
        }

        groups.push(group);
      }

      runStart = runEnd;
    }
  }

  for (let col = 0; col < size; col += 1) {
    let runStart = 0;

    while (runStart < size) {
      let runEnd = runStart + 1;

      while (runEnd < size && board[runEnd][col] === board[runStart][col]) {
        runEnd += 1;
      }

      if (runEnd - runStart >= 3) {
        const group: CellPosition[] = [];

        for (let row = runStart; row < runEnd; row += 1) {
          group.push({ row, col });
        }

        groups.push(group);
      }

      runStart = runEnd;
    }
  }

  return groups;
}

function collapseBoard(board: MutableBoard, tileIds: TileId[]): Board {
  const size = board.length;

  for (let col = 0; col < size; col += 1) {
    const solid: TileId[] = [];

    for (let row = size - 1; row >= 0; row -= 1) {
      const tile = board[row][col];

      if (tile) {
        solid.push(tile);
      }
    }

    for (let row = size - 1; row >= 0; row -= 1) {
      board[row][col] = solid[size - 1 - row] ?? randomTile(tileIds);
    }
  }

  return board.map((row) => row.map((tile) => tile ?? randomTile(tileIds)));
}

function resolveBoard(board: Board, tileIds: TileId[]): Omit<ResolutionResult, 'valid'> {
  let working = cloneBoard(board);
  let score = 0;
  let cleared = 0;
  let chains = 0;
  let largestMatch = 0;

  while (true) {
    const groups = collectGroups(working);

    if (groups.length === 0) {
      break;
    }

    chains += 1;

    const uniqueMatches = new Map<string, CellPosition>();
    let chainLargestMatch = 0;

    groups.forEach((group) => {
      chainLargestMatch = Math.max(chainLargestMatch, group.length);

      group.forEach((position) => {
        uniqueMatches.set(positionKey(position), position);
      });
    });

    const matchedTiles = [...uniqueMatches.values()];
    cleared += matchedTiles.length;
    largestMatch = Math.max(largestMatch, chainLargestMatch);
    score +=
      matchedTiles.length * SCORE_PER_TILE +
      (chains - 1) * matchedTiles.length * CHAIN_MULTIPLIER +
      Math.max(0, chainLargestMatch - 3) * LARGE_MATCH_BONUS;

    const mutableBoard: MutableBoard = working.map((row) => [...row]);

    matchedTiles.forEach((position) => {
      mutableBoard[position.row][position.col] = null;
    });

    working = collapseBoard(mutableBoard, tileIds);
  }

  return {
    board: working,
    score,
    cleared,
    chains,
    largestMatch,
  };
}

export function simulateMove(board: Board, move: Move, tileIds: TileId[]): ResolutionResult {
  const size = board.length;

  if (!isInside(move.from, size) || !isInside(move.to, size) || !isAdjacent(move.from, move.to)) {
    return {
      valid: false,
      board: cloneBoard(board),
      score: 0,
      cleared: 0,
      chains: 0,
      largestMatch: 0,
    };
  }

  const working = cloneBoard(board);
  swap(working, move.from, move.to);

  const resolution = resolveBoard(working, tileIds);

  if (resolution.cleared === 0) {
    return {
      valid: false,
      board: cloneBoard(board),
      score: 0,
      cleared: 0,
      chains: 0,
      largestMatch: 0,
    };
  }

  return {
    valid: true,
    ...resolution,
  };
}

export function listAllMoves(board: Board): Move[] {
  const size = board.length;
  const moves: Move[] = [];

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const origin = { row, col };
      const right = { row, col: col + 1 };
      const down = { row: row + 1, col };

      if (isInside(right, size)) {
        moves.push({ from: origin, to: right });
      }

      if (isInside(down, size)) {
        moves.push({ from: origin, to: down });
      }
    }
  }

  return moves;
}

export function countValidMoves(board: Board, tileIds: TileId[]): number {
  let count = 0;

  for (const move of listAllMoves(board)) {
    if (simulateMove(board, move, tileIds).valid) {
      count += 1;
    }
  }

  return count;
}

export function createPlayableBoard(tileIds: TileId[], size = BOARD_SIZE): Board {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const board = buildSeedBoard(size, tileIds);

    if (countValidMoves(board, tileIds) > 0) {
      return board;
    }
  }

  return buildSeedBoard(size, tileIds);
}

export function ensurePlayableBoard(board: Board, tileIds: TileId[]): Board {
  return countValidMoves(board, tileIds) > 0 ? board : createPlayableBoard(tileIds, board.length);
}

export function formatPosition(position: CellPosition): string {
  const alphabet = 'ABCDEFG';
  return `${alphabet[position.col] ?? '?'}${position.row + 1}`;
}

export function formatMoveLabel(move: Move): string {
  return `${formatPosition(move.from)} → ${formatPosition(move.to)}`;
}

export function positionsEqual(a: CellPosition | null, b: CellPosition | null): boolean {
  if (!a || !b) {
    return false;
  }

  return samePosition(a, b);
}
