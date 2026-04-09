import * as Phaser from 'phaser';
import { Tile } from './Tile';
import { DISPLAY_FONT_FAMILY, UI_FONT_FAMILY, WARM_EASING, darken, hexToCss, lighten, mixColor } from './visuals';
import {
  BoardCallbacks,
  BoardLayout,
  BoardSnapshot,
  CascadeStep,
  EMPTY_TILE,
  GridPosition,
  LevelConfig,
  MatchGroup,
  Move,
  PlayerSide,
  SimulatedMove,
  SimulationResult,
  TileDrop,
  TileSpawn,
  TurnResolution
} from './types';

interface DragState {
  tile: Tile;
  x: number;
  y: number;
}

interface PlayableSnapshotResult {
  snapshot: BoardSnapshot;
  reshuffled: boolean;
}

const isAdjacent = (move: Move): boolean => {
  const rowDiff = Math.abs(move.from.row - move.to.row);
  const colDiff = Math.abs(move.from.col - move.to.col);

  return rowDiff + colDiff === 1;
};

const cloneGrid = (grid: number[][]): number[][] => grid.map((row) => row.slice());

const cloneSnapshot = (snapshot: BoardSnapshot): BoardSnapshot => ({
  rows: snapshot.rows,
  cols: snapshot.cols,
  colorCount: snapshot.colorCount,
  rngState: snapshot.rngState,
  grid: cloneGrid(snapshot.grid)
});

const cellKey = ({ row, col }: GridPosition): string => `${row}:${col}`;

const nextSeed = (seed: number): number => (seed * 1664525 + 1013904223) >>> 0;

const takeRandom = (seed: number, maxExclusive: number): { seed: number; value: number } => {
  const next = nextSeed(seed);

  return {
    seed: next,
    value: next % maxExclusive
  };
};

