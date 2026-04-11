import { createStore } from '../core/store';
import { TILES, THEMES } from './config';
import { analyzeBoard } from './ai';
import { createPlayableBoard, ensurePlayableBoard, formatMoveLabel, isAdjacent, simulateMove } from './engine';
import type { CellPosition, FeedbackKind, GameState, HistoryEntry, Move, ResolutionSummary } from './types';

const tileIds = TILES.map((tile) => tile.id);
let feedbackStamp = 0;

function nextFeedback(kind: FeedbackKind) {
  feedbackStamp += 1;
  return {
    kind,
    stamp: feedbackStamp,
  };
}

function createHistoryEntry(
  actor: 'player' | 'ai',
  move: Move,
  summary: ResolutionSummary,
): HistoryEntry {
  return {
    actor,
    label: `${formatMoveLabel(move)} · ${summary.cleared} 消除 / ${summary.chains} 连锁`,
    score: summary.score,
    chains: summary.chains,
    cleared: summary.cleared,
  };
}

function buildEndStatus(state: Pick<GameState, 'playerScore' | 'aiScore' | 'goalScore'>): string {
  if (state.playerScore >= state.goalScore && state.playerScore >= state.aiScore) {
    return '你达成目标并压制了 AI，本局判定为胜利。';
  }

  if (state.playerScore > state.aiScore) {
    return '你领先结束，但还差一点目标分。再压一轮可以更稳定。';
  }

  if (state.playerScore === state.aiScore) {
    return '双方战平，下一次可以更激进地争取连锁。';
  }

  return 'AI 在终盘取得优势，尝试优先抢中轴区域的高收益路线。';
}

function createInitialState(themeIndex = 0): GameState {
  const theme = THEMES[themeIndex % THEMES.length];
  const board = createPlayableBoard(tileIds);
  const analysis = analyzeBoard(board, tileIds);

  return {
    themeIndex,
    theme,
    board,
    phase: 'player',
    round: 1,
    roundsTotal: theme.rounds,
    goalScore: theme.goalScore,
    playerScore: 0,
    aiScore: 0,
    selected: null,
    hint: null,
    status: '你的先手回合已开启，优先寻找能拉出连锁的中区交换。',
    availableMoves: analysis.count,
    aiInsights: analysis.topMoves,
    history: [],
    lastResolution: null,
    feedback: nextFeedback('restart'),
  };
}

function buildMoveResultState(current: GameState, move: Move) {
  const result = simulateMove(current.board, move, tileIds);

  if (!result.valid) {
    return {
      ...current,
      selected: move.to,
      hint: null,
      status: '这次交换不会形成三连，尝试沿中心轴重新组织。',
      feedback: nextFeedback('invalid'),
    };
  }

  const summary: ResolutionSummary = {
    actor: 'player',
    score: result.score,
    chains: result.chains,
    cleared: result.cleared,
    label: formatMoveLabel(move),
  };

  const playableBoard = ensurePlayableBoard(result.board, tileIds);
  const analysis = analyzeBoard(playableBoard, tileIds);
  const note = playableBoard !== result.board ? ' 棋盘已自动重组。' : '';

  return {
    ...current,
    board: playableBoard,
    phase: 'ai' as const,
    playerScore: current.playerScore + result.score,
    selected: null,
    hint: null,
    status: `你完成 ${result.cleared} 枚消除，获得 ${result.score} 分。AI 正在检索最优解。${note}`,
    availableMoves: analysis.count,
    aiInsights: analysis.topMoves,
    history: [createHistoryEntry('player', move, summary), ...current.history].slice(0, 6),
    lastResolution: summary,
    feedback: nextFeedback('player-move'),
  };
}

