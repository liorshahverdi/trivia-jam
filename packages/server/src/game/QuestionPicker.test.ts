import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Question } from '@trivia-jam/shared';

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

  it('does not serve expired dynamic current-events questions from the database', async () => {
    const fresh: Question = {
      id: 'fresh-current-event',
      category: 'current-events',
      difficulty: 'medium',
      question: 'Which company announced a reusable satellite bus this week?',
      options: ['Blue River', 'Acme Space', 'Northwind Labs', 'Vertex AI'],
      correctIndex: 1,
    };
    const expired: Question = {
      id: 'expired-current-event',
      category: 'current-events',
      difficulty: 'medium',
      question: 'Which city hosted last quarter’s climate summit?',
      options: ['Paris', 'Tokyo', 'Nairobi', 'Toronto'],
      correctIndex: 2,
    };

    mockPool.current = {
      query: vi.fn(async () => ({
        rows: [
          {
            id: fresh.id,
            category: fresh.category,
            difficulty: fresh.difficulty,
            question: fresh.question,
            options: fresh.options,
            correct_index: fresh.correctIndex,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: expired.id,
            category: expired.category,
            difficulty: expired.difficulty,
            question: expired.question,
            options: expired.options,
            correct_index: expired.correctIndex,
            expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
      })),
    };

    const selected = await selectQuestions(['current-events'], 5);

    expect(selected.map((q) => q.id)).toEqual(['fresh-current-event']);
    expect(mockPool.current.query).toHaveBeenCalledWith(
      expect.stringContaining('expires_at'),
      expect.arrayContaining(['current-events'])
    );
  });
});
