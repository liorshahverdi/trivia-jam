import { describe, expect, it, vi } from 'vitest';
import { refreshCurrentEventsQuestions, validateGeneratedCurrentEventQuestion } from './CurrentEventsSource';

const NOW = new Date('2026-06-18T12:00:00.000Z');

describe('dynamic current events sourcing', () => {
  it('rejects malformed generated questions before they can be cached', () => {
    expect(validateGeneratedCurrentEventQuestion({
      id: 'valid-news-1',
      category: 'current-events',
      difficulty: 'medium',
      question: 'Which company announced a reusable satellite bus this week?',
      options: ['Acme Space', 'Blue River', 'Northwind Labs', 'Vertex AI'],
      correctIndex: 0,
      sourceUrl: 'https://example.com/space-announcement',
      publishedAt: '2026-06-18T09:00:00.000Z',
    }, NOW).valid).toBe(true);

    expect(validateGeneratedCurrentEventQuestion({
      id: 'bad-duplicate-options',
      category: 'current-events',
      difficulty: 'medium',
      question: 'Which company announced a reusable satellite bus this week?',
      options: ['Acme Space', 'Acme Space', 'Northwind Labs', 'Vertex AI'],
      correctIndex: 0,
      sourceUrl: 'https://example.com/space-announcement',
      publishedAt: '2026-06-18T09:00:00.000Z',
    }, NOW).valid).toBe(false);

    expect(validateGeneratedCurrentEventQuestion({
      id: 'bad-stale-news',
      category: 'current-events',
      difficulty: 'medium',
      question: 'Which company announced a reusable satellite bus this week?',
      options: ['Acme Space', 'Blue River', 'Northwind Labs', 'Vertex AI'],
      correctIndex: 0,
      sourceUrl: 'https://example.com/space-announcement',
      publishedAt: '2026-04-01T09:00:00.000Z',
    }, NOW).valid).toBe(false);
  });

  it('fetches news, generates validated questions, expires them, and stores source metadata', async () => {
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    const pool = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        queries.push({ sql, params });
        return { rowCount: sql.startsWith('INSERT') ? 1 : 0, rows: [] };
      }),
    };

    const inserted = await refreshCurrentEventsQuestions(pool as any, {
      now: NOW,
      fetchArticles: async () => [{
        title: 'Acme Space announces reusable satellite bus',
        description: 'Acme Space announced a reusable satellite bus for low-earth-orbit missions.',
        url: 'https://example.com/space-announcement',
        sourceName: 'Example News',
        publishedAt: '2026-06-18T09:00:00.000Z',
      }],
      generateQuestions: async () => [{
        id: 'generated-current-events-1',
        category: 'current-events',
        difficulty: 'medium',
        question: 'Which company announced a reusable satellite bus this week?',
        options: ['Blue River', 'Acme Space', 'Northwind Labs', 'Vertex AI'],
        correctIndex: 1,
        sourceUrl: 'https://example.com/space-announcement',
        publishedAt: '2026-06-18T09:00:00.000Z',
      }],
    });

    expect(inserted).toBe(1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM questions'),
      ['current-events', NOW.toISOString()]
    );
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO questions'),
      expect.arrayContaining([
        'generated-current-events-1',
        'current-events',
        'medium',
        'Which company announced a reusable satellite bus this week?',
        JSON.stringify(['Blue River', 'Acme Space', 'Northwind Labs', 'Vertex AI']),
        1,
        'which company announced a reusable satellite bus this week?',
        'dynamic-current-events',
        'https://example.com/space-announcement',
        '2026-06-18T09:00:00.000Z',
        '2026-07-09T09:00:00.000Z',
        NOW.toISOString(),
      ])
    );
    expect(queries.some(({ sql }) => sql.includes('ON CONFLICT'))).toBe(true);
  });
});
