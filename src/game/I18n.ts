import { Language, PlayerSide, ThoughtPattern } from './types';

type TranslationValue = string | ((params: Record<string, string | number>) => string);

const translations: Record<Language, Record<string, TranslationValue>> = {
  en: {
    title: 'AI MATCH-3 ARENA',
    hint: 'AI Hint',
    restart: 'Restart',
    pause: 'Pause',
    nextLevel: 'Next Level',
    retry: 'Retry',
    language: 'Language',
    settings: 'Settings',
    volume: 'Volume',
    difficulty: 'Difficulty',
    theme: 'Theme',
    themeLight: 'Pearl Day',
    themeDark: 'Neon Night',
    close: 'Close',
    easy: 'Easy',
    normal: 'Normal',
    hard: 'Hard',
    langZh: '中文',
    langEn: 'EN',
    aiVisual: 'AI Visual',
    scoreShort: 'Score',
    cascadeShort: 'Chains',
    yourTurn: 'Your turn. Drag or tap tiles to swap, or ask the AI for a hint.',
    yourTurnShort: 'Your turn. Look for cascades, or use the AI Hint pulse.',
    aiTurn: 'AI turn. Searching the strongest counter-move.',
    aiThinking: 'AI is running a minimax search and evaluating candidate combos.',
    noHint: 'No hint available. The board will reshuffle on the next stable state.',
    hintShown: 'AI Hint: highlighted the highest-value player move.',
    aiStalled: 'AI stalled. No valid move found.',
    levelClear:
      'Sector cleared. Player beat the AI and hit the procedural target score.',
    levelRetryWin:
      'Player won on score, but missed the target score. Retry for a full clear.',
    levelRetryLose:
      'AI won the duel. Retry the sector or adapt your hint usage.',
    target: ({ score }) => `Target ${score}`,
    playerScore: ({ score }) => `Player ${score}`,
    aiScore: ({ score }) => `AI ${score}`,
    roundsLeft: ({ count }) => `Rounds left ${count}`,
    turnPlayer: 'TURN: PLAYER',
    turnAi: 'TURN: AI OPPONENT',
    decisionTitle: 'AI Decision Panel',
    hintPanelTitle: 'Hint Panel',
    decisionDepth: ({ depth, streak }) => `Depth ${depth} | player streak ${streak}`,
    decisionCandidate: ({ index, score, evalScore }) =>
      `Line ${index}: score ${score} | eval ${evalScore}`,
    decisionPatterns: ({ patterns, cascades }) => `${patterns} | cascades ${cascades}`,
    decisionMove: ({ from, to }) => `Swap ${from} -> ${to}`,
    decisionSelected: 'Selected line',
    decisionHint: 'Recommended line',
    adaptiveDepth: ({ depth }) => `Adaptive depth ${depth}`,
    playerChain: ({ score, cascades }) => `Player chain ${score} / cascades ${cascades}`,
    aiChain: ({ score, cascades }) => `AI chain ${score} / cascades ${cascades}`,
    tapHelp: 'Touch: tap one tile, then tap an adjacent tile to swap.',
    landscapeHelp: 'Landscape layout active for desktop and wide screens.',
    portraitHelp: 'Portrait layout active for mobile play.',
    streak: 'Win Streak',
    sidePlayer: 'Player',
    sideAi: 'AI'
  },
  zh: {
    title: 'AI 三消竞技场',
    hint: 'AI 提示',
    restart: '重开',
    pause: '暂停',
    nextLevel: '下一关',
    retry: '重试',
    language: '语言',
    settings: '设置',
    volume: '音量',
    difficulty: '难度',
    theme: '主题',
    themeLight: '浅色',
    themeDark: '夜色',
    close: '关闭',
    easy: '简单',
    normal: '标准',
    hard: '困难',
    langZh: '中文',
    langEn: 'EN',
    aiVisual: 'AI 可视化',
    scoreShort: '得分',
    cascadeShort: '连锁',
    yourTurn: '轮到你了。可拖拽或点击两颗相邻宝石交换，也可使用 AI 提示。',
    yourTurnShort: '轮到你了。尽量制造连锁，或使用 AI 提示脉冲高亮。',
    aiTurn: '轮到 AI。正在搜索最强反制走法。',
    aiThinking: 'AI 正在执行 Minimax 搜索并评估候选消除组合。',
    noHint: '当前没有可用提示。棋盘在稳定后会自动重洗。',
    hintShown: 'AI 提示：已高亮当前收益最高的玩家移动。',
    aiStalled: 'AI 暂时没有找到合法移动。',
    levelClear: '关卡通过。玩家击败 AI 且达到程序化目标分。',
    levelRetryWin: '玩家分数领先，但未达到目标分。可重试拿到完整通关。',
    levelRetryLose: '本局由 AI 获胜。可重试，或调整提示使用节奏。',
    target: ({ score }) => `目标分 ${score}`,
    playerScore: ({ score }) => `玩家 ${score}`,
    aiScore: ({ score }) => `AI ${score}`,
    roundsLeft: ({ count }) => `剩余回合 ${count}`,
    turnPlayer: '当前回合：玩家',
    turnAi: '当前回合：AI 对手',
    decisionTitle: 'AI 决策面板',
    hintPanelTitle: '提示面板',
    decisionDepth: ({ depth, streak }) => `搜索深度 ${depth} | 玩家连胜 ${streak}`,
    decisionCandidate: ({ index, score, evalScore }) =>
      `路线 ${index}：得分 ${score} | 评估 ${evalScore}`,
    decisionPatterns: ({ patterns, cascades }) => `${patterns} | 连锁 ${cascades}`,
    decisionMove: ({ from, to }) => `交换 ${from} -> ${to}`,
    decisionSelected: '最终选择',
    decisionHint: '推荐路线',
    adaptiveDepth: ({ depth }) => `自适应深度 ${depth}`,
    playerChain: ({ score, cascades }) => `玩家连锁 ${score} / 连锁数 ${cascades}`,
    aiChain: ({ score, cascades }) => `AI 连锁 ${score} / 连锁数 ${cascades}`,
    tapHelp: '触屏：先点选一颗宝石，再点相邻宝石即可交换。',
    landscapeHelp: '已启用横屏布局，适合 PC 与宽屏浏览器。',
    portraitHelp: '已启用竖屏布局，适合手机触屏游玩。',
    streak: '连胜',
    sidePlayer: '玩家',
    sideAi: 'AI'
  }
};

export const translate = (
  language: Language,
  key: string,
  params: Record<string, string | number> = {}
): string => {
  const entry = translations[language][key];

  if (typeof entry === 'function') {
    return entry(params);
  }

  return entry ?? key;
};

export const formatMoveLabel = (row: number, col: number): string =>
  `${String.fromCharCode(65 + col)}${row + 1}`;

export const formatPatternSummary = (language: Language, patterns: ThoughtPattern[]): string => {
  if (patterns.length === 0) {
    return language === 'zh' ? '无首轮组合' : 'no first combo';
  }

  return patterns
    .map((pattern) => {
      const axis =
        language === 'zh'
          ? pattern.direction === 'horizontal'
            ? '横'
            : '竖'
          : pattern.direction === 'horizontal'
            ? 'H'
            : 'V';

      return `${axis}${pattern.size}`;
    })
    .join(language === 'zh' ? ' + ' : ' + ');
};

export const sideLabel = (language: Language, side: PlayerSide): string =>
  translate(language, side === 'player' ? 'sidePlayer' : 'sideAi');
