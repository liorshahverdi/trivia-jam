import type { Difficulty, Question } from '@trivia-jam/shared';
import { deduplicate } from './deduplicator.js';
import { readExisting, writeQuestions as writeCategoryQuestions } from './writer.js';

const CURRENT_EVENTS_CATEGORY = 'current-events' as const;
const DYNAMIC_ID_PREFIX = 'current-events-dynamic-';
const DEFAULT_EXPIRATION_DAYS = 21;
const DEFAULT_MAX_ARTICLE_AGE_DAYS = 45;
const DEFAULT_MAX_DYNAMIC_QUESTIONS = 80;

export interface NewsArticle {
  title: string;
  description?: string | null;
  url: string;
  sourceName?: string | null;
  publishedAt: string;
}

export interface StaticCurrentEventQuestion extends Question {
  category: typeof CURRENT_EVENTS_CATEGORY;
  sourceUrl: string;
  publishedAt: string;
  expiresAt?: string;
  generatedAt?: string;
}

interface StoredStaticCurrentEventQuestion extends StaticCurrentEventQuestion {
  expiresAt: string;
  generatedAt: string;
}

export interface RefreshCurrentEventsJsonDeps {
  now?: Date;
  fetchArticles?: () => Promise<NewsArticle[]>;
  generateQuestions?: (articles: NewsArticle[]) => Promise<StaticCurrentEventQuestion[]>;
  readExisting?: () => Array<Question | StaticCurrentEventQuestion>;
  writeQuestions?: (questions: Array<Question | StaticCurrentEventQuestion>) => void;
  maxDynamicQuestions?: number;
}

export interface RefreshCurrentEventsJsonResult {
  added: number;
  kept: number;
  removedExpired: number;
  total: number;
}

export interface ValidationResult {
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

function isDynamicQuestion(question: Question | StaticCurrentEventQuestion): question is StaticCurrentEventQuestion {
  return question.id.startsWith(DYNAMIC_ID_PREFIX) || 'sourceUrl' in question || 'expiresAt' in question;
}

function hasValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function validateStaticCurrentEventQuestion(
  candidate: StaticCurrentEventQuestion,
  now = new Date(),
  maxArticleAgeDays = DEFAULT_MAX_ARTICLE_AGE_DAYS,
): ValidationResult {
  if (candidate.category !== CURRENT_EVENTS_CATEGORY) {
    return { valid: false, reason: 'category must be current-events' };
  }
  if (!candidate.id?.trim() || !candidate.id.startsWith(DYNAMIC_ID_PREFIX)) {
    return { valid: false, reason: `id must start with ${DYNAMIC_ID_PREFIX}` };
  }
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

function toStoredQuestion(candidate: StaticCurrentEventQuestion, now: Date): StoredStaticCurrentEventQuestion {
  const publishedAt = new Date(candidate.publishedAt);
  return {
    ...candidate,
    expiresAt: addDays(publishedAt, DEFAULT_EXPIRATION_DAYS).toISOString(),
    generatedAt: now.toISOString(),
  };
}

function isExpired(question: StaticCurrentEventQuestion, now: Date): boolean {
  if (!question.expiresAt) return false;
  const expiresAt = new Date(question.expiresAt);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime();
}

export async function fetchNewsApiArticles(): Promise<NewsArticle[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    console.warn('[current-events-static] NEWS_API_KEY is not configured; skipping refresh.');
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
      'User-Agent': 'trivia-jam-current-events-static/1.0',
    },
  });
  if (!res.ok) {
    console.warn(`[current-events-static] NewsAPI request failed: ${res.status} ${res.statusText}`);
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

function parseQuestionsFromOpenAIResponse(data: any): StaticCurrentEventQuestion[] {
  const outputText = data.output_text
    ?? data.output?.flatMap((item: any) => item.content ?? [])
      .find((content: any) => content.type === 'output_text' || content.text)?.text;
  if (!outputText) return [];

  const parsed = JSON.parse(outputText);
  const questions = Array.isArray(parsed) ? parsed : parsed.questions;
  return Array.isArray(questions) ? questions : [];
}

export async function generateQuestionsWithOpenAI(articles: NewsArticle[]): Promise<StaticCurrentEventQuestion[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[current-events-static] OPENAI_API_KEY is not configured; skipping generation.');
    return [];
  }
  if (articles.length === 0) return [];

  const today = new Date().toISOString().slice(0, 10);
  const prompt = `Create up to 20 multiple-choice current-events trivia questions from these recent news articles.\n\nRules:\n- Return strict JSON only: {"questions":[...]}\n- Each question must have id, category, difficulty, question, options, correctIndex, sourceUrl, publishedAt.\n- id must be unique and start with "${DYNAMIC_ID_PREFIX}${today}-".\n- category must be "current-events".\n- difficulty must be easy, medium, or hard.\n- options must contain exactly four unique strings.\n- The correct answer must be directly supported by the source article title/description.\n- Avoid tragedies, deaths, graphic crime, speculation, and opinion.\n- Prefer questions that will still make sense for 1-3 weeks.\n\nArticles:\n${JSON.stringify(articles.slice(0, 30))}`;

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
    console.warn(`[current-events-static] OpenAI generation failed: ${res.status} ${res.statusText}`);
    return [];
  }

  return parseQuestionsFromOpenAIResponse(await res.json());
}

export async function refreshCurrentEventsJson(
  deps: RefreshCurrentEventsJsonDeps = {},
): Promise<RefreshCurrentEventsJsonResult> {
  const now = deps.now ?? new Date();
  const fetchArticles = deps.fetchArticles ?? fetchNewsApiArticles;
  const generateQuestions = deps.generateQuestions ?? generateQuestionsWithOpenAI;
  const read = deps.readExisting ?? (() => readExisting(CURRENT_EVENTS_CATEGORY));
  const write = deps.writeQuestions ?? ((questions) => writeCategoryQuestions(CURRENT_EVENTS_CATEGORY, questions as Question[]));
  const maxDynamicQuestions = deps.maxDynamicQuestions ?? DEFAULT_MAX_DYNAMIC_QUESTIONS;

  const existing = read();
  const keptExisting = existing.filter((question) => !isDynamicQuestion(question) || !isExpired(question, now));
  const removedExpired = existing.length - keptExisting.length;

  const articles = await fetchArticles();
  const generated = articles.length > 0 ? await generateQuestions(articles) : [];
  const validGenerated = generated
    .filter((question) => validateStaticCurrentEventQuestion(question, now).valid)
    .map((question) => toStoredQuestion(question, now));

  const existingDynamic = keptExisting.filter(isDynamicQuestion);
  const { unique } = deduplicate(validGenerated, keptExisting as Question[]);
  const newDynamic = unique.slice(0, Math.max(0, maxDynamicQuestions - existingDynamic.length));
  const merged = [...keptExisting, ...newDynamic];

  if (removedExpired > 0 || newDynamic.length > 0) {
    write(merged);
  }

  return {
    added: newDynamic.length,
    kept: keptExisting.length,
    removedExpired,
    total: merged.length,
  };
}
