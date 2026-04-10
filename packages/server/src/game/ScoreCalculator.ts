import type { Difficulty, GameMode } from '@trivia-jam/shared';
import {
  POINTS_BY_DIFFICULTY,
  MAX_TIME_BONUS,
  STREAK_BONUS,
  STREAK_THRESHOLD,
  MAX_STREAK_BONUS,
  QUESTION_TIME_SECONDS,
} from '@trivia-jam/shared';

export function calculatePoints(
  difficulty: Difficulty,
  mode: GameMode,
  correct: boolean,
  streak: number,
  answerTimeMs: number,
  questionStartMs: number
): number {
  if (!correct) return 0;

  let points = POINTS_BY_DIFFICULTY[difficulty];

  // Time bonus: teams mode only
  if (mode === 'teams') {
    const elapsed = (answerTimeMs - questionStartMs) / 1000;
    const fraction = Math.max(0, 1 - elapsed / QUESTION_TIME_SECONDS);
    points += Math.round(MAX_TIME_BONUS * fraction);
  }

  // Streak bonus
  if (streak >= STREAK_THRESHOLD) {
    const streakBonus = Math.min((streak - STREAK_THRESHOLD + 1) * STREAK_BONUS, MAX_STREAK_BONUS);
    points += streakBonus;
  }

  return points;
}

export function calculateCoopTarget(questionsPerGame: number): number {
  return questionsPerGame * 200;
}
