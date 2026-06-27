import { describe, expect, it, vi } from 'vitest';
import type { Question } from '@trivia-jam/shared';
import {
  DEFAULT_RSS_FEEDS,
  fetchRssArticles,
  generateQuestionsWithHermes,
  generateQuestionsWithOllama,
  refreshCurrentEventsJson,
  validateStaticCurrentEventQuestion,
} from './current-events-static';

const NOW = new Date('2026-06-18T12:00:00.000Z');

const QUESTION_TOPICS = [
  'reusable satellite bus module',
  'coral reef mapping drone',
  'carbon capture pilot plant',
  'museum dinosaur exhibit',
  'electric ferry route',
  'library robotics program',
  'quantum sensor prototype',
  'farm irrigation platform',
  'ocean cleanup robot',
  'medical imaging scanner',
  'wildlife tracking collar',
  'campus astronomy lab',
  'battery recycling center',
  'AI translation tool',
  'public transit app',
  'volcano monitoring satellite',
  'food safety sensor',
  'weather balloon network',
  'green cement formula',
  'water quality dashboard',
  'solar observatory camera',
  'mars habitat simulator',
  'forest mapping lidar',
  'microchip packaging method',
];

function makeArticle(index: number) {
  const topic = QUESTION_TOPICS[index - 1] ?? `science milestone ${index}`;
  return {
    title: `Acme Space announces ${topic}`,
    description: `Acme Space announced ${topic} for a new public technology project.`,
    url: `https://example.com/space-announcement-${index}`,
    sourceName: 'Example News',
    publishedAt: '2026-06-18T09:00:00.000Z',
  };
}

