import type { Category, Difficulty, DifficultySetting, Question } from '@trivia-jam/shared';
import { isCategory } from '@trivia-jam/shared';
import { clearQuestionPackCache, loadBlocklist, loadQuestionPack } from '@trivia-jam/shared/questions';
import { isRuntimeExcluded } from './questionFlags.js';

export type Random = () => number;

export interface SelectQuestionsOptions {
  categories: readonly unknown[];
  count: number;
  difficulty?: DifficultySetting;
  /** Ids already served to this room; only reused when the fresh pool runs dry. */
  excludeIds?: ReadonlySet<string>;
  random?: Random;
  now?: number;
}

const DIFFICULTY_ORDER: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

/** Clear cached packs/blocklist so fresh data is loaded on next game. */
export function clearQuestionCache(): void {
  clearQuestionPackCache();
}

export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Return a copy of the question with options permuted and correctIndex remapped. */
export function shuffleOptions(question: Question, random: Random = Math.random): Question {
  const order = shuffle([0, 1, 2, 3], random);
  return {
    ...question,
    options: order.map((i) => question.options[i]) as Question['options'],
    correctIndex: order.indexOf(question.correctIndex),
  };
}

export function isExpired(question: Question, now: number): boolean {
  if (!question.expiresAt) return false;
  const expiresAt = Date.parse(question.expiresAt);
  return !Number.isNaN(expiresAt) && expiresAt <= now;
}

/** Interleave per-category lists so one huge pack can't crowd out the others. */
function roundRobin<T>(lists: T[][], limit: number): T[] {
  const out: T[] = [];
  const cursors = lists.map(() => 0);
  let progressed = true;
  while (out.length < limit && progressed) {
    progressed = false;
    for (let i = 0; i < lists.length && out.length < limit; i++) {
      if (cursors[i] < lists[i].length) {
        out.push(lists[i][cursors[i]++]);
        progressed = true;
      }
    }
  }
  return out;
}

export function selectQuestions({
  categories,
  count,
  difficulty = 'mixed',
  excludeIds = new Set(),
  random = Math.random,
  now = Date.now(),
}: SelectQuestionsOptions): Question[] {
  const validCategories = shuffle([...new Set(categories.filter(isCategory))] as Category[], random);
  if (validCategories.length === 0 || count <= 0) return [];

  const blocked = loadBlocklist();
  const wantDifficulty = difficulty === 'mixed' ? null : difficulty;

  const playableByCategory = validCategories.map((category) =>
    loadQuestionPack(category).filter(
      (q) => !blocked.has(q.id) && !isRuntimeExcluded(q.id) && !isExpired(q, now),
    ),
  );

  // Preference tiers: fresh + requested difficulty, fresh + other difficulty,
  // then (only if the room has exhausted the pack) repeats in the same order.
  const tiers: Array<(q: Question) => boolean> = [
    (q) => !excludeIds.has(q.id) && (!wantDifficulty || q.difficulty === wantDifficulty),
    (q) => !excludeIds.has(q.id) && !!wantDifficulty && q.difficulty !== wantDifficulty,
    (q) => excludeIds.has(q.id) && (!wantDifficulty || q.difficulty === wantDifficulty),
    (q) => excludeIds.has(q.id) && !!wantDifficulty && q.difficulty !== wantDifficulty,
  ];

  const picked: Question[] = [];
  for (const tier of tiers) {
    if (picked.length >= count) break;
    const lists = playableByCategory.map((pool) => shuffle(pool.filter(tier), random));
    picked.push(...roundRobin(lists, count - picked.length));
  }

  // Mixed games ramp from easy to hard; ties keep their random order.
  if (!wantDifficulty) {
    picked.sort((a, b) => (DIFFICULTY_ORDER[a.difficulty] ?? 1) - (DIFFICULTY_ORDER[b.difficulty] ?? 1));
  }

  return picked.map((q) => shuffleOptions(q, random));
}
