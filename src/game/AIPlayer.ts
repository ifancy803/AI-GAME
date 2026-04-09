import { Board } from './Board';
import { AIDecision, BoardSnapshot, MatchGroup, MoveEvaluation, PlayerSide, ScoreBook, ThoughtPreview } from './types';

const otherSide = (side: PlayerSide): PlayerSide => (side === 'player' ? 'ai' : 'player');

export class AIPlayer {
  private searchDepth: number;

  constructor(
    searchDepth = 2,
    private readonly maxBranching = 8
  ) {
    this.searchDepth = searchDepth;
  }

  public setSearchDepth(depth: number): void {
    this.searchDepth = Math.max(1, depth);
  }

  public getSearchDepth(): number {
    return this.searchDepth;
  }

  public analyzeMove(
    snapshot: BoardSnapshot,
    side: PlayerSide,
    scores: ScoreBook
  ): AIDecision | null {
    const playable = Board.ensurePlayableSnapshot(snapshot).snapshot;
    const candidates = Board.getSimulatedMoves(playable)
      .sort((left, right) => {
        if (right.result.greedyScore !== left.result.greedyScore) {
          return right.result.greedyScore - left.result.greedyScore;
        }

        return right.result.totalScore - left.result.totalScore;
      })
      .slice(0, this.maxBranching);

    if (candidates.length === 0) {
      return null;
    }

    const previews: ThoughtPreview[] = [];
    let best: ThoughtPreview | null = null;
    let alpha = Number.NEGATIVE_INFINITY;
    let beta = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      const projectedScores = this.addScore(scores, side, candidate.result.totalScore);
      const pressure = this.minimax(
        candidate.result.finalSnapshot,
        this.searchDepth - 1,
        otherSide(side),
        projectedScores,
        side,
        alpha,
        beta
      );
      const composite = candidate.result.totalScore + pressure;
      const evaluation: ThoughtPreview = {
        move: candidate.move,
        totalScore: candidate.result.totalScore,
        greedyScore: candidate.result.greedyScore,
        cascades: candidate.result.cascades,
        opponentPressure: pressure,
        composite,
        previewCells: candidate.result.steps[0]?.matchedCells ?? [],
        patterns: this.buildPatterns(candidate.result.steps[0]?.groups ?? [])
      };
      previews.push(evaluation);

      if (!best || evaluation.composite > best.composite) {
        best = evaluation;
      }

      alpha = Math.max(alpha, composite);
    }

    if (!best) {
      return null;
    }

    previews.sort((left, right) => right.composite - left.composite);

    return {
      selected: best,
      candidates: previews,
      depthUsed: this.searchDepth
    };
  }

  public chooseMove(
    snapshot: BoardSnapshot,
    side: PlayerSide,
    scores: ScoreBook
  ): ThoughtPreview | null {
    return this.analyzeMove(snapshot, side, scores)?.selected ?? null;
  }

  public findHintMove(snapshot: BoardSnapshot, scores: ScoreBook): ThoughtPreview | null {
    return this.analyzeMove(snapshot, 'player', scores)?.selected ?? null;
  }

  private minimax(
    snapshot: BoardSnapshot,
    depth: number,
    turn: PlayerSide,
    scores: ScoreBook,
    perspective: PlayerSide,
    alpha: number,
    beta: number
  ): number {
    const playable = Board.ensurePlayableSnapshot(snapshot).snapshot;
    const candidates = Board.getSimulatedMoves(playable)
      .sort((left, right) => {
        if (right.result.greedyScore !== left.result.greedyScore) {
          return right.result.greedyScore - left.result.greedyScore;
        }

        return right.result.totalScore - left.result.totalScore;
      })
      .slice(0, this.maxBranching);

    if (depth <= 0 || candidates.length === 0) {
      return this.evaluateLeaf(candidates, scores, turn, perspective);
    }

    if (turn === perspective) {
      let best = Number.NEGATIVE_INFINITY;

      for (const candidate of candidates) {
        const nextScores = this.addScore(scores, turn, candidate.result.totalScore);
        const value =
          candidate.result.totalScore +
          this.minimax(
            candidate.result.finalSnapshot,
            depth - 1,
            otherSide(turn),
            nextScores,
            perspective,
            alpha,
            beta
          );

        best = Math.max(best, value);
        alpha = Math.max(alpha, best);

        if (beta <= alpha) {
          break;
        }
      }

      return best;
    }

    let best = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      const nextScores = this.addScore(scores, turn, candidate.result.totalScore);
      const value =
        -candidate.result.totalScore +
        this.minimax(
          candidate.result.finalSnapshot,
          depth - 1,
          otherSide(turn),
          nextScores,
          perspective,
          alpha,
          beta
        );

      best = Math.min(best, value);
      beta = Math.min(beta, best);

      if (beta <= alpha) {
        break;
      }
    }

    return best;
  }

  private evaluateLeaf(
    candidates: ReturnType<typeof Board.getSimulatedMoves>,
    scores: ScoreBook,
    turn: PlayerSide,
    perspective: PlayerSide
  ): number {
    const opponent = otherSide(perspective);
    const scoreDelta = scores[perspective] - scores[opponent];
    const bestImmediate = candidates[0]?.result.totalScore ?? 0;
    const bestGreedy = candidates[0]?.result.greedyScore ?? 0;
    const turnBias = turn === perspective ? 0.35 : -0.35;

    return scoreDelta + bestImmediate * turnBias + bestGreedy * 0.15 * turnBias;
  }

  private addScore(scores: ScoreBook, side: PlayerSide, delta: number): ScoreBook {
    return {
      player: scores.player + (side === 'player' ? delta : 0),
      ai: scores.ai + (side === 'ai' ? delta : 0)
    };
  }

  private buildPatterns(groups: MatchGroup[]): ThoughtPreview['patterns'] {
    return groups.map((group) => ({
      direction: group.direction,
      size: group.cells.length
    }));
  }
}