export function createGameStore() {
  const store = createStore<GameState>(createInitialState());

  const applyBoardAnalysis = (board: GameState['board']) => {
    const playableBoard = ensurePlayableBoard(board, tileIds);
    const analysis = analyzeBoard(playableBoard, tileIds);

    return {
      board: playableBoard,
      analysis,
      shuffled: playableBoard !== board,
    };
  };

  const restart = (themeIndex = store.getState().themeIndex) => {
    store.setState(createInitialState(themeIndex));
  };

  const cycleTheme = () => {
    const nextIndex = (store.getState().themeIndex + 1) % THEMES.length;
    const nextState = createInitialState(nextIndex);
    store.setState({
      ...nextState,
      feedback: nextFeedback('theme'),
    });
  };

  const requestHint = () => {
    const current = store.getState();

    if (current.phase !== 'player') {
      return;
    }

    const analysis = analyzeBoard(current.board, tileIds);

    if (!analysis.best) {
      restart(current.themeIndex);
      return;
    }

    store.setState({
      ...current,
      hint: analysis.best.move,
      status: `推荐路径 ${analysis.best.label}。${analysis.best.reason}`,
      aiInsights: analysis.topMoves,
      availableMoves: analysis.count,
      feedback: nextFeedback('hint'),
    });
  };

  const selectTile = (position: CellPosition) => {
    const current = store.getState();

    if (current.phase !== 'player') {
      return;
    }

    if (!current.selected) {
      store.setState({
        ...current,
        selected: position,
        hint: null,
        status: `已锁定 ${position.row + 1}-${position.col + 1}，选择相邻单元发起交换。`,
        feedback: nextFeedback('select'),
      });
      return;
    }

    if (current.selected.row === position.row && current.selected.col === position.col) {
      store.setState({
        ...current,
        selected: null,
        status: '已取消当前选择，重新规划一条更高收益的路径。',
        feedback: nextFeedback('select'),
      });
      return;
    }

    if (!isAdjacent(current.selected, position)) {
      store.setState({
        ...current,
        selected: position,
        hint: null,
        status: '已切换目标，只有相邻单元可以触发交换。',
        feedback: nextFeedback('select'),
      });
      return;
    }

    store.setState(
      buildMoveResultState(current, {
        from: current.selected,
        to: position,
      }),
    );
  };

  const swapTiles = (from: CellPosition, to: CellPosition) => {
    const current = store.getState();

    if (current.phase !== 'player' || !isAdjacent(from, to)) {
      return;
    }

    const move = {
      from,
      to,
    };

    store.setState(buildMoveResultState(current, move));
  };

  const runAITurn = () => {
    const current = store.getState();

    if (current.phase !== 'ai') {
      return;
    }

    const preview = analyzeBoard(current.board, tileIds);

    if (!preview.best) {
      restart(current.themeIndex);
      return;
    }

    const choice = preview.best;
    const result = simulateMove(current.board, choice.move, tileIds);
    const stabilized = applyBoardAnalysis(result.board);
    const nextRound = current.round + 1;
    const phase = nextRound > current.roundsTotal ? 'complete' : 'player';
    const summary: ResolutionSummary = {
      actor: 'ai',
      score: result.score,
      chains: result.chains,
      cleared: result.cleared,
      label: choice.label,
    };
    const note = stabilized.shuffled ? ' 棋盘在落子后已重组。' : '';

    const nextState: GameState = {
      ...current,
      board: stabilized.board,
      phase,
      round: phase === 'complete' ? current.round : nextRound,
      aiScore: current.aiScore + result.score,
      selected: null,
      hint: null,
      status:
        phase === 'complete'
          ? buildEndStatus({
              playerScore: current.playerScore,
              aiScore: current.aiScore + result.score,
              goalScore: current.goalScore,
            })
          : `AI 执行 ${choice.label}，获得 ${result.score} 分。第 ${nextRound} 回合轮到你。${note}`,
      availableMoves: stabilized.analysis.count,
      aiInsights: stabilized.analysis.topMoves,
      history: [createHistoryEntry('ai', choice.move, summary), ...current.history].slice(0, 6),
      lastResolution: summary,
      feedback: nextFeedback('ai-move'),
    };

    store.setState(nextState);
  };

  return {
    subscribe: store.subscribe,
    getState: store.getState,
    actions: {
      restart,
      cycleTheme,
      requestHint,
      selectTile,
      swapTiles,
      runAITurn,
    },
  };
}
