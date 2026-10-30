import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Question } from '@trivia-jam/shared';

const packs = vi.hoisted(() => ({ data: {} as Record<string, unknown[]>, blocked: new Set<string>() }));

vi.mock('@trivia-jam/shared/questions', () => ({
  loadQuestionPack: (category: string) => packs.data[category] ?? [],
  loadBlocklist: () => packs.blocked,
  clearQuestionPackCache: () => {},
}));

const { selectQuestions, shuffleOptions } = await import('./QuestionPicker');
const { clearFlags, flagQuestion } = await import('./questionFlags');

function q(id: string, category: Category, difficulty: Question['difficulty'] = 'medium', extra: Partial<Question> = {}): Question {
  return {
    id,
    category,
    difficulty,
    question: `Question ${id}?`,
    options: [`right-${id}`, `w1-${id}`, `w2-${id}`, `w3-${id}`],
    correctIndex: 0,
    ...extra,
  };
}

const NOW = Date.parse('2026-08-01T00:00:00Z');

describe('QuestionPicker', () => {
  beforeEach(() => {
    packs.data = {};
    packs.blocked = new Set();
    clearFlags();
  });

  it('shuffles options per serve while keeping correctIndex on the right answer', () => {
    const original = q('x', 'math');
    const positions = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const shuffled = shuffleOptions(original);
      expect(shuffled.options[shuffled.correctIndex]).toBe('right-x');
      expect([...shuffled.options].sort()).toEqual([...original.options].sort());
      positions.add(shuffled.correctIndex);
    }
    expect(positions.size).toBe(4);
  });

  it('ignores unknown categories, including path traversal attempts', () => {
    packs.data = { math: [q('m1', 'math')] };
    const selected = selectQuestions({ categories: ['../../package', 'nope', 'math'], count: 5, now: NOW });
    expect(selected.map((s) => s.id)).toEqual(['m1']);
    expect(selectQuestions({ categories: ['../../package'], count: 5, now: NOW })).toEqual([]);
  });

  it('skips expired, blocklisted and repeatedly flagged questions', () => {
    packs.data = {
      'current-events': [
        q('fresh', 'current-events', 'easy', { expiresAt: '2026-08-10T00:00:00Z' }),
        q('expired', 'current-events', 'easy', { expiresAt: '2026-07-01T00:00:00Z' }),
        q('blocked', 'current-events'),
        q('flagged', 'current-events'),
      ],
    };
    packs.blocked = new Set(['blocked']);
    flagQuestion('flagged', 'p1');
    flagQuestion('flagged', 'p2');
    const ids = selectQuestions({ categories: ['current-events'], count: 10, now: NOW }).map((s) => s.id);
    expect(ids).toEqual(['fresh']);
  });

  it('prefers unseen questions and only repeats when the pack runs dry', () => {
    packs.data = { math: [q('a', 'math'), q('b', 'math'), q('c', 'math')] };
    const ids = selectQuestions({ categories: ['math'], count: 2, excludeIds: new Set(['a']), now: NOW }).map((s) => s.id);
    expect(ids.sort()).toEqual(['b', 'c']);

    const refill = selectQuestions({ categories: ['math'], count: 3, excludeIds: new Set(['a', 'b']), now: NOW }).map((s) => s.id);
    expect(refill[0]).toBe('c');
    expect(refill).toHaveLength(3);
  });

  it('honours the requested difficulty before falling back', () => {
    packs.data = { math: [q('e1', 'math', 'easy'), q('h1', 'math', 'hard'), q('h2', 'math', 'hard')] };
    const hard = selectQuestions({ categories: ['math'], count: 2, difficulty: 'hard', now: NOW });
    expect(hard.every((s) => s.difficulty === 'hard')).toBe(true);
    const topUp = selectQuestions({ categories: ['math'], count: 3, difficulty: 'hard', now: NOW });
    expect(topUp.map((s) => s.id).slice(0, 2).sort()).toEqual(['h1', 'h2']);
    expect(topUp[2].id).toBe('e1');
  });

  it('balances categories so a huge pack does not crowd out a small one', () => {
    packs.data = {
      history: Array.from({ length: 200 }, (_, i) => q(`h${i}`, 'history')),
      art: Array.from({ length: 5 }, (_, i) => q(`a${i}`, 'art')),
    };
    const selected = selectQuestions({ categories: ['history', 'art'], count: 10, now: NOW });
    expect(selected.filter((s) => s.category === 'art')).toHaveLength(5);
  });

  it('ramps mixed games from easy to hard', () => {
    packs.data = { math: [q('h', 'math', 'hard'), q('e', 'math', 'easy'), q('m', 'math', 'medium')] };
    const order = selectQuestions({ categories: ['math'], count: 3, now: NOW }).map((s) => s.difficulty);
    expect(order).toEqual(['easy', 'medium', 'hard']);
  });
});
