import { TILES } from '../game/config';
import { positionsEqual } from '../game/engine';
import type { CellPosition, GameState } from '../game/types';

const tileMap = new Map(TILES.map((tile) => [tile.id, tile]));
const DRAG_THRESHOLD = 18;

interface DragSession {
  pointerId: number;
  startX: number;
  startY: number;
  origin: CellPosition;
  dragged: boolean;
}

export class BoardView {
  private dragSession: DragSession | null = null;
  private boardSize = 0;
  private suppressClick = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly onTilePress: (position: CellPosition) => void,
    private readonly onTileSwap: (from: CellPosition, to: CellPosition) => void,
  ) {
    this.root.addEventListener('pointerdown', (event) => {
      const tile = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-row][data-col]');

      if (!tile) {
        return;
      }

      const row = Number(tile.dataset.row);
      const col = Number(tile.dataset.col);

      this.dragSession = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        origin: { row, col },
        dragged: false,
      };

      tile.setPointerCapture(event.pointerId);
      this.root.classList.add('is-pointer-down');
    });

    this.root.addEventListener('pointermove', (event) => {
      if (!this.dragSession || this.dragSession.pointerId !== event.pointerId || this.dragSession.dragged) {
        return;
      }

      const deltaX = event.clientX - this.dragSession.startX;
      const deltaY = event.clientY - this.dragSession.startY;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance < DRAG_THRESHOLD) {
        return;
      }

      const origin = this.dragSession.origin;
      const horizontal = Math.abs(deltaX) > Math.abs(deltaY);
      const target = horizontal
        ? { row: origin.row, col: origin.col + (deltaX > 0 ? 1 : -1) }
        : { row: origin.row + (deltaY > 0 ? 1 : -1), col: origin.col };

      if (
        target.row < 0 ||
        target.col < 0 ||
        target.row >= this.boardSize ||
        target.col >= this.boardSize
      ) {
        this.clearDrag();
        return;
      }

      this.dragSession.dragged = true;
      this.suppressClick = true;
      this.root.classList.add('is-dragging');
      this.onTileSwap(origin, target);
    });

    this.root.addEventListener('pointerup', () => {
      this.clearDrag();
    });

    this.root.addEventListener('pointercancel', () => {
      this.clearDrag();
    });

    this.root.addEventListener('click', (event) => {
      if (this.suppressClick) {
        this.suppressClick = false;
        return;
      }

      const tile = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-row][data-col]');

      if (!tile) {
        return;
      }

      const row = Number(tile.dataset.row);
      const col = Number(tile.dataset.col);

      this.onTilePress({ row, col });
    });
  }

  private clearDrag() {
    this.dragSession = null;
    this.root.classList.remove('is-pointer-down', 'is-dragging');
  }

  render(state: GameState): void {
    const focusMove = state.phase === 'ai' ? state.aiInsights[0]?.move ?? null : null;
    this.boardSize = state.board.length;
    this.root.dataset.phase = state.phase;
    this.root.style.gridTemplateColumns = `repeat(${state.board.length}, minmax(0, 1fr))`;
    this.root.innerHTML = state.board
      .map((row, rowIndex) =>
        row
          .map((tileId, colIndex) => {
            const tile = tileMap.get(tileId);
            const position = { row: rowIndex, col: colIndex };
            const classes = [
              'tile',
              `tile--${tileId}`,
              positionsEqual(state.selected, position) ? 'is-selected' : '',
              positionsEqual(state.hint?.from ?? null, position) ? 'is-hint-origin' : '',
              positionsEqual(state.hint?.to ?? null, position) ? 'is-hint-target' : '',
              positionsEqual(focusMove?.from ?? null, position) ? 'is-ai-origin' : '',
              positionsEqual(focusMove?.to ?? null, position) ? 'is-ai-target' : '',
              this.dragSession && positionsEqual(this.dragSession.origin, position) ? 'is-drag-source' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return `
              <button
                class="${classes}"
                type="button"
                data-row="${rowIndex}"
                data-col="${colIndex}"
                aria-label="${tile?.label ?? tileId}"
              >
                <span class="tile__halo"></span>
                <span class="tile__symbol">${tile?.symbol ?? '•'}</span>
              </button>
            `;
          })
          .join(''),
      )
      .join('');
  }
}