export class Board {
  private readonly boardShadow: Phaser.GameObjects.Graphics;
  private readonly boardBackdrop: Phaser.GameObjects.Graphics;
  private readonly boardGlow: Phaser.GameObjects.Graphics;
  private readonly boardSurface: Phaser.GameObjects.Graphics;
  private readonly particles: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparkParticles: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly movePreviewOverlay: Phaser.GameObjects.Graphics;
  private readonly previewPulseLayer: Phaser.GameObjects.Container;
  private readonly ambientLayer: Phaser.GameObjects.Container;
  private readonly ambientMotes: Phaser.GameObjects.Image[] = [];
  private readonly previewPulses: Phaser.GameObjects.Image[] = [];
  private previewGlowTiles: Tile[] = [];
  private readonly tiles: Array<Array<Tile | null>>;
  private layout: BoardLayout = { x: 0, y: 0, cellSize: 64, width: 0, height: 0 };
  private snapshot: BoardSnapshot;
  private inputEnabled = false;
  private dragState?: DragState;
  private hintMove?: Move;
  private selectedTile?: Tile;
  private busy = false;
  private auraPhase = Math.random() * Math.PI * 2;
  private previewSignature?: string;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: LevelConfig,
    private readonly onPlayerMove: (move: Move) => Promise<boolean> | boolean,
    private readonly callbacks?: BoardCallbacks
  ) {
    this.snapshot = Board.createStartingSnapshot(level);
    this.tiles = Array.from({ length: level.rows }, () =>
      Array.from({ length: level.cols }, () => null)
    );
    this.boardShadow = scene.add.graphics().setDepth(0);
    this.boardBackdrop = scene.add.graphics().setDepth(1);
    this.boardGlow = scene.add.graphics().setDepth(2);
    this.boardSurface = scene.add.graphics().setDepth(3);
    this.ambientLayer = scene.add.container(0, 0).setDepth(4);
    this.particles = scene.add.particles(0, 0, 'particle-petal', {
      lifespan: { min: 380, max: 620 },
      speed: { min: 30, max: 190 },
      scale: { start: 0.34, end: 0 },
      rotate: { min: -180, max: 180 },
      alpha: { start: 0.94, end: 0 },
      blendMode: Phaser.BlendModes.SCREEN,
      tint: level.palette.slice(0, level.colorCount)
    });
    this.sparkParticles = scene.add.particles(0, 0, 'particle-bloom', {
      lifespan: { min: 300, max: 520 },
      speed: { min: 16, max: 110 },
      scale: { start: 0.26, end: 0 },
      rotate: { min: -180, max: 180 },
      alpha: { start: 0.78, end: 0 },
      blendMode: Phaser.BlendModes.SCREEN,
      tint: level.palette.slice(0, level.colorCount)
    });
    this.particles.setDepth(175);
    this.sparkParticles.setDepth(176);
    this.movePreviewOverlay = scene.add.graphics().setDepth(180);
    this.previewPulseLayer = scene.add.container(0, 0).setDepth(181);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.updateBoardAura, this);

    void this.rebuildFromSnapshot(false);
  }

  public static createStartingSnapshot(level: LevelConfig): BoardSnapshot {
    return Board.createPlayableSnapshot(level.rows, level.cols, level.colorCount, level.seed);
  }

  public static ensurePlayableSnapshot(snapshot: BoardSnapshot): PlayableSnapshotResult {
    const hasMoves = Board.getSimulatedMoves(snapshot).length > 0;

    if (hasMoves) {
      return {
        snapshot,
        reshuffled: false
      };
    }

    return {
      snapshot: Board.reshuffleSnapshot(snapshot),
      reshuffled: true
    };
  }

  public static getSimulatedMoves(snapshot: BoardSnapshot): SimulatedMove[] {
    const moves: SimulatedMove[] = [];

    for (let row = 0; row < snapshot.rows; row += 1) {
      for (let col = 0; col < snapshot.cols; col += 1) {
        if (col < snapshot.cols - 1) {
          const move: Move = {
            from: { row, col },
            to: { row, col: col + 1 }
          };
          const result = Board.simulateMove(snapshot, move);

          if (result.valid) {
            moves.push({ move, result });
          }
        }

        if (row < snapshot.rows - 1) {
          const move: Move = {
            from: { row, col },
            to: { row: row + 1, col }
          };
          const result = Board.simulateMove(snapshot, move);

          if (result.valid) {
            moves.push({ move, result });
          }
        }
      }
    }

    return moves;
  }

  public static simulateMove(snapshot: BoardSnapshot, move: Move): SimulationResult {
    if (!isAdjacent(move)) {
      return {
        valid: false,
        totalScore: 0,
        totalCleared: 0,
        cascades: 0,
        greedyScore: 0,
        steps: [],
        finalSnapshot: cloneSnapshot(snapshot)
      };
    }

    const working = cloneSnapshot(snapshot);
    Board.swapGridCells(working.grid, move.from, move.to);

    let groups = Board.findMatchGroups(working.grid);

    if (groups.length === 0) {
      return {
        valid: false,
        totalScore: 0,
        totalCleared: 0,
        cascades: 0,
        greedyScore: 0,
        steps: [],
        finalSnapshot: cloneSnapshot(snapshot)
      };
    }

    const steps: CascadeStep[] = [];
    let totalScore = 0;
    let totalCleared = 0;
    let cascades = 0;
    let greedyScore = 0;

    while (groups.length > 0) {
      cascades += 1;

      const matchedCells = Board.uniqueCells(groups);
      const stepScore = Board.scoreGroups(groups, cascades);
      totalScore += stepScore;
      totalCleared += matchedCells.length;

      if (cascades === 1) {
        greedyScore = stepScore + matchedCells.length * 20;
      }

      const afterClear = cloneGrid(working.grid);

      for (const cell of matchedCells) {
        afterClear[cell.row][cell.col] = EMPTY_TILE;
      }

      const collapseResult = Board.collapseGrid(afterClear);
      const refillResult = Board.fillGridGaps(
        collapseResult.grid,
        working.rngState,
        working.colorCount
      );

      working.grid = refillResult.grid;
      working.rngState = refillResult.rngState;

      steps.push({
        matchedCells,
        groups,
        score: stepScore,
        cleared: matchedCells.length,
        drops: collapseResult.drops,
        spawns: refillResult.spawns,
        board: cloneGrid(working.grid)
      });

      groups = Board.findMatchGroups(working.grid);
    }

    return {
      valid: true,
      totalScore,
      totalCleared,
      cascades,
      greedyScore,
      steps,
      finalSnapshot: cloneSnapshot(working)
    };
  }

  public getSnapshot(): BoardSnapshot {
    return cloneSnapshot(this.snapshot);
  }

  public setPlayerInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    this.scene.input.setDraggable(this.getAllTiles(), enabled);

    if (!enabled) {
      this.clearSelection();
      this.clearMovePreview();
    }
  }

  public resize(layout: BoardLayout): void {
    this.layout = layout;
    this.drawBoardFrame();
    this.rebuildAmbientMotes();
    this.updateBoardAura(0, 0);

    for (let row = 0; row < this.snapshot.rows; row += 1) {
      for (let col = 0; col < this.snapshot.cols; col += 1) {
        const tile = this.tiles[row][col];

        if (!tile) {
          continue;
        }

        const position = this.getCellPosition(row, col);
        tile.setTileSize(layout.cellSize).setPosition(position.x, position.y).setGridPosition(row, col);
      }
    }
  }

  public showHint(move: Move | null): void {
    this.clearHint();

    if (!move) {
      return;
    }

    this.hintMove = move;
    this.getTileAt(move.from)?.setHint(true);
    this.getTileAt(move.to)?.setHint(true);
  }

  public clearHint(): void {
    if (!this.hintMove) {
      return;
    }

    this.getTileAt(this.hintMove.from)?.setHint(false);
    this.getTileAt(this.hintMove.to)?.setHint(false);
    this.hintMove = undefined;
  }

  public showMovePreview(
    move: Move | null,
    previewCells: GridPosition[] = [],
    color = 0x5dd6ff,
    animated = true
  ): void {
    const signature = move
      ? `${cellKey(move.from)}>${cellKey(move.to)}:${color}:${previewCells.map((cell) => cellKey(cell)).join('|')}:${animated ? '1' : '0'}`
      : undefined;

    if (signature && this.previewSignature === signature) {
      return;
    }

    this.previewSignature = signature;
    this.movePreviewOverlay.clear();
    this.clearPreviewPulses();
    this.clearPreviewGlowTiles();

    if (!move) {
      return;
    }

    const from = this.getCellPosition(move.from.row, move.from.col);
    const to = this.getCellPosition(move.to.row, move.to.col);
    const angle = Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y);
    const headSize = Math.max(16, this.layout.cellSize * 0.18);
    const offset = this.layout.cellSize * 0.1;
    const startX = from.x + Math.cos(angle) * offset;
    const startY = from.y + Math.sin(angle) * offset;
    const endX = to.x - Math.cos(angle) * offset;
    const endY = to.y - Math.sin(angle) * offset;

    this.movePreviewOverlay
      .lineStyle(14, color, 0.12)
      .lineBetween(startX, startY, endX, endY)
      .lineStyle(7, this.lighten(color, 0.26), 0.34)
      .lineBetween(startX, startY, endX, endY)
      .lineStyle(3, 0xffffff, 0.88)
      .lineBetween(startX, startY, endX, endY)
      .fillStyle(this.lighten(color, 0.3), 0.26)
      .fillCircle(startX, startY, this.layout.cellSize * 0.18)
      .fillStyle(this.lighten(color, 0.22), 0.28)
      .fillCircle(endX, endY, this.layout.cellSize * 0.22);

    const leftAngle = angle + Math.PI * 0.84;
    const rightAngle = angle - Math.PI * 0.84;

    this.movePreviewOverlay
      .fillStyle(this.lighten(color, 0.08), 0.95)
      .fillTriangle(
        to.x,
        to.y,
        to.x + Math.cos(leftAngle) * headSize,
        to.y + Math.sin(leftAngle) * headSize,
        to.x + Math.cos(rightAngle) * headSize,
        to.y + Math.sin(rightAngle) * headSize
      );

    const endpoints = [this.getTileAt(move.from), this.getTileAt(move.to)].filter(
      (tile): tile is Tile => tile !== null
    );

    for (const tile of endpoints) {
      tile.setPreviewGlow(true, color);
      this.previewGlowTiles.push(tile);
    }

    const uniquePreview = Array.from(new Set(previewCells.map((cell) => cellKey(cell)))).map((key) => {
      const [row, col] = key.split(':').map(Number);
      return { row, col };
    });

    for (const cell of uniquePreview) {
      const point = this.getCellPosition(cell.row, cell.col);
      const size = this.layout.cellSize * 0.72;

      this.movePreviewOverlay
        .fillStyle(this.lighten(color, 0.22), 0.16)
        .fillRoundedRect(point.x - size / 2, point.y - size / 2, size, size, 16)
        .lineStyle(3, color, 0.5)
        .strokeRoundedRect(point.x - size / 2, point.y - size / 2, size, size, 16);

      const tile = this.getTileAt(cell);
      if (tile && !this.previewGlowTiles.includes(tile)) {
        tile.setPreviewGlow(true, color);
        this.previewGlowTiles.push(tile);
      }
    }

    if (animated) {
      this.spawnPreviewPulses(startX, startY, endX, endY, color);
    }
  }

  public clearMovePreview(): void {
    this.movePreviewOverlay.clear();
    this.previewSignature = undefined;
    this.clearPreviewPulses();
    this.clearPreviewGlowTiles();
  }

  public async flashMove(move: Move, duration = 380): Promise<void> {
    this.showHint(move);
    await this.wait(duration);
    this.clearHint();
  }

  public async performMove(move: Move, owner: PlayerSide): Promise<TurnResolution | null> {
    if (this.busy) {
      return null;
    }

    const first = this.getTileAt(move.from);
    const second = this.getTileAt(move.to);

    if (!first || !second) {
      return null;
    }

    const restoreInput = this.inputEnabled;

    this.busy = true;
    this.clearHint();
    this.clearSelection();
    this.clearMovePreview();
    this.setPlayerInputEnabled(false);
    this.dragState = undefined;

    const simulation = Board.simulateMove(this.snapshot, move);
    await this.animateSwap(first, second, move.to, move.from);

    if (!simulation.valid) {
      this.callbacks?.onInvalidSwap?.(owner, move);
      await this.animateSwap(first, second, move.from, move.to);
      first.setDragging(false);
      second.setDragging(false);
      this.busy = false;
      this.setPlayerInputEnabled(restoreInput);
      return null;
    }

    this.callbacks?.onValidSwap?.(owner, move);
    this.swapTileReferences(move);

    for (let index = 0; index < simulation.steps.length; index += 1) {
      await this.runCascadeStep(simulation.steps[index], index);
    }

    this.snapshot = cloneSnapshot(simulation.finalSnapshot);

    const playable = Board.ensurePlayableSnapshot(this.snapshot);

    if (playable.reshuffled) {
      this.snapshot = playable.snapshot;
      await this.rebuildFromSnapshot(true);
    }

    this.busy = false;

    return {
      move,
      owner,
      result: {
        ...simulation,
        finalSnapshot: cloneSnapshot(this.snapshot)
      }
    };
  }

  public destroy(): void {
    this.getAllTiles().forEach((tile) => tile.destroy());
    this.ambientMotes.forEach((mote) => mote.destroy());
    this.clearPreviewPulses();
    this.clearPreviewGlowTiles();
    this.previewPulseLayer.destroy();
    this.ambientLayer.destroy();
    this.particles.destroy();
    this.sparkParticles.destroy();
    this.movePreviewOverlay.destroy();
    this.boardShadow.destroy();
    this.boardBackdrop.destroy();
    this.boardGlow.destroy();
    this.boardSurface.destroy();
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.updateBoardAura, this);
  }

  private static createPlayableSnapshot(
    rows: number,
    cols: number,
    colorCount: number,
    seed: number
  ): BoardSnapshot {
    let rngState = seed;

    for (let attempt = 0; attempt < 64; attempt += 1) {
      const grid: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          let chosen = 0;
          let attempts = 0;

          do {
            const random = takeRandom(rngState, colorCount);
            rngState = random.seed;
            chosen = random.value;
            attempts += 1;
          } while (
            attempts < 12 &&
            ((col >= 2 && grid[row][col - 1] === chosen && grid[row][col - 2] === chosen) ||
              (row >= 2 && grid[row - 1][col] === chosen && grid[row - 2][col] === chosen))
          );

          grid[row][col] = chosen;
        }
      }

      const candidate: BoardSnapshot = {
        rows,
        cols,
        colorCount,
        rngState,
        grid
      };

      if (Board.getSimulatedMoves(candidate).length > 0) {
        return candidate;
      }
    }

    return {
      rows,
      cols,
      colorCount,
      rngState,
      grid: Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => (row * cols + col) % colorCount)
      )
    };
  }

  private static reshuffleSnapshot(snapshot: BoardSnapshot): BoardSnapshot {
    let rngState = snapshot.rngState;
    const values = snapshot.grid.flat();

    for (let attempt = 0; attempt < 80; attempt += 1) {
      const shuffled = values.slice();

      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const random = takeRandom(rngState, index + 1);
        rngState = random.seed;
        const swapIndex = random.value;
        const temp = shuffled[index];
        shuffled[index] = shuffled[swapIndex];
        shuffled[swapIndex] = temp;
      }

      const grid: number[][] = [];

      for (let row = 0; row < snapshot.rows; row += 1) {
        grid.push(shuffled.slice(row * snapshot.cols, (row + 1) * snapshot.cols));
      }

      const candidate: BoardSnapshot = {
        rows: snapshot.rows,
        cols: snapshot.cols,
        colorCount: snapshot.colorCount,
        rngState,
        grid
      };

      if (Board.findMatchGroups(candidate.grid).length === 0 && Board.getSimulatedMoves(candidate).length > 0) {
        return candidate;
      }
    }

    return Board.createPlayableSnapshot(
      snapshot.rows,
      snapshot.cols,
      snapshot.colorCount,
      rngState
    );
  }

  private static swapGridCells(grid: number[][], first: GridPosition, second: GridPosition): void {
    const value = grid[first.row][first.col];
    grid[first.row][first.col] = grid[second.row][second.col];
    grid[second.row][second.col] = value;
  }

  private static findMatchGroups(grid: number[][]): MatchGroup[] {
    const groups: MatchGroup[] = [];
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;

    for (let row = 0; row < rows; row += 1) {
      let col = 0;

      while (col < cols) {
        const type = grid[row][col];

        if (type === EMPTY_TILE) {
          col += 1;
          continue;
        }

        let end = col + 1;

        while (end < cols && grid[row][end] === type) {
          end += 1;
        }

        if (end - col >= 3) {
          groups.push({
            direction: 'horizontal',
            type,
            cells: Array.from({ length: end - col }, (_, index) => ({ row, col: col + index }))
          });
        }

        col = end;
      }
    }

    for (let col = 0; col < cols; col += 1) {
      let row = 0;

      while (row < rows) {
        const type = grid[row][col];

        if (type === EMPTY_TILE) {
          row += 1;
          continue;
        }

        let end = row + 1;

        while (end < rows && grid[end][col] === type) {
          end += 1;
        }

        if (end - row >= 3) {
          groups.push({
            direction: 'vertical',
            type,
            cells: Array.from({ length: end - row }, (_, index) => ({ row: row + index, col }))
          });
        }

        row = end;
      }
    }

    return groups;
  }

  private static uniqueCells(groups: MatchGroup[]): GridPosition[] {
    const seen = new Set<string>();
    const unique: GridPosition[] = [];

    for (const group of groups) {
      for (const cell of group.cells) {
        const key = cellKey(cell);

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        unique.push(cell);
      }
    }

    return unique;
  }

  private static scoreGroups(groups: MatchGroup[], cascadeIndex: number): number {
    const uniqueCount = Board.uniqueCells(groups).length;
    const groupPoints = groups.reduce(
      (total, group) => total + group.cells.length * 120 + Math.max(0, group.cells.length - 3) * 90,
      0
    );
    const comboMultiplier = 1 + (cascadeIndex - 1) * 0.35;

    return Math.round((groupPoints + uniqueCount * 30) * comboMultiplier);
  }

  private static collapseGrid(grid: number[][]): { grid: number[][]; drops: TileDrop[] } {
    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    const next = Array.from({ length: rows }, () => Array.from({ length: cols }, () => EMPTY_TILE));
    const drops: TileDrop[] = [];

    for (let col = 0; col < cols; col += 1) {
      let writeRow = rows - 1;

      for (let row = rows - 1; row >= 0; row -= 1) {
        const type = grid[row][col];

        if (type === EMPTY_TILE) {
          continue;
        }

        next[writeRow][col] = type;

        if (writeRow !== row) {
          drops.push({
            fromRow: row,
            toRow: writeRow,
            col,
            type
          });
        }

        writeRow -= 1;
      }
    }

    drops.sort((left, right) => right.fromRow - left.fromRow);

    return {
      grid: next,
      drops
    };
  }

  private static fillGridGaps(
    grid: number[][],
    seed: number,
    colorCount: number
  ): { grid: number[][]; spawns: TileSpawn[]; rngState: number } {
    const next = cloneGrid(grid);
    const rows = next.length;
    const cols = next[0]?.length ?? 0;
    const spawns: TileSpawn[] = [];
    let rngState = seed;

    for (let col = 0; col < cols; col += 1) {
      const emptyRows: number[] = [];

      for (let row = 0; row < rows; row += 1) {
        if (next[row][col] === EMPTY_TILE) {
          emptyRows.push(row);
        }
      }

      let spawnDepth = 1;

      for (let index = emptyRows.length - 1; index >= 0; index -= 1) {
        const row = emptyRows[index];
        const random = takeRandom(rngState, colorCount);
        rngState = random.seed;
        next[row][col] = random.value;
        spawns.push({
          row,
          col,
          type: random.value,
          spawnRow: -spawnDepth
        });
        spawnDepth += 1;
      }
    }

    return {
      grid: next,
      spawns,
      rngState
    };
  }

  private async rebuildFromSnapshot(animate: boolean): Promise<void> {
    this.clearSelection();
    const existing = this.getAllTiles();

    if (animate && existing.length > 0) {
      await Promise.all(
        existing.map((tile) =>
          this.tween(tile, {
            alpha: 0,
            scaleX: 0.6,
            scaleY: 0.6,
            duration: 220,
            ease: WARM_EASING.press
          })
        )
      );
    }

    existing.forEach((tile) => tile.destroy());

    for (let row = 0; row < this.tiles.length; row += 1) {
      for (let col = 0; col < this.tiles[row].length; col += 1) {
        this.tiles[row][col] = null;
      }
    }

    for (let row = 0; row < this.snapshot.rows; row += 1) {
      for (let col = 0; col < this.snapshot.cols; col += 1) {
        const tile = new Tile(
          this.scene,
          row,
          col,
          this.snapshot.grid[row][col],
          this.layout.cellSize,
          this.level.palette[this.snapshot.grid[row][col] % this.level.palette.length]
        );
        const position = this.getCellPosition(row, col);
        tile.setTileSize(this.layout.cellSize).setPosition(position.x, position.y).setGridPosition(row, col);
        tile.setAlpha(animate ? 0 : 1);
        tile.setScale(animate ? 0.65 : 1);
        this.bindTile(tile);
        this.tiles[row][col] = tile;
      }
    }

    if (animate) {
      await Promise.all(
        this.getAllTiles().map((tile, index) =>
          this.tween(tile, {
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            delay: index * 12,
            duration: 260,
            ease: WARM_EASING.settle
          })
        )
      );
    }

    this.setPlayerInputEnabled(this.inputEnabled);
    this.drawBoardFrame();
  }

  private bindTile(tile: Tile): void {
    tile.on('pointerdown', async (pointer: Phaser.Input.Pointer) => {
      if (!this.inputEnabled || this.busy || this.dragState || !pointer.isDown) {
        return;
      }

      await this.handleTileTap(tile);
    });

    tile.on('dragstart', () => {
      if (!this.inputEnabled || this.busy) {
        return;
      }

      this.clearHint();
      this.clearSelection();
      this.clearMovePreview();
      this.dragState = {
        tile,
        x: tile.x,
        y: tile.y
      };
      tile.setDragging(true);
    });

    tile.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (!this.dragState || this.dragState.tile !== tile || !this.inputEnabled || this.busy) {
        return;
      }

      const maxDistance = this.layout.cellSize * 0.92;
      const deltaX = Phaser.Math.Clamp(dragX - this.dragState.x, -maxDistance, maxDistance);
      const deltaY = Phaser.Math.Clamp(dragY - this.dragState.y, -maxDistance, maxDistance);
      const previewMove = this.moveFromOffset(tile, deltaX, deltaY);

      if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        tile.setPosition(this.dragState.x + deltaX, this.dragState.y);
      } else {
        tile.setPosition(this.dragState.x, this.dragState.y + deltaY);
      }

      if (previewMove) {
        this.showMovePreview(previewMove, [], this.level.accentColor, true);
      } else {
        this.clearMovePreview();
      }
    });

    tile.on('dragend', async () => {
      if (!this.dragState || this.dragState.tile !== tile) {
        return;
      }

      tile.setDragging(false);

      if (!this.inputEnabled || this.busy) {
        await this.snapBack(tile, tile.row, tile.col);
        this.clearMovePreview();
        this.dragState = undefined;
        return;
      }

      const move = this.moveFromDrag(tile);

      if (!move) {
        await this.snapBack(tile, tile.row, tile.col);
        this.clearMovePreview();
        this.dragState = undefined;
        return;
      }

      const accepted = await Promise.resolve(this.onPlayerMove(move));

      if (!accepted) {
        await this.snapBack(tile, tile.row, tile.col);
      }

      this.clearMovePreview();
      this.dragState = undefined;
    });
  }

  private async handleTileTap(tile: Tile): Promise<void> {
    if (this.selectedTile === tile) {
      this.clearSelection();
      return;
    }

    if (!this.selectedTile) {
      this.selectedTile = tile;
      tile.setSelected(true);
      return;
    }

    const previous = this.selectedTile;

    if (this.areAdjacent(previous, tile)) {
      this.showMovePreview(
        {
          from: { row: previous.row, col: previous.col },
          to: { row: tile.row, col: tile.col }
        },
        [],
        this.level.accentColor,
        true
      );
      this.clearSelection();
      await Promise.resolve(
        this.onPlayerMove({
          from: { row: previous.row, col: previous.col },
          to: { row: tile.row, col: tile.col }
        })
      );
      return;
    }

    previous.setSelected(false);
    this.selectedTile = tile;
    tile.setSelected(true);
  }

  private moveFromDrag(tile: Tile): Move | null {
    const origin = this.getCellPosition(tile.row, tile.col);
    const deltaX = tile.x - origin.x;
    const deltaY = tile.y - origin.y;
    return this.moveFromOffset(tile, deltaX, deltaY);
  }

  private moveFromOffset(tile: Tile, deltaX: number, deltaY: number): Move | null {
    const threshold = this.layout.cellSize * 0.3;

    if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) {
      return null;
    }

    let targetRow = tile.row;
    let targetCol = tile.col;

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      targetCol += deltaX > 0 ? 1 : -1;
    } else {
      targetRow += deltaY > 0 ? 1 : -1;
    }

    if (
      targetRow < 0 ||
      targetRow >= this.snapshot.rows ||
      targetCol < 0 ||
      targetCol >= this.snapshot.cols
    ) {
      return null;
    }

    return {
      from: { row: tile.row, col: tile.col },
      to: { row: targetRow, col: targetCol }
    };
  }

  private drawBoardFrame(): void {
    if (this.layout.width <= 0 || this.layout.height <= 0) {
      return;
    }

    const frame = this.getBoardFrameRect();

    this.boardShadow
      .clear()
      .fillStyle(0xb88b8d, 0.14)
      .fillRoundedRect(frame.x + 8, frame.y + 12, frame.width, frame.height, 34);

    this.boardBackdrop.clear();
    this.boardBackdrop.fillGradientStyle(
      0xfffbf7,
      this.lighten(this.level.backgroundTop, 0.42),
      this.lighten(this.level.backgroundBottom, 0.36),
      0xfff6ee,
      0.92,
      0.88,
      0.94,
      0.96
    );
    this.boardBackdrop.fillRoundedRect(frame.x, frame.y, frame.width, frame.height, 34);
    this.boardBackdrop
      .fillStyle(0xffffff, 0.48)
      .fillRoundedRect(frame.x + 8, frame.y + 8, frame.width - 16, frame.height * 0.16, 26)
      .fillStyle(this.lighten(this.level.accentColor, 0.42), 0.08)
      .fillEllipse(frame.centerX, frame.y + frame.height * 0.16, frame.width * 0.72, frame.height * 0.18);

    this.boardSurface
      .clear()
      .lineStyle(2, this.lighten(this.level.accentColor, 0.28), 0.58)
      .strokeRoundedRect(frame.x, frame.y, frame.width, frame.height, 34)
      .lineStyle(1, 0xffffff, 0.78)
      .strokeRoundedRect(frame.x + 4, frame.y + 4, frame.width - 8, frame.height - 8, 28);

    for (let row = 0; row < this.snapshot.rows; row += 1) {
      for (let col = 0; col < this.snapshot.cols; col += 1) {
        const position = this.getCellPosition(row, col);
        const size = this.layout.cellSize * 0.9;
        const slotX = position.x - size / 2;
        const slotY = position.y - size / 2;

        this.boardSurface
          .fillGradientStyle(0xffffff, 0xfff7f4, 0xfff0eb, 0xfffbf7, 0.72, 0.68, 0.8, 0.84)
          .fillRoundedRect(slotX, slotY, size, size, 20)
          .lineStyle(1, this.lighten(this.level.accentColor, 0.44), 0.38)
          .strokeRoundedRect(slotX, slotY, size, size, 20)
          .fillStyle(0xffffff, 0.24)
          .fillRoundedRect(slotX + 5, slotY + 4, size - 10, size * 0.22, 14);
      }
    }
  }

  private getCellPosition(row: number, col: number): Phaser.Types.Math.Vector2Like {
    return {
      x: this.layout.x + col * this.layout.cellSize,
      y: this.layout.y + row * this.layout.cellSize
    };
  }

  private getAllTiles(): Tile[] {
    return this.tiles.flat().filter((tile): tile is Tile => tile !== null);
  }

  private getTileAt(position: GridPosition): Tile | null {
    return this.tiles[position.row]?.[position.col] ?? null;
  }

  private spawnPreviewPulses(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    color: number
  ): void {
    const pulseCount = 4;

    for (let index = 0; index < pulseCount; index += 1) {
      const pulse = this.scene.add
        .image(
          startX,
          startY,
          index === pulseCount - 1 ? 'particle-streak' : index % 2 === 0 ? 'particle-bloom' : 'particle-soft'
        )
        .setTint(index === pulseCount - 1 ? 0xffffff : this.lighten(color, 0.3))
        .setAlpha(index === pulseCount - 1 ? 0.9 : 0.76)
        .setScale(index === pulseCount - 1 ? 0.16 : 0.22)
        .setBlendMode(Phaser.BlendModes.SCREEN);

      this.previewPulseLayer.add(pulse);
      this.previewPulses.push(pulse);

      this.scene.tweens.add({
        targets: pulse,
        x: endX,
        y: endY,
        alpha: { from: pulse.alpha, to: 0.12 },
        duration: 520,
        ease: WARM_EASING.soft,
        repeat: -1,
        delay: index * 150
      });
    }
  }

  private clearPreviewPulses(): void {
    for (const pulse of this.previewPulses) {
      this.scene.tweens.killTweensOf(pulse);
      pulse.destroy();
    }

    this.previewPulses.length = 0;
  }

  private clearPreviewGlowTiles(): void {
    for (const tile of this.previewGlowTiles) {
      tile.setPreviewGlow(false);
    }

    this.previewGlowTiles = [];
  }

  private updateBoardAura(_time: number, delta: number): void {
    if (this.layout.width <= 0 || this.layout.height <= 0) {
      return;
    }

    this.auraPhase += Math.max(delta, 16) * 0.001;

    const frame = this.getBoardFrameRect();
    const accent = this.lighten(this.level.accentColor, 0.36);

    this.boardGlow.clear();
    this.boardGlow
      .fillStyle(0xffffff, 0.12)
      .fillEllipse(
        frame.x + frame.width * 0.5,
        frame.y + frame.height * 0.12,
        frame.width * 0.64,
        frame.height * 0.1
      )
      .fillStyle(accent, 0.04 + Math.sin(this.auraPhase * 1.1) * 0.02)
      .fillEllipse(frame.centerX, frame.bottom - frame.height * 0.14, frame.width * 0.52, frame.height * 0.08)
      .lineStyle(2, accent, 0.1 + Math.sin(this.auraPhase * 1.1) * 0.02)
      .strokeRoundedRect(frame.x + 2, frame.y + 2, frame.width - 4, frame.height - 4, 30);
  }

  private rebuildAmbientMotes(): void {
    this.ambientLayer.removeAll(true);
    this.ambientMotes.length = 0;

    if (this.layout.width <= 0 || this.layout.height <= 0) {
      return;
    }

    const frame = this.getBoardFrameRect();
    const count = Math.max(6, Math.round((frame.width * frame.height) / 90000));

    for (let index = 0; index < count; index += 1) {
      const mote = this.scene.add
        .image(
          Phaser.Math.Between(frame.x + 20, frame.right - 20),
          Phaser.Math.Between(frame.y + 20, frame.bottom - 20),
          index % 3 === 0 ? 'particle-bloom' : index % 2 === 0 ? 'particle-soft' : 'particle-petal'
        )
        .setTint(
          index % 2 === 0
            ? this.lighten(this.level.accentColor, 0.48)
            : mixColor(this.level.accentColor, 0xffffff, 0.46)
        )
        .setAlpha(Phaser.Math.FloatBetween(0.04, 0.1))
        .setScale(Phaser.Math.FloatBetween(0.1, 0.18))
        .setBlendMode(Phaser.BlendModes.SCREEN);

      this.ambientLayer.add(mote);
      this.ambientMotes.push(mote);

      this.scene.tweens.add({
        targets: mote,
        x: mote.x + Phaser.Math.Between(-34, 34),
        y: mote.y + Phaser.Math.Between(-46, 24),
        alpha: Phaser.Math.FloatBetween(0.04, 0.1),
        scaleX: mote.scaleX * Phaser.Math.FloatBetween(1.08, 1.38),
        scaleY: mote.scaleY * Phaser.Math.FloatBetween(1.08, 1.38),
        duration: Phaser.Math.Between(4200, 7000),
        ease: WARM_EASING.soft,
        yoyo: true,
        repeat: -1,
        delay: index * 110
      });
    }
  }

  private getBoardFrameRect(): Phaser.Geom.Rectangle {
    const padding = 18;

    return new Phaser.Geom.Rectangle(
      this.layout.x - this.layout.cellSize / 2 - padding,
      this.layout.y - this.layout.cellSize / 2 - padding,
      this.layout.width + padding * 2,
      this.layout.height + padding * 2
    );
  }

  private clearSelection(): void {
    if (!this.selectedTile) {
      return;
    }

    this.selectedTile.setSelected(false);
    this.selectedTile = undefined;
  }

  private areAdjacent(first: Tile, second: Tile): boolean {
    return Math.abs(first.row - second.row) + Math.abs(first.col - second.col) === 1;
  }

  private async snapBack(tile: Tile, row: number, col: number): Promise<void> {
    const position = this.getCellPosition(row, col);
    await this.tween(tile, {
      x: position.x,
      y: position.y,
      duration: 180,
      ease: WARM_EASING.reveal
    });
  }

  private async animateSwap(
    first: Tile,
    second: Tile,
    firstTarget: GridPosition,
    secondTarget: GridPosition
  ): Promise<void> {
    const firstPosition = this.getCellPosition(firstTarget.row, firstTarget.col);
    const secondPosition = this.getCellPosition(secondTarget.row, secondTarget.col);

    await Promise.all([
      this.tween(first, {
        x: firstPosition.x,
        y: firstPosition.y,
        duration: 180,
        ease: WARM_EASING.settle
      }),
      this.tween(second, {
        x: secondPosition.x,
        y: secondPosition.y,
        duration: 180,
        ease: WARM_EASING.settle
      })
    ]);
  }

  private swapTileReferences(move: Move): void {
    const first = this.tiles[move.from.row][move.from.col];
    const second = this.tiles[move.to.row][move.to.col];

    this.tiles[move.from.row][move.from.col] = second;
    this.tiles[move.to.row][move.to.col] = first;

    first?.setGridPosition(move.to.row, move.to.col);
    second?.setGridPosition(move.from.row, move.from.col);
  }

  private async runCascadeStep(step: CascadeStep, index: number): Promise<void> {
    this.callbacks?.onCascade?.(step, index);
    const matchedTiles = step.matchedCells
      .map((cell) => this.getTileAt(cell))
      .filter((tile): tile is Tile => tile !== null);
    const comboPower = 1 + index * 0.38 + Math.min(0.9, Math.max(0, step.cleared - 3) * 0.08);

    this.showScorePopup(step.score, step.matchedCells, index);
    this.createCelebrationPulse(step, comboPower);

    await Promise.all(
      matchedTiles.map(async (tile) => {
        const color = this.level.palette[tile.gemType % this.level.palette.length];

        this.particles.explode(Math.round(12 + comboPower * 8), tile.x, tile.y);
        this.sparkParticles.explode(Math.round(8 + comboPower * 6), tile.x, tile.y);
        this.createLightBurst(tile.x, tile.y, color, comboPower);
        this.createShockwave(tile.x, tile.y, color, comboPower);
        await tile.burstDestroy(comboPower);
        this.tiles[tile.row][tile.col] = null;
        tile.destroy();
      })
    );

    const dropTweens: Promise<void>[] = [];

    for (const drop of step.drops) {
      const tile = this.tiles[drop.fromRow][drop.col];

      if (!tile) {
        continue;
      }

      this.tiles[drop.fromRow][drop.col] = null;
      this.tiles[drop.toRow][drop.col] = tile;
      tile.setGridPosition(drop.toRow, drop.col);
      const destination = this.getCellPosition(drop.toRow, drop.col);

      dropTweens.push(
        this.tween(tile, {
          x: destination.x,
          y: destination.y,
          duration: 190 + Math.abs(drop.toRow - drop.fromRow) * 28,
          ease: WARM_EASING.settle
        })
      );
    }

    for (const spawn of step.spawns) {
      const tile = new Tile(
        this.scene,
        spawn.row,
        spawn.col,
        spawn.type,
        this.layout.cellSize,
        this.level.palette[spawn.type % this.level.palette.length]
      );
      const startPosition = this.getCellPosition(spawn.spawnRow, spawn.col);
      const destination = this.getCellPosition(spawn.row, spawn.col);

      tile
        .setTileSize(this.layout.cellSize)
        .setPosition(startPosition.x, startPosition.y)
        .setAlpha(0)
        .setScale(0.75)
        .setGridPosition(spawn.row, spawn.col);

      this.bindTile(tile);
      this.tiles[spawn.row][spawn.col] = tile;

      dropTweens.push(
        this.tween(tile, {
          x: destination.x,
          y: destination.y,
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          duration: 260 + Math.abs(spawn.spawnRow) * 20,
          ease: WARM_EASING.elastic
        })
      );
    }

    await Promise.all(dropTweens);
  }

  private showScorePopup(score: number, cells: GridPosition[], comboIndex: number): void {
    if (cells.length === 0) {
      return;
    }

    const center = cells.reduce(
      (accumulator, cell) => {
        const point = this.getCellPosition(cell.row, cell.col);

        return {
          x: accumulator.x + point.x,
          y: accumulator.y + point.y
        };
      },
      { x: 0, y: 0 }
    );

    const label = comboIndex > 0 ? `+${score} x${comboIndex + 1}` : `+${score}`;
    const text = this.scene.add
      .text(center.x / cells.length, center.y / cells.length, label, {
        fontFamily: DISPLAY_FONT_FAMILY,
        fontSize: '26px',
        fontStyle: '800',
        color: hexToCss(mixColor(this.level.accentColor, 0xfff2b8, 0.44)),
        stroke: '#fffaf4',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(500);

    void this.tween(text, {
      y: text.y - 42,
      alpha: 0,
      duration: 640,
      ease: WARM_EASING.reveal
    }).then(() => text.destroy());
  }

  private createLightBurst(x: number, y: number, color: number, comboPower: number): void {
    const flash = this.scene.add
      .image(x, y, 'particle-soft')
      .setTint(this.lighten(color, 0.42))
      .setAlpha(0.72)
      .setScale(0.38)
      .setDepth(174)
      .setBlendMode(Phaser.BlendModes.SCREEN);

    this.scene.tweens.add({
      targets: flash,
      scaleX: 1.8 + comboPower * 0.34,
      scaleY: 1.8 + comboPower * 0.34,
      alpha: 0,
      duration: 280,
      ease: WARM_EASING.lift,
      onComplete: () => flash.destroy()
    });
  }

  private createShockwave(x: number, y: number, color: number, comboPower: number): void {
    const pulse = this.scene.add.graphics().setDepth(170);
    const glow = this.scene.add
      .image(x, y, 'particle-soft')
      .setTint(color)
      .setAlpha(0.22 + comboPower * 0.06)
      .setScale(0.4)
      .setDepth(169)
      .setBlendMode(Phaser.BlendModes.SCREEN);
    const maxRadius = this.layout.cellSize * (0.68 + comboPower * 0.18);
    const pulseState = { radius: 12, alpha: 0.54 + comboPower * 0.04 };

    const redraw = (): void => {
      pulse.clear();
      pulse.lineStyle(3 + comboPower, this.lighten(color, 0.36), pulseState.alpha);
      pulse.strokeCircle(x, y, pulseState.radius);
      pulse.lineStyle(10 + comboPower * 2, color, pulseState.alpha * 0.16);
      pulse.strokeCircle(x, y, pulseState.radius * 0.92);
    };

    redraw();

    this.scene.tweens.add({
      targets: glow,
      scaleX: 2.1 + comboPower * 0.26,
      scaleY: 2.1 + comboPower * 0.26,
      alpha: 0,
      duration: 320,
      ease: WARM_EASING.lift,
      onComplete: () => glow.destroy()
    });

    this.scene.tweens.add({
      targets: pulseState,
      radius: maxRadius,
      alpha: 0,
      duration: 360,
      ease: WARM_EASING.reveal,
      onUpdate: () => redraw(),
      onComplete: () => pulse.destroy()
    });
  }

  private createCelebrationPulse(step: CascadeStep, comboPower: number): void {
    const width = this.scene.scale.gameSize.width;
    const height = this.scene.scale.gameSize.height;
    const overlay = this.scene.add.graphics().setDepth(168);
    const warmTint = mixColor(this.level.accentColor, 0xffe3bd, 0.42);
    const alpha = Phaser.Math.Clamp(0.04 + comboPower * 0.025 + step.cleared * 0.004, 0.05, 0.14);

    overlay.fillStyle(warmTint, alpha).fillRect(0, 0, width, height);

    this.scene.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 180,
      ease: WARM_EASING.reveal,
      onComplete: () => overlay.destroy()
    });
  }

  private tween(
    target: Phaser.GameObjects.GameObject | object,
    config: Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>
  ): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        ...config,
        targets: target,
        onComplete: () => resolve()
      });
    });
  }

  private wait(duration: number): Promise<void> {
    return new Promise((resolve) => {
      this.scene.time.delayedCall(duration, resolve);
    });
  }

  private lighten(hex: number, factor: number): number {
    const r = (hex >> 16) & 0xff;
    const g = (hex >> 8) & 0xff;
    const b = hex & 0xff;

    return (
      ((Math.round(r + (255 - r) * factor) & 0xff) << 16) |
      ((Math.round(g + (255 - g) * factor) & 0xff) << 8) |
      (Math.round(b + (255 - b) * factor) & 0xff)
    );
  }

  private darken(hex: number, factor: number): number {
    const r = (hex >> 16) & 0xff;
    const g = (hex >> 8) & 0xff;
    const b = hex & 0xff;

    return (
      ((Math.round(r * (1 - factor)) & 0xff) << 16) |
      ((Math.round(g * (1 - factor)) & 0xff) << 8) |
      (Math.round(b * (1 - factor)) & 0xff)
    );
  }
}
