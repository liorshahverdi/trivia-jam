import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockPool = vi.hoisted(() => ({ current: null as any }));

vi.mock('../db.js', () => ({
  getPool: () => mockPool.current,
}));

const { clearQuestionCache, selectQuestions } = await import('./QuestionPicker');

describe('QuestionPicker current events freshness', () => {
  beforeEach(() => {
    clearQuestionCache();
    mockPool.current = null;
  });

  it('serves current-events from the generated static JSON instead of stale database rows', async () => {
    mockPool.current = {
      query: vi.fn(async () => ({
        rows: [
          {
            id: 'stale-db-current-event',
            category: 'current-events',
            difficulty: 'medium',
            question: 'In the 1984 movie "The Terminator", what model number is the Terminator portrayed by Arnold Schwarzenegger?',
            options: ['T-800', 'T-1000', 'T-600', 'T-X'],
            correct_index: 0,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
      })),
    };

    const selected = await selectQuestions(['current-events'], 20);

    expect(selected).toHaveLength(20);
    expect(selected.every((q) => q.category === 'current-events')).toBe(true);
    expect(selected.some((q) => q.id === 'stale-db-current-event')).toBe(false);
    expect(selected.some((q) => q.question.includes('Terminator'))).toBe(false);
    expect(mockPool.current.query).not.toHaveBeenCalled();
  });

  it('serves all runtime categories from JSON files even when a database pool exists', async () => {
    mockPool.current = {
      query: vi.fn(async () => ({
        rows: [
          {
            id: 'stale-db-math',
            category: 'math',
            difficulty: 'easy',
            question: 'What stale database math question should never be served?',
            options: ['A', 'B', 'C', 'D'],
            correct_index: 0,
            expires_at: null,
          },
        ],
      })),
    };

    const selected = await selectQuestions(['math'], 5);

    expect(selected).toHaveLength(5);
    expect(selected.every((q) => q.category === 'math')).toBe(true);
    expect(selected.some((q) => q.id === 'stale-db-math')).toBe(false);
    expect(selected.some((q) => q.question.includes('stale database'))).toBe(false);
    expect(mockPool.current.query).not.toHaveBeenCalled();
  });
});
