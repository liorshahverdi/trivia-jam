import { describe, expect, it, vi } from 'vitest';
import type { Question } from '@trivia-jam/shared';
import { refreshCurrentEventsJson, validateStaticCurrentEventQuestion } from './current-events-static';

const NOW = new Date('2026-06-18T12:00:00.000Z');

describe('static Current Events JSON refresh', () => {
  it('validates generated questions before writing them to the static pack', () => {
    const valid = validateStaticCurrentEventQuestion({
      id: 'current-events-dynamic-2026-06-18-space',
      category: 'current-events',
      difficulty: 'medium',
      question: 'Which company announced a reusable satellite bus this week?',
      options: ['Blue River', 'Acme Space', 'Northwind Labs', 'Vertex AI'],
      correctIndex: 1,
      sourceUrl: 'https://example.com/space-announcement',
      publishedAt: '2026-06-18T09:00:00.000Z',
    }, NOW);

    const duplicateOptions = validateStaticCurrentEventQuestion({
      id: 'current-events-dynamic-2026-06-18-bad-options',
      category: 'current-events',
      difficulty: 'medium',
      question: 'Which company announced a reusable satellite bus this week?',
      options: ['Acme Space', 'Acme Space', 'Northwind Labs', 'Vertex AI'],
      correctIndex: 1,
      sourceUrl: 'https://example.com/space-announcement',
      publishedAt: '2026-06-18T09:00:00.000Z',
    }, NOW);

    const stale = validateStaticCurrentEventQuestion({
      id: 'current-events-dynamic-2026-04-01-old',
      category: 'current-events',
      difficulty: 'medium',
      question: 'Which company announced a reusable satellite bus this week?',
      options: ['Blue River', 'Acme Space', 'Northwind Labs', 'Vertex AI'],
      correctIndex: 1,
      sourceUrl: 'https://example.com/space-announcement',
      publishedAt: '2026-04-01T09:00:00.000Z',
    }, NOW);

    expect(valid.valid).toBe(true);
    expect(duplicateOptions.valid).toBe(false);
    expect(stale.valid).toBe(false);
  });

  it('replaces expired generated questions, keeps curated fallback questions, and writes fresh generated questions', async () => {
    const curatedFallback: Question = {
      id: 'current-events-manual-fallback',
      category: 'current-events',
      difficulty: 'easy',
      question: 'Which annual global summit focuses on climate policy?',
      options: ['COP', 'CES', 'SXSW', 'Comic-Con'],
      correctIndex: 0,
    };
    const expiredDynamic = {
      id: 'current-events-dynamic-old-story',
      category: 'current-events' as const,
      difficulty: 'medium' as const,
      question: 'Which city hosted an old summit?',
      options: ['Paris', 'Tokyo', 'Nairobi', 'Toronto'] as [string, string, string, string],
      correctIndex: 2,
      sourceUrl: 'https://example.com/old-story',
      publishedAt: '2026-05-01T09:00:00.000Z',
      expiresAt: '2026-05-22T09:00:00.000Z',
    };
    const writeQuestions = vi.fn();

    const result = await refreshCurrentEventsJson({
      now: NOW,
      readExisting: () => [curatedFallback, expiredDynamic],
      writeQuestions,
      fetchArticles: async () => [{
        title: 'Acme Space announces reusable satellite bus',
        description: 'Acme Space announced a reusable satellite bus for low-earth-orbit missions.',
        url: 'https://example.com/space-announcement',
        sourceName: 'Example News',
        publishedAt: '2026-06-18T09:00:00.000Z',
      }],
      generateQuestions: async () => [{
        id: 'current-events-dynamic-2026-06-18-space',
        category: 'current-events',
        difficulty: 'medium',
        question: 'Which company announced a reusable satellite bus this week?',
        options: ['Blue River', 'Acme Space', 'Northwind Labs', 'Vertex AI'],
        correctIndex: 1,
        sourceUrl: 'https://example.com/space-announcement',
        publishedAt: '2026-06-18T09:00:00.000Z',
      }],
    });

    expect(result).toEqual({ added: 1, kept: 1, removedExpired: 1, total: 2 });
    expect(writeQuestions).toHaveBeenCalledTimes(1);
    const written = writeQuestions.mock.calls[0][0];
    expect(written.map((q: Question) => q.id)).toEqual([
      'current-events-manual-fallback',
      'current-events-dynamic-2026-06-18-space',
    ]);
    expect(written[1]).toMatchObject({
      sourceUrl: 'https://example.com/space-announcement',
      publishedAt: '2026-06-18T09:00:00.000Z',
      expiresAt: '2026-07-09T09:00:00.000Z',
      generatedAt: NOW.toISOString(),
    });
  });
});
