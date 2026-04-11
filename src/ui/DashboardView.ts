import type { GameState } from '../game/types';

function formatPercent(value: number): string {
  return `${Math.max(8, Math.round(value))}%`;
}

function renderInsights(state: GameState): string {
  if (state.aiInsights.length === 0) {
    return '<div class="empty-card">当前没有可用路线，系统会自动重构棋盘。</div>';
  }

  return state.aiInsights
    .map(
      (insight, index) => `
        <article class="insight-card ${index === 0 ? 'is-primary' : ''}">
          <div class="insight-card__head">
            <span class="insight-card__rank">0${index + 1}</span>
            <strong>${insight.label}</strong>
            <span>${insight.result.score} 分</span>
          </div>
          <p>${insight.reason}</p>
        </article>
      `,
    )
    .join('');
}

function renderHistory(state: GameState): string {
  if (state.history.length === 0) {
    return '<div class="empty-card">首回合尚未开始，先完成一次有效交换。</div>';
  }

  return state.history
    .map(
      (entry) => `
        <article class="history-row">
          <div>
            <span class="history-row__actor history-row__actor--${entry.actor}">
              ${entry.actor === 'player' ? 'PLAYER' : 'AI'}
            </span>
            <strong>${entry.label}</strong>
          </div>
          <span>+${entry.score}</span>
        </article>
      `,
    )
    .join('');
}

function renderPulseChart(state: GameState): string {
  const scores = state.history.slice(0, 5).map((entry) => entry.score);

  if (scores.length === 0) {
    return '<div class="pulse-chart pulse-chart--empty"><span>等待首个动作</span></div>';
  }

  const maxScore = Math.max(...scores, 1);

  return `
    <div class="pulse-chart">
      ${scores
        .map(
          (score, index) => `
            <div class="pulse-chart__bar" style="height:${formatPercent((score / maxScore) * 100)}">
              <span>${index + 1}</span>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

export class DashboardView {
  constructor(private readonly root: HTMLElement) {}

  render(state: GameState): void {
    const totalScore = Math.max(state.playerScore + state.aiScore, 1);
    const playerShare = (state.playerScore / totalScore) * 100;
    const aiShare = (state.aiScore / totalScore) * 100;
    const targetProgress = Math.min(100, (state.playerScore / state.goalScore) * 100);
    const roundLabel = `${Math.min(state.round, state.roundsTotal)} / ${state.roundsTotal}`;

    this.root.innerHTML = `
      <section class="panel-card panel-card--radar">
        <div class="panel-card__title">
          <span>AI Radar</span>
          <strong>Top 3</strong>
        </div>
        <div class="insight-list">${renderInsights(state)}</div>
      </section>

      <section class="panel-card">
        <div class="panel-card__title">
          <span>Score Duel</span>
          <strong>${state.phase === 'complete' ? 'Mission Closed' : 'Live Match'}</strong>
        </div>
        <div class="score-strip">
          <article class="score-box">
            <span>你</span>
            <strong>${state.playerScore}</strong>
          </article>
          <article class="score-box score-box--ai">
            <span>AI</span>
            <strong>${state.aiScore}</strong>
          </article>
        </div>
        <div class="duel-bar">
          <span class="duel-bar__player" style="width:${formatPercent(playerShare)}"></span>
          <span class="duel-bar__ai" style="width:${formatPercent(aiShare)}"></span>
        </div>
      </section>

      <section class="panel-card">
        <div class="panel-card__title">
          <span>Round & Target</span>
          <strong>${roundLabel}</strong>
        </div>
        <div class="metric-grid">
          <article class="metric-box">
            <span>阶段</span>
            <strong>${state.phase === 'complete' ? '结算' : state.phase === 'player' ? '你的行动' : 'AI 推演中'}</strong>
          </article>
          <article class="metric-box">
            <span>目标分</span>
            <strong>${state.goalScore}</strong>
          </article>
          <article class="metric-box">
            <span>可用路线</span>
            <strong>${state.availableMoves}</strong>
          </article>
          <article class="metric-box">
            <span>最近结果</span>
            <strong>${state.lastResolution ? `${state.lastResolution.cleared} 清除` : '等待中'}</strong>
          </article>
        </div>
        <div class="target-bar">
          <span style="width:${formatPercent(targetProgress)}"></span>
        </div>
      </section>

      <section class="panel-card">
        <div class="panel-card__title">
          <span>Move Feed</span>
          <strong>Latest 6</strong>
        </div>
        <div class="history-list">${renderHistory(state)}</div>
      </section>

      <section class="panel-card">
        <div class="panel-card__title">
          <span>Pulse</span>
          <strong>Score Rhythm</strong>
        </div>
        ${renderPulseChart(state)}
      </section>
    `;
  }
}
