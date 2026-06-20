import { describe, expect, it, vi } from 'vitest';
import type { Question } from '@trivia-jam/shared';
import {
  DEFAULT_RSS_FEEDS,
  fetchRssArticles,
  generateQuestionsWithOllama,
  refreshCurrentEventsJson,
  validateStaticCurrentEventQuestion,
} from './current-events-static';

const NOW = new Date('2026-06-18T12:00:00.000Z');

describe('static Current Events JSON refresh', () => {
  it('uses a broad default RSS source mix for current events', () => {
    expect(DEFAULT_RSS_FEEDS.map((feed) => feed.name)).toEqual([
      'NPR News',
      'BBC World',
      'PBS NewsHour',
      'NASA Breaking News',
      'ScienceDaily Top News',
      'Space.com',
      'Smithsonian Smart News',
      'The Verge',
      'Ars Technica',
      'Hacker News',
    ]);
  });

  it('prunes legacy static current-events questions when fresh dynamic questions exist', async () => {
    const legacyStatic: Question = {
      id: 'current-events-001',
      category: 'current-events',
      difficulty: 'easy',
      question: 'Which global health crisis was declared a pandemic by the WHO in March 2020?',
      options: ['Ebola', 'COVID-19', 'Zika', 'SARS'],
      correctIndex: 1,
    };
    const freshDynamic = {
      id: 'current-events-dynamic-2026-06-18-space',
      category: 'current-events' as const,
      difficulty: 'medium' as const,
      question: 'Which company announced a reusable satellite bus this week?',
      options: ['Blue River', 'Acme Space', 'Northwind Labs', 'Vertex AI'] as [string, string, string, string],
      correctIndex: 1,
      sourceUrl: 'https://example.com/space-announcement',
      publishedAt: '2026-06-18T09:00:00.000Z',
      expiresAt: '2026-07-09T09:00:00.000Z',
      generatedAt: NOW.toISOString(),
    };
    const writeQuestions = vi.fn();

    const result = await refreshCurrentEventsJson({
      now: NOW,
      readExisting: () => [legacyStatic, freshDynamic],
      writeQuestions,
      fetchArticles: async () => [],
      generateQuestions: async () => [],
    });

    expect(result).toEqual({ added: 0, kept: 1, removedExpired: 1, total: 1 });
    expect(writeQuestions).toHaveBeenCalledTimes(1);
    expect(writeQuestions.mock.calls[0][0].map((q: Question) => q.id)).toEqual([
      'current-events-dynamic-2026-06-18-space',
    ]);
  });

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

  it('replaces expired generated questions, prunes legacy fallback questions, and writes fresh generated questions', async () => {
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

    expect(result).toEqual({ added: 1, kept: 0, removedExpired: 2, total: 1 });
    expect(writeQuestions).toHaveBeenCalledTimes(1);
    const written = writeQuestions.mock.calls[0][0];
    expect(written.map((q: Question) => q.id)).toEqual([
      'current-events-dynamic-2026-06-18-space',
    ]);
    expect(written[0]).toMatchObject({
      sourceUrl: 'https://example.com/space-announcement',
      publishedAt: '2026-06-18T09:00:00.000Z',
      expiresAt: '2026-07-09T09:00:00.000Z',
      generatedAt: NOW.toISOString(),
    });
  });

  it('filters generated questions whose correct answer is not supported by the source article text', async () => {
    const writeQuestions = vi.fn();

    const result = await refreshCurrentEventsJson({
      now: NOW,
      readExisting: () => [],
      writeQuestions,
      fetchArticles: async () => [{
        title: 'Skin care experts recommend 3 essentials',
        description: 'Experts said cleanser, moisturizer, and sunscreen are the essentials.',
        url: 'https://example.com/skin-care',
        sourceName: 'Example News',
        publishedAt: '2026-06-18T09:00:00.000Z',
      }],
      generateQuestions: async () => [{
        id: 'current-events-dynamic-2026-06-18-invented',
        category: 'current-events',
        difficulty: 'medium',
        question: 'Which doctor recommended using a serum for anti-aging?',
        options: ['Dr. Jane Smith', 'Dr. John Doe', 'Dr. Emily Johnson', 'Dr. Michael Brown'],
        correctIndex: 0,
        sourceUrl: 'https://example.com/skin-care',
        publishedAt: '2026-06-18T09:00:00.000Z',
      }],
    });

    expect(result).toEqual({ added: 0, kept: 0, removedExpired: 0, total: 0 });
    expect(writeQuestions).not.toHaveBeenCalled();
  });

  it('fetches recent articles from free RSS feeds without API keys', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      text: async () => `<?xml version="1.0"?>
        <rss><channel><title>Example News</title>
          <item>
            <title>Acme Space announces reusable satellite bus</title>
            <description>Acme Space announced a reusable satellite bus for low-earth-orbit missions.</description>
            <link>https://example.com/space-announcement</link>
            <pubDate>Thu, 18 Jun 2026 09:00:00 GMT</pubDate>
          </item>
        </channel></rss>`,
    }));

    const articles = await fetchRssArticles({
      feeds: [{ name: 'Example News', url: 'https://example.com/rss.xml' }],
      fetchImpl: fetchImpl as any,
      now: NOW,
    });

    expect(fetchImpl).toHaveBeenCalledWith('https://example.com/rss.xml', expect.any(Object));
    expect(articles).toEqual([{ 
      title: 'Acme Space announces reusable satellite bus',
      description: 'Acme Space announced a reusable satellite bus for low-earth-orbit missions.',
      url: 'https://example.com/space-announcement',
      sourceName: 'Example News',
      publishedAt: '2026-06-18T09:00:00.000Z',
    }]);
  });

  it('generates questions with a local Ollama model and parses strict JSON from the response', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        response: JSON.stringify({
          questions: [{
            id: 'current-events-dynamic-2026-06-18-space',
            category: 'current-events',
            difficulty: 'medium',
            question: 'Which company announced a reusable satellite bus this week?',
            options: ['Blue River', 'Acme Space', 'Northwind Labs', 'Vertex AI'],
            correctIndex: 1,
            sourceUrl: 'https://example.com/space-announcement',
            publishedAt: '2026-06-18T09:00:00.000Z',
          }],
        }),
      }),
    }));

    const questions = await generateQuestionsWithOllama([{ 
      title: 'Acme Space announces reusable satellite bus',
      description: 'Acme Space announced a reusable satellite bus for low-earth-orbit missions.',
      url: 'https://example.com/space-announcement',
      sourceName: 'Example News',
      publishedAt: '2026-06-18T09:00:00.000Z',
    }], {
      fetchImpl: fetchImpl as any,
      model: 'qwen2.5-coder:3b',
      ollamaUrl: 'http://localhost:11434',
      now: NOW,
    });

    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:11434/api/generate', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('qwen2.5-coder:3b'),
    }));
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      id: 'current-events-dynamic-2026-06-18-space',
      category: 'current-events',
      sourceUrl: 'https://example.com/space-announcement',
    });
  });
});
