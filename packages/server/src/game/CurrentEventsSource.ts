import type { Difficulty, Question } from '@trivia-jam/shared';
import type pg from 'pg';

const CURRENT_EVENTS_CATEGORY = 'current-events' as const;
const DEFAULT_EXPIRATION_DAYS = 21;
const DEFAULT_MAX_ARTICLE_AGE_DAYS = 45;

export interface NewsArticle {
  title: string;
  description?: string | null;
  url: string;
  sourceName?: string | null;
  publishedAt: string;
}

export interface GeneratedCurrentEventQuestion extends Question {
  category: typeof CURRENT_EVENTS_CATEGORY;
  sourceUrl: string;
  publishedAt: string;
}

interface StoredCurrentEventQuestion extends GeneratedCurrentEventQuestion {
  expiresAt: string;
  generatedAt: string;
}

export interface CurrentEventsRefreshDeps {
  now?: Date;
  fetchArticles?: () => Promise<NewsArticle[]>;
  generateQuestions?: (articles: NewsArticle[]) => Promise<GeneratedCurrentEventQuestion[]>;
}

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isDifficulty(value: string): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

function hasValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function validateGeneratedCurrentEventQuestion(
  candidate: GeneratedCurrentEventQuestion,
  now = new Date(),
  maxArticleAgeDays = DEFAULT_MAX_ARTICLE_AGE_DAYS,
): ValidationResult {
  if (candidate.category !== CURRENT_EVENTS_CATEGORY) {
    return { valid: false, reason: 'category must be current-events' };
  }
  if (!candidate.id?.trim()) return { valid: false, reason: 'missing id' };
  if (!isDifficulty(candidate.difficulty)) return { valid: false, reason: 'invalid difficulty' };
  if (!candidate.question?.trim() || candidate.question.length < 20) {
    return { valid: false, reason: 'question is too short' };
  }
  if (!Array.isArray(candidate.options) || candidate.options.length !== 4) {
    return { valid: false, reason: 'must have exactly 4 options' };
  }
  const normalizedOptions = candidate.options.map((option) => option.trim().toLowerCase());
  if (normalizedOptions.some((option) => option.length === 0)) {
    return { valid: false, reason: 'options cannot be blank' };
  }
  if (new Set(normalizedOptions).size !== 4) {
    return { valid: false, reason: 'options must be unique' };
  }
  if (!Number.isInteger(candidate.correctIndex) || candidate.correctIndex < 0 || candidate.correctIndex > 3) {
    return { valid: false, reason: 'correctIndex must point at an option' };
  }
  if (!hasValidUrl(candidate.sourceUrl)) {
    return { valid: false, reason: 'sourceUrl must be a valid http(s) URL' };
  }

  const publishedAt = new Date(candidate.publishedAt);
  if (Number.isNaN(publishedAt.getTime())) {
    return { valid: false, reason: 'publishedAt must be a valid date' };
  }
  if (publishedAt.getTime() > addDays(now, 1).getTime()) {
    return { valid: false, reason: 'publishedAt cannot be in the future' };
  }
  if (publishedAt.getTime() < addDays(now, -maxArticleAgeDays).getTime()) {
    return { valid: false, reason: 'article is too old for current events' };
  }

  return { valid: true };
}

function toStoredQuestion(candidate: GeneratedCurrentEventQuestion, now: Date): StoredCurrentEventQuestion {
  const publishedAt = new Date(candidate.publishedAt);
  return {
    ...candidate,
    expiresAt: addDays(publishedAt, DEFAULT_EXPIRATION_DAYS).toISOString(),
    generatedAt: now.toISOString(),
  };
}

