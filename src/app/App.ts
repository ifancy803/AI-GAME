import { createGameStore } from '../game/store';
import { TILES } from '../game/config';
import type { GameState } from '../game/types';
import { BoardView } from '../ui/BoardView';
import { DashboardView } from '../ui/DashboardView';
import { SoundEngine } from './SoundEngine';

function createShell(): string {
  return `
    <div class="screen-shell">
      <section class="hero-card" id="hero-card">
        <div class="hero-card__copy">
          <p class="eyebrow">TACTICAL MATCH-3 / REBUILT UI</p>
          <h1>Prism Protocol</h1>
          <p class="hero-card__text" id="hero-strapline"></p>
        </div>
        <div class="hero-card__meta">
          <div class="theme-badge" id="theme-badge"></div>
          <div class="hero-card__status" id="status-pill"></div>
        </div>
        <div class="control-row">
          <button type="button" class="control-button control-button--primary" data-action="hint">战术提示</button>
          <button type="button" class="control-button" data-action="restart">重新开局</button>
          <button type="button" class="control-button" data-action="theme">切换主题</button>
        </div>
        <div class="hero-card__microcopy">
          <span>拖拽棋子即可交换，也支持点击两格相邻方块。</span>
        </div>
      </section>

      <section class="layout-grid">
        <article class="board-card">
          <div class="board-card__head">
            <div>
              <span class="board-card__label">Arena Board</span>
              <strong id="board-title"></strong>
            </div>
            <div class="turn-chip" id="turn-chip"></div>
          </div>
          <div class="board-frame">
            <div class="board-fx" id="board-fx"></div>
            <div class="board-grid" id="board-grid"></div>
          </div>
          <div class="legend-row">
            ${TILES.map(
              (tile) => `
                <div class="legend-chip">
                  <span class="legend-chip__icon legend-chip__icon--${tile.id}">${tile.symbol}</span>
                  <span>${tile.label}</span>
                </div>
              `,
            ).join('')}
          </div>
        </article>

        <aside class="dashboard" id="dashboard"></aside>
      </section>
    </div>
  `;
}

export function mountApp(root: HTMLElement): void {
  const store = createGameStore();
  const sound = new SoundEngine();
  root.innerHTML = createShell();

  const shell = root.querySelector<HTMLElement>('.screen-shell');
  const boardRoot = root.querySelector<HTMLElement>('#board-grid');
  const boardFrame = root.querySelector<HTMLElement>('.board-frame');
  const boardFx = root.querySelector<HTMLElement>('#board-fx');
  const dashboardRoot = root.querySelector<HTMLElement>('#dashboard');
  const heroCard = root.querySelector<HTMLElement>('#hero-card');
  const heroStrapline = root.querySelector<HTMLElement>('#hero-strapline');
  const themeBadge = root.querySelector<HTMLElement>('#theme-badge');
  const statusPill = root.querySelector<HTMLElement>('#status-pill');
  const boardTitle = root.querySelector<HTMLElement>('#board-title');
  const turnChip = root.querySelector<HTMLElement>('#turn-chip');

  if (!shell || !boardRoot || !boardFrame || !boardFx || !dashboardRoot || !heroCard || !heroStrapline || !themeBadge || !statusPill || !boardTitle || !turnChip) {
    throw new Error('Unable to mount the rebuilt game shell.');
  }

  const boardView = new BoardView(
    boardRoot,
    (position) => {
      sound.resume();
      store.actions.selectTile(position);
    },
    (from, to) => {
      sound.resume();
      store.actions.swapTiles(from, to);
    },
  );
  const dashboardView = new DashboardView(dashboardRoot);

  let aiTimer: number | undefined;
  let previousState: GameState | null = null;

  const pulseClass = (element: HTMLElement, className: string, duration = 420) => {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    window.setTimeout(() => {
      element.classList.remove(className);
    }, duration);
  };

  const applyFeedback = (state: GameState) => {
    if (!previousState) {
      return;
    }

    if (previousState.feedback.stamp === state.feedback.stamp) {
      return;
    }

    sound.play(state.feedback.kind);

    if (state.feedback.kind === 'hint' || state.feedback.kind === 'select') {
      pulseClass(boardFrame, 'fx-glow', 460);
    }

    if (state.feedback.kind === 'invalid') {
      pulseClass(boardFrame, 'fx-shake', 420);
      pulseClass(shell, 'fx-screen-warn', 360);
    }

    if (state.feedback.kind === 'player-move') {
      pulseClass(boardFrame, 'fx-burst', 580);
      pulseClass(shell, 'fx-screen-win', 420);
      pulseClass(boardFx, 'is-active', 520);
    }

    if (state.feedback.kind === 'ai-move') {
      pulseClass(boardFrame, 'fx-ai-sweep', 620);
      pulseClass(shell, 'fx-screen-ai', 420);
      pulseClass(boardFx, 'is-active', 520);
    }

    if (state.feedback.kind === 'restart' || state.feedback.kind === 'theme') {
      pulseClass(shell, 'fx-screen-reset', 420);
    }
  };

  root.addEventListener('pointerdown', () => {
    sound.resume();
  });

  root.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');

    if (!button) {
      return;
    }

    const action = button.dataset.action;

    if (action === 'hint') {
      store.actions.requestHint();
      return;
    }

    if (action === 'restart') {
      if (aiTimer) {
        window.clearTimeout(aiTimer);
        aiTimer = undefined;
      }

      store.actions.restart();
      return;
    }

    if (action === 'theme') {
      if (aiTimer) {
        window.clearTimeout(aiTimer);
        aiTimer = undefined;
      }

      store.actions.cycleTheme();
    }
  });

  const render = (state: GameState) => {
    const progressLabel = state.phase === 'complete' ? 'Mission archived' : `Round ${Math.min(state.round, state.roundsTotal)} / ${state.roundsTotal}`;
    heroCard.style.background = state.theme.shellGradient;
    heroCard.style.setProperty('--theme-accent', state.theme.accent);
    heroCard.style.setProperty('--theme-accent-soft', state.theme.accentSoft);
    heroCard.style.setProperty('--theme-accent-warm', state.theme.accentWarm);
    heroStrapline.textContent = state.theme.strapline;
    themeBadge.textContent = state.theme.name;
    statusPill.textContent = state.status;
    boardTitle.textContent = progressLabel;
    turnChip.textContent = state.phase === 'complete' ? '结算' : state.phase === 'player' ? 'PLAYER TURN' : 'AI TURN';

    document.documentElement.style.setProperty('--accent', state.theme.accent);
    document.documentElement.style.setProperty('--accent-strong', state.theme.accentSoft);
    document.documentElement.style.setProperty('--accent-warm', state.theme.accentWarm);

    boardView.render(state);
    dashboardView.render(state);
    applyFeedback(state);
    previousState = state;

    if (state.phase === 'ai' && !aiTimer) {
      aiTimer = window.setTimeout(() => {
        aiTimer = undefined;
        store.actions.runAITurn();
      }, 1050);
    }

    if (state.phase !== 'ai' && aiTimer) {
      window.clearTimeout(aiTimer);
      aiTimer = undefined;
    }
  };

  store.subscribe(render);
}