function makeGeneratedQuestion(index: number) {
  const topic = QUESTION_TOPICS[index - 1] ?? `science milestone ${index}`;
  return {
    id: `current-events-dynamic-2026-06-18-space-${index}`,
    category: 'current-events' as const,
    difficulty: 'medium' as const,
    question: `Which company announced the ${topic} this week?`,
    options: ['Blue River', 'Acme Space', 'Northwind Labs', 'Vertex AI'] as [string, string, string, string],
    correctIndex: 1,
    sourceUrl: `https://example.com/space-announcement-${index}`,
    publishedAt: '2026-06-18T09:00:00.000Z',
  };
}

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


  it('writes at least 20 newly generated valid questions for a Current Events-only game', async () => {
    const writeQuestions = vi.fn();
    const articles = Array.from({ length: 20 }, (_, index) => makeArticle(index + 1));
    const generated = Array.from({ length: 20 }, (_, index) => makeGeneratedQuestion(index + 1));

    const result = await refreshCurrentEventsJson({
      now: NOW,
      readExisting: () => [],
      writeQuestions,
      fetchArticles: async () => articles,
      generateQuestions: async () => generated,
    });

    expect(result).toEqual({ added: 20, kept: 0, removedExpired: 0, total: 20 });
    expect(writeQuestions).toHaveBeenCalledTimes(1);
    expect(writeQuestions.mock.calls[0][0]).toHaveLength(20);
  });

  it('fails closed and publishes nothing when fewer than 20 valid generated questions are available', async () => {
    const writeQuestions = vi.fn();
    const articles = Array.from({ length: 19 }, (_, index) => makeArticle(index + 1));
    const generated = Array.from({ length: 19 }, (_, index) => makeGeneratedQuestion(index + 1));

    const result = await refreshCurrentEventsJson({
      now: NOW,
      readExisting: () => [],
      writeQuestions,
      fetchArticles: async () => articles,
      generateQuestions: async () => generated,
    });

    expect(result).toEqual({ added: 0, kept: 0, removedExpired: 0, total: 0 });
    expect(writeQuestions).not.toHaveBeenCalled();
  });

  it('keeps fresh generated questions for about three weeks and only tops up what is needed', async () => {
    const writeQuestions = vi.fn();
    const kept = Array.from({ length: 18 }, (_, index) => ({
      ...makeGeneratedQuestion(index + 1),
      expiresAt: '2026-07-09T09:00:00.000Z',
      generatedAt: '2026-06-18T10:00:00.000Z',
    }));
    const articles = [makeArticle(19), makeArticle(20), makeArticle(21), makeArticle(22)];
    const generated = [makeGeneratedQuestion(19), makeGeneratedQuestion(20), makeGeneratedQuestion(21), makeGeneratedQuestion(22)];

    const result = await refreshCurrentEventsJson({
      now: NOW,
      readExisting: () => kept,
      writeQuestions,
      fetchArticles: async () => articles,
      generateQuestions: async (receivedArticles) => {
        expect(receivedArticles).toHaveLength(4);
        return generated;
      },
    });

    expect(result).toEqual({ added: 2, kept: 18, removedExpired: 0, total: 20 });
    const written = writeQuestions.mock.calls[0][0] as Question[];
    expect(written).toHaveLength(20);
    expect(written.slice(0, 18).map((q) => q.id)).toEqual(kept.map((q) => q.id));
    expect(written.slice(18).map((q) => q.id)).toEqual([
      'current-events-dynamic-2026-06-18-space-19',
      'current-events-dynamic-2026-06-18-space-20',
    ]);
  });

  it('prunes expired generated questions and replaces them with fresh generated top-up questions', async () => {
    const writeQuestions = vi.fn();
    const freshKept = Array.from({ length: 19 }, (_, index) => ({
      ...makeGeneratedQuestion(index + 1),
      expiresAt: '2026-07-09T09:00:00.000Z',
      generatedAt: '2026-06-18T10:00:00.000Z',
    }));
    const expired = {
      ...makeGeneratedQuestion(50),
      id: 'current-events-dynamic-2026-05-20-expired',
      publishedAt: '2026-05-20T09:00:00.000Z',
      expiresAt: '2026-06-10T09:00:00.000Z',
      generatedAt: '2026-05-20T10:00:00.000Z',
    };

    const result = await refreshCurrentEventsJson({
      now: NOW,
      readExisting: () => [...freshKept, expired],
      writeQuestions,
      fetchArticles: async () => [makeArticle(20)],
      generateQuestions: async () => [makeGeneratedQuestion(20)],
    });

    expect(result).toEqual({ added: 1, kept: 19, removedExpired: 1, total: 20 });
    const written = writeQuestions.mock.calls[0][0] as Question[];
    expect(written).toHaveLength(20);
    expect(written.some((q) => q.id === expired.id)).toBe(false);
    expect(written.at(-1)?.id).toBe('current-events-dynamic-2026-06-18-space-20');
  });

  it('prunes generic existing dynamic questions so bad cron output is removed', async () => {
    const genericDynamic = {
      id: 'current-events-dynamic-2026-06-26-1',
      category: 'current-events' as const,
      difficulty: 'easy' as const,
      question: 'What is the current event that is most relevant to the current news articles?',
      options: [
        'Rescuers in Venezuela continue search for the missing after devastating earthquakes',
        'SCOTUS rulings give Trump more power to set immigration policy',
        'Trump works to woo struggling American farmers',
        'Venezuela reels from earthquakes as rescuers scramble to find survivors',
      ] as [string, string, string, string],
      correctIndex: 1,
      sourceUrl: 'https://www.npr.org/2026/06/26/nx-s1-5870438/morning-news-brief',
      publishedAt: '2026-06-26T08:45:11.000Z',
      expiresAt: '2026-07-17T08:45:11.000Z',
      generatedAt: '2026-06-26T09:00:46.878Z',
    };
    const writeQuestions = vi.fn();

    const result = await refreshCurrentEventsJson({
      now: new Date('2026-06-26T10:00:00.000Z'),
      readExisting: () => [genericDynamic],
      writeQuestions,
      fetchArticles: async () => [],
      generateQuestions: async () => [],
    });

    expect(result).toEqual({ added: 0, kept: 0, removedExpired: 1, total: 0 });
    expect(writeQuestions).not.toHaveBeenCalled();
  });

  it('keeps an existing valid dynamic question when the category already meets the configured minimum', async () => {
    const oldDynamic = {
      id: 'current-events-dynamic-2026-06-17-old-space',
      category: 'current-events' as const,
      difficulty: 'medium' as const,
      question: 'Which company announced an old satellite bus last week?',
      options: ['Blue River', 'Old Space', 'Northwind Labs', 'Vertex AI'] as [string, string, string, string],
      correctIndex: 1,
      sourceUrl: 'https://example.com/old-space-announcement',
      publishedAt: '2026-06-17T09:00:00.000Z',
      expiresAt: '2026-07-08T09:00:00.000Z',
      generatedAt: '2026-06-17T10:00:00.000Z',
    };
    const writeQuestions = vi.fn();

    const result = await refreshCurrentEventsJson({
      now: NOW,
      minDynamicQuestions: 1,
      readExisting: () => [oldDynamic],
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

    expect(result).toEqual({ added: 0, kept: 1, removedExpired: 0, total: 1 });
    expect(writeQuestions).not.toHaveBeenCalled();
  });

  it('removes old current-events questions when a refresh produces no valid new questions', async () => {
    const oldDynamic = {
      id: 'current-events-dynamic-2026-06-17-old-space',
      category: 'current-events' as const,
      difficulty: 'medium' as const,
      question: 'Which company announced an old satellite bus last week?',
      options: ['Blue River', 'Old Space', 'Northwind Labs', 'Vertex AI'] as [string, string, string, string],
      correctIndex: 1,
      sourceUrl: 'https://example.com/old-space-announcement',
      publishedAt: '2026-06-17T09:00:00.000Z',
      expiresAt: '2026-07-08T09:00:00.000Z',
      generatedAt: '2026-06-17T10:00:00.000Z',
    };
    const writeQuestions = vi.fn();

    const result = await refreshCurrentEventsJson({
      now: NOW,
      readExisting: () => [oldDynamic],
      writeQuestions,
      fetchArticles: async () => [{
        title: 'Acme Space announces reusable satellite bus',
        description: 'Acme Space announced a reusable satellite bus for low-earth-orbit missions.',
        url: 'https://example.com/space-announcement',
        sourceName: 'Example News',
        publishedAt: '2026-06-18T09:00:00.000Z',
      }],
      generateQuestions: async () => [],
    });

    expect(result).toEqual({ added: 0, kept: 1, removedExpired: 0, total: 1 });
    expect(writeQuestions).not.toHaveBeenCalled();
  });

  it('prunes legacy static current-events questions while retaining valid fresh generated questions', async () => {
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
    expect(writeQuestions).not.toHaveBeenCalled();
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
      minDynamicQuestions: 1,
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

  it('rejects generic meta questions that are not anchored to a specific source subject', () => {
    const result = validateStaticCurrentEventQuestion({
      id: 'current-events-dynamic-2026-06-26-1',
      category: 'current-events',
      difficulty: 'easy',
      question: 'What is the current event that is most relevant to the current news articles?',
      options: [
        'Rescuers in Venezuela continue search for the missing after devastating earthquakes',
        'SCOTUS rulings give Trump more power to set immigration policy',
        'Trump works to woo struggling American farmers',
        'Venezuela reels from earthquakes as rescuers scramble to find survivors',
      ],
      correctIndex: 1,
      sourceUrl: 'https://www.npr.org/2026/06/26/nx-s1-5870438/morning-news-brief',
      publishedAt: '2026-06-26T08:45:11.000Z',
    }, new Date('2026-06-26T09:00:46.878Z'));

    expect(result).toEqual({ valid: false, reason: 'question is too generic for the source subject' });
  });

  it('rejects underspecified generated questions with vague references like “the two countries”', () => {
    const result = validateStaticCurrentEventQuestion({
      id: 'current-events-dynamic-2026-06-27-4',
      category: 'current-events',
      difficulty: 'easy',
      question: 'What is the most significant test yet reached by the two countries?',
      options: [
        'U.S. strikes Iran in response to a drone attack on a ship',
        'Pete Buttigieg and his kids subject to CPS, police investigation after false report',
        '5 million have dropped ACA insurance after Trump and the GOP let prices skyrocket',
        'Argentina fans pour into Texas',
      ],
      correctIndex: 0,
      sourceUrl: 'https://www.npr.org/2026/06/27/nx-s1-5871413/us-strikes-iran',
      publishedAt: '2026-06-27T08:00:00.000Z',
    }, new Date('2026-06-27T09:00:00.000Z'));

    expect(result).toEqual({ valid: false, reason: 'question uses an underspecified reference instead of naming the subject' });
  });

  it('honors a local-only deterministic mode so the cron job does not rely on tiny Ollama output', async () => {
    const fetchImpl = vi.fn();

    const questions = await generateQuestionsWithOllama([{ 
      title: 'Acme Space announces reusable satellite bus',
      description: 'Acme Space announced a reusable satellite bus for low-earth-orbit missions.',
      url: 'https://example.com/space-announcement',
      sourceName: 'Example News',
      publishedAt: '2026-06-18T09:00:00.000Z',
    }], {
      fetchImpl: fetchImpl as any,
      disableOllama: true,
      now: NOW,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(questions).toEqual([]);
  });

  it('filters generic generated questions without adding deterministic filler questions', async () => {
    const writeQuestions = vi.fn();

    const result = await refreshCurrentEventsJson({
      now: NOW,
      readExisting: () => [],
      writeQuestions,
      fetchArticles: async () => [{
        title: 'SCOTUS rulings clarify election policy',
        description: 'The morning news brief included SCOTUS rulings clarify election policy.',
        url: 'https://www.npr.org/2026/06/26/nx-s1-5870438/morning-news-brief',
        sourceName: 'NPR News',
        publishedAt: '2026-06-18T09:00:00.000Z',
      }],
      generateQuestions: async () => [{
        id: 'current-events-dynamic-2026-06-18-1',
        category: 'current-events',
        difficulty: 'easy',
        question: 'What is the current event that is most relevant to the current news articles?',
        options: [
          'Rescuers in Venezuela continue search for the missing after devastating earthquakes',
          'SCOTUS rulings give Trump more power to set immigration policy',
          'Trump works to woo struggling American farmers',
          'Venezuela reels from earthquakes as rescuers scramble to find survivors',
        ],
        correctIndex: 1,
        sourceUrl: 'https://www.npr.org/2026/06/26/nx-s1-5870438/morning-news-brief',
        publishedAt: '2026-06-18T09:00:00.000Z',
      }],
    });

    expect(result).toEqual({ added: 0, kept: 0, removedExpired: 0, total: 0 });
    expect(writeQuestions).not.toHaveBeenCalled();
  });

  it('filters generated questions whose correct answer is unsupported without adding deterministic filler questions', async () => {
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

  it('retries a transient local Ollama timeout and returns generated questions when a later attempt succeeds', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed', {
        cause: Object.assign(new Error('Headers Timeout Error'), { code: 'UND_ERR_HEADERS_TIMEOUT' }),
      }))
      .mockResolvedValueOnce({
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
      });
    const sleep = vi.fn(async () => undefined);

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
      maxAttempts: 3,
      retryDelayMs: 5000,
      sleep,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(5000);
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      id: 'current-events-dynamic-2026-06-18-space',
      category: 'current-events',
      sourceUrl: 'https://example.com/space-announcement',
    });
  });

  it('returns no generated questions after exhausting bounded local Ollama retries', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed', {
        cause: Object.assign(new Error('Headers Timeout Error'), { code: 'UND_ERR_HEADERS_TIMEOUT' }),
      });
    });
    const sleep = vi.fn(async () => undefined);

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
      maxAttempts: 3,
      retryDelayMs: 5000,
      sleep,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(questions).toEqual([]);
  });

  it('aborts each slow local Ollama attempt after the configured per-attempt timeout', async () => {
    vi.useFakeTimers();
    try {
      const signals: AbortSignal[] = [];
      const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
        if (!init?.signal) {
          throw new Error('missing abort signal');
        }
        signals.push(init.signal);
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        });
      });

      const promise = generateQuestionsWithOllama([{ 
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
        maxAttempts: 2,
        retryDelayMs: 0,
        attemptTimeoutMs: 10,
      });

      await vi.advanceTimersByTimeAsync(10);
      await vi.advanceTimersByTimeAsync(10);
      const questions = await promise;

      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(signals).toHaveLength(2);
      expect(signals.every((signal) => signal.aborted)).toBe(true);
      expect(questions).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('generates questions with a local Ollama model and requests non-streaming JSON mode', async () => {
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
    const requestInit = fetchImpl.mock.calls[0]?.[1] as unknown as RequestInit;
    const body = JSON.parse(requestInit.body as string);
    expect(body).toMatchObject({
      model: 'qwen2.5-coder:3b',
      stream: false,
      format: 'json',
    });
    expect(body.options).toMatchObject({ temperature: 0.1 });
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      id: 'current-events-dynamic-2026-06-18-space',
      category: 'current-events',
      sourceUrl: 'https://example.com/space-announcement',
    });
  });

  it('generates questions through Hermes one-shot JSON output for cloud-backed refreshes', async () => {
    const execFileImpl = vi.fn(async () => ({
      stdout: JSON.stringify({
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
    }));

    const questions = await generateQuestionsWithHermes([{
      title: 'Acme Space announces reusable satellite bus',
      description: 'Acme Space announced a reusable satellite bus for low-earth-orbit missions.',
      url: 'https://example.com/space-announcement',
      sourceName: 'Example News',
      publishedAt: '2026-06-18T09:00:00.000Z',
    }], {
      execFileImpl,
      hermesCli: 'hermes',
      provider: 'openai-codex',
      model: 'gpt-5.5',
      now: NOW,
    });

    expect(execFileImpl).toHaveBeenCalledWith('hermes', expect.arrayContaining([
      '--ignore-rules',
      '-t',
      '',
      '--provider',
      'openai-codex',
      '-m',
      'gpt-5.5',
      '-z',
    ]), expect.objectContaining({
      timeout: expect.any(Number),
      maxBuffer: 1024 * 1024,
      env: expect.objectContaining({ HERMES_ACCEPT_HOOKS: '1' }),
    }));
    const args = execFileImpl.mock.calls[0]?.[1] ?? [];
    expect(args.at(-1)).toContain('Create exactly 1');
    expect(args.at(-1)).toContain('Acme Space announces reusable satellite bus');
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      id: 'current-events-dynamic-2026-06-18-space',
      category: 'current-events',
      sourceUrl: 'https://example.com/space-announcement',
    });
  });

  it('returns no questions when Hermes one-shot generation fails', async () => {
    const execFileImpl = vi.fn(async () => {
      throw new Error('subscription unavailable');
    });

    const questions = await generateQuestionsWithHermes([{
      title: 'Acme Space announces reusable satellite bus',
      description: 'Acme Space announced a reusable satellite bus for low-earth-orbit missions.',
      url: 'https://example.com/space-announcement',
      sourceName: 'Example News',
      publishedAt: '2026-06-18T09:00:00.000Z',
    }], {
      execFileImpl,
      now: NOW,
    });

    expect(questions).toEqual([]);
  });

  it('does not create deterministic fallback questions when local Ollama returns no usable questions', async () => {
    const writeQuestions = vi.fn();

    const result = await refreshCurrentEventsJson({
      now: NOW,
      readExisting: () => [],
      writeQuestions,
      fetchArticles: async () => [{
        title: 'Acme Space announces reusable satellite bus',
        description: 'Acme Space announced a reusable satellite bus for low-earth-orbit missions.',
        url: 'https://example.com/space-announcement',
        sourceName: 'Example News',
        publishedAt: '2026-06-18T09:00:00.000Z',
      }],
      generateQuestions: async () => [],
    });

    expect(result).toEqual({ added: 0, kept: 0, removedExpired: 0, total: 0 });
    expect(writeQuestions).not.toHaveBeenCalled();
  });

  it('removes existing valid questions instead of preserving them or adding deterministic fallback questions', async () => {
    const existingDynamic = {
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
      readExisting: () => [existingDynamic],
      writeQuestions,
      fetchArticles: async () => [
        {
          title: 'First NPR headline about a science mission',
          description: 'NPR reported on the science mission.',
          url: 'https://example.com/npr-first',
          sourceName: 'NPR News',
          publishedAt: '2026-06-18T09:00:00.000Z',
        },
        {
          title: 'Second NPR headline about a market update',
          description: 'NPR reported on the market update.',
          url: 'https://example.com/npr-second',
          sourceName: 'NPR News',
          publishedAt: '2026-06-18T10:00:00.000Z',
        },
        {
          title: 'Star Fox review: old tricks return',
          description: 'A review of a video game release.',
          url: 'https://example.com/review',
          sourceName: 'Ars Technica',
          publishedAt: '2026-06-18T11:00:00.000Z',
        },
        {
          title: 'Venezuela earthquakes kill 920 people as international rescue teams arrive',
          description: 'International rescue teams arrived after devastating earthquakes.',
          url: 'https://example.com/earthquake',
          sourceName: 'BBC World',
          publishedAt: '2026-06-18T11:30:00.000Z',
        },
        {
          title: 'Religion row as Texas makes Bible stories required reading in schools',
          description: 'A state education change sparked a religion row over Bible stories in schools.',
          url: 'https://example.com/religion-row',
          sourceName: 'BBC World',
          publishedAt: '2026-06-18T11:45:00.000Z',
        },
        {
          title: 'DR Congo takes Rwanda to international court over decades of conflict',
          description: 'The international court filing concerns decades of conflict.',
          url: 'https://example.com/congo-rwanda-conflict',
          sourceName: 'BBC World',
          publishedAt: '2026-06-18T11:50:00.000Z',
        },
        {
          title: 'Four men held over child marriage in Sierra Leone appear in landmark court case',
          description: 'A landmark court case concerns child marriage in Sierra Leone.',
          url: 'https://example.com/child-marriage',
          sourceName: 'BBC World',
          publishedAt: '2026-06-18T11:55:00.000Z',
        },
        {
          title: 'NASA announces telescope milestone',
          description: 'NASA announced a telescope milestone.',
          url: 'https://example.com/nasa',
          sourceName: 'NASA Breaking News',
          publishedAt: '2026-06-18T12:00:00.000Z',
        },
      ],
      generateQuestions: async () => [],
    });

    expect(result).toEqual({ added: 0, kept: 1, removedExpired: 0, total: 1 });
    expect(writeQuestions).not.toHaveBeenCalled();
  });
});