export async function fetchNewsApiArticles(): Promise<NewsArticle[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    console.warn('[CurrentEventsSource] NEWS_API_KEY is not configured; skipping dynamic current events refresh.');
    return [];
  }

  const url = new URL('https://newsapi.org/v2/top-headlines');
  url.searchParams.set('country', process.env.CURRENT_EVENTS_NEWS_COUNTRY ?? 'us');
  url.searchParams.set('pageSize', process.env.CURRENT_EVENTS_NEWS_PAGE_SIZE ?? '30');
  if (process.env.CURRENT_EVENTS_NEWS_CATEGORY) {
    url.searchParams.set('category', process.env.CURRENT_EVENTS_NEWS_CATEGORY);
  }

  const res = await fetch(url, {
    headers: {
      'X-Api-Key': apiKey,
      'User-Agent': 'trivia-jam-current-events/1.0',
    },
  });
  if (!res.ok) {
    console.warn(`[CurrentEventsSource] NewsAPI request failed: ${res.status} ${res.statusText}`);
    return [];
  }

  const data = await res.json() as {
    articles?: Array<{
      title?: string;
      description?: string | null;
      url?: string;
      source?: { name?: string | null };
      publishedAt?: string;
    }>;
  };

  return (data.articles ?? [])
    .filter((article) => article.title && article.url && article.publishedAt)
    .map((article) => ({
      title: article.title!,
      description: article.description ?? null,
      url: article.url!,
      sourceName: article.source?.name ?? null,
      publishedAt: article.publishedAt!,
    }));
}

function parseQuestionsFromOpenAIResponse(data: any): GeneratedCurrentEventQuestion[] {
  const outputText = data.output_text
    ?? data.output?.flatMap((item: any) => item.content ?? [])
      .find((content: any) => content.type === 'output_text' || content.text)?.text;
  if (!outputText) return [];

  const parsed = JSON.parse(outputText);
  const questions = Array.isArray(parsed) ? parsed : parsed.questions;
  return Array.isArray(questions) ? questions : [];
}

export async function generateQuestionsWithOpenAI(articles: NewsArticle[]): Promise<GeneratedCurrentEventQuestion[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[CurrentEventsSource] OPENAI_API_KEY is not configured; skipping dynamic current events generation.');
    return [];
  }
  if (articles.length === 0) return [];

  const prompt = `Create up to 12 multiple-choice trivia questions from these recent news articles.\n\nRules:\n- Return strict JSON only: {"questions":[...]}\n- Each question must have id, category, difficulty, question, options, correctIndex, sourceUrl, publishedAt.\n- category must be "current-events".\n- difficulty must be easy, medium, or hard.\n- options must contain exactly four unique strings.\n- The correct answer must be directly supported by the source article title/description.\n- Avoid tragedies, deaths, graphic crime, speculation, and opinion.\n- Prefer questions that will still make sense for 1-3 weeks.\n\nArticles:\n${JSON.stringify(articles.slice(0, 30))}`;

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.CURRENT_EVENTS_OPENAI_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      input: prompt,
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    console.warn(`[CurrentEventsSource] OpenAI generation failed: ${res.status} ${res.statusText}`);
    return [];
  }

  return parseQuestionsFromOpenAIResponse(await res.json());
}

export async function refreshCurrentEventsQuestions(
  pool: pg.Pool,
  deps: CurrentEventsRefreshDeps = {},
): Promise<number> {
  const now = deps.now ?? new Date();
  const fetchArticles = deps.fetchArticles ?? fetchNewsApiArticles;
  const generateQuestions = deps.generateQuestions ?? generateQuestionsWithOpenAI;

  await pool.query(
    'DELETE FROM questions WHERE category = $1 AND expires_at IS NOT NULL AND expires_at <= $2',
    [CURRENT_EVENTS_CATEGORY, now.toISOString()],
  );

  const articles = await fetchArticles();
  if (articles.length === 0) return 0;

  const generated = await generateQuestions(articles);
  const validQuestions = generated
    .filter((question) => validateGeneratedCurrentEventQuestion(question, now).valid)
    .map((question) => toStoredQuestion(question, now));

  let inserted = 0;
  for (const q of validQuestions) {
    const result = await pool.query(
      `INSERT INTO questions (
        id, category, difficulty, question, options, correct_index, question_key,
        source_type, source_url, published_at, expires_at, generated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (question_key) DO NOTHING`,
      [
        q.id,
        q.category,
        q.difficulty,
        q.question,
        JSON.stringify(q.options),
        q.correctIndex,
        q.question.toLowerCase().trim(),
        'dynamic-current-events',
        q.sourceUrl,
        q.publishedAt,
        q.expiresAt,
        q.generatedAt,
      ],
    );
    if (result.rowCount && result.rowCount > 0) inserted++;
  }

  return inserted;
}
