import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Difficulty, Question } from '@trivia-jam/shared';
import { deduplicate } from './deduplicator.js';
import { readExisting, writeQuestions as writeCategoryQuestions } from './writer.js';

const CURRENT_EVENTS_CATEGORY = 'current-events' as const;
const DYNAMIC_ID_PREFIX = 'current-events-dynamic-';
const DEFAULT_EXPIRATION_DAYS = 21;
const DEFAULT_MAX_ARTICLE_AGE_DAYS = 45;
const DEFAULT_MIN_DYNAMIC_QUESTIONS = 20;
const DEFAULT_MAX_DYNAMIC_QUESTIONS = 80;
const DEFAULT_OLLAMA_MAX_ATTEMPTS = 3;
const DEFAULT_OLLAMA_RETRY_DELAY_MS = 5_000;
const DEFAULT_OLLAMA_ATTEMPT_TIMEOUT_MS = 10 * 60 * 1_000;
const DEFAULT_HERMES_TIMEOUT_MS = 10 * 60 * 1_000;

const execFileAsync = promisify(execFile);

type ExecFileLike = (
  file: string,
  args: string[],
  options: { timeout: number; maxBuffer: number; env: NodeJS.ProcessEnv },
) => Promise<{ stdout: string; stderr?: string }>;

export interface NewsArticle {
  title: string;
  description?: string | null;
  url: string;
  sourceName?: string | null;
  publishedAt: string;
}

export interface RssFeed {
  name: string;
  url: string;
}

export const DEFAULT_RSS_FEEDS: RssFeed[] = [
  { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml' },
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'PBS NewsHour', url: 'https://www.pbs.org/newshour/feeds/rss/headlines' },
  { name: 'NASA Breaking News', url: 'https://www.nasa.gov/news-release/feed/' },
  { name: 'ScienceDaily Top News', url: 'https://www.sciencedaily.com/rss/top.xml' },
  { name: 'Space.com', url: 'https://www.space.com/feeds/all' },
  { name: 'Smithsonian Smart News', url: 'https://www.smithsonianmag.com/rss/smart-news/' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { name: 'Hacker News', url: 'https://hnrss.org/frontpage' },
];

type FetchLike = (url: string, init?: RequestInit) => Promise<{
  ok: boolean;
  status?: number;
  statusText?: string;
  text?: () => Promise<string>;
  json?: () => Promise<any>;
}>;

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
  minDynamicQuestions?: number;
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
  if (isGenericCurrentEventsQuestion(candidate.question)) {
    return { valid: false, reason: 'question is too generic for the source subject' };
  }
  if (hasUnderspecifiedReference(candidate.question)) {
    return { valid: false, reason: 'question uses an underspecified reference instead of naming the subject' };
  }
  if (!Array.isArray(candidate.options) || candidate.options.length !== 4) {
    return { valid: false, reason: 'must have exactly 4 options' };
  }
  if (hasUnsafeCurrentEventsSubject([candidate.question, ...candidate.options].join(' '))) {
    return { valid: false, reason: 'question subject is too grim or politically volatile for casual trivia' };
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

function normalizeTextForSupport(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function isGenericCurrentEventsQuestion(question: string): boolean {
  const normalized = normalizeTextForSupport(question);
  return [
    /\bcurrent event\b.*\b(current )?news articles\b/,
    /\bmost relevant\b.*\b(current )?news\b/,
    /\bwhat is the (main|top|current) (news story|current event|event)\b/,
    /\bwhich (story|headline|article) is most relevant\b/,
  ].some((pattern) => pattern.test(normalized));
}

function hasUnderspecifiedReference(question: string): boolean {
  const normalized = normalizeTextForSupport(question);
  return [
    /\bthe two (countries|companies|groups|teams|leaders|sides)\b/,
    /\bthese two (countries|companies|groups|teams|leaders|sides)\b/,
    /\bthe (country|company|group|team|leader|agency|official|person|organization|organisation)\b/,
    /\bthis (country|company|group|team|leader|agency|official|person|organization|organisation)\b/,
    /\bthe (most significant|biggest|main|major|key) (test|step|move|development|event|issue|decision)\b/,
  ].some((pattern) => pattern.test(normalized));
}

function hasUnsafeCurrentEventsSubject(text: string): boolean {
  const normalized = normalizeTextForSupport(text);
  return /\b(war|battle|battles|conflict|conflicts|congo|rwanda|strike|strikes|missile|russia|ukraine|israel|iran|trump|death|deaths|dead|deadly|kill|kills|killed|shooting|crime|earthquake|earthquakes|heatwave|religion|bible|schools?|child marriage|sierra leone|rescuers|survivors|devastating|detention|immigrant|bankruptcy)\b/.test(normalized);
}

function isSafeArticleForTrivia(article: NewsArticle): boolean {
  const text = [article.title, article.description ?? '', article.sourceName ?? ''].join(' ');
  if (hasUnsafeCurrentEventsSubject(text)) return false;
  return !/\b(review|opinion|editorial|recap|rumor|rumour|ranked|ranking|blog|lawsuit|scandal|sanction|sanctions|smuggling|epstein)\b/.test(normalizeTextForSupport(text));
}

function isQuestionSupportedBySource(question: StaticCurrentEventQuestion, articles: NewsArticle[]): boolean {
  const sourceArticle = articles.find((article) => article.url === question.sourceUrl);
  if (!sourceArticle) return false;

  const correctAnswer = normalizeTextForSupport(question.options[question.correctIndex] ?? '');
  if (!correctAnswer) return false;

  const sourceText = normalizeTextForSupport([
    sourceArticle.title,
    sourceArticle.description ?? '',
    sourceArticle.sourceName ?? '',
  ].join(' '));

  return sourceText.includes(correctAnswer);
}

function hasUniqueQuestionText(question: StaticCurrentEventQuestion, accepted: StaticCurrentEventQuestion[]): boolean {
  const text = normalizeTextForSupport(question.question);
  return !accepted.some((existing) => normalizeTextForSupport(existing.question) === text);
}


function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}

function tagValue(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1]) : null;
}

function entryBlocks(xml: string): string[] {
  const itemMatches = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
  if (itemMatches.length > 0) return itemMatches;
  return [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)].map((match) => match[1]);
}

function atomLink(entry: string): string | null {
  const href = entry.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1];
  return href ? decodeXml(href) : null;
}

export async function fetchRssArticles({
  feeds = DEFAULT_RSS_FEEDS,
  fetchImpl = fetch as FetchLike,
  now = new Date(),
  maxArticleAgeDays = DEFAULT_MAX_ARTICLE_AGE_DAYS,
}: {
  feeds?: RssFeed[];
  fetchImpl?: FetchLike;
  now?: Date;
  maxArticleAgeDays?: number;
} = {}): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];
  const oldestAllowed = addDays(now, -maxArticleAgeDays).getTime();

  for (const feed of feeds) {
    try {
      const res = await fetchImpl(feed.url, {
        headers: { 'User-Agent': 'trivia-jam-current-events-rss/1.0' },
      });
      if (!res.ok || !res.text) {
        console.warn(`[current-events-static] RSS request failed for ${feed.name}: ${res.status} ${res.statusText ?? ''}`);
        continue;
      }

      const xml = await res.text();
      for (const entry of entryBlocks(xml)) {
        const title = tagValue(entry, 'title');
        const url = tagValue(entry, 'link') ?? atomLink(entry);
        const publishedRaw = tagValue(entry, 'pubDate') ?? tagValue(entry, 'published') ?? tagValue(entry, 'updated');
        if (!title || !url || !publishedRaw) continue;

        const publishedAt = new Date(publishedRaw);
        if (Number.isNaN(publishedAt.getTime())) continue;
        if (publishedAt.getTime() < oldestAllowed || publishedAt.getTime() > addDays(now, 1).getTime()) continue;

        articles.push({
          title,
          description: tagValue(entry, 'description') ?? tagValue(entry, 'summary') ?? null,
          url,
          sourceName: feed.name,
          publishedAt: publishedAt.toISOString(),
        });
      }
    } catch (err) {
      console.warn(`[current-events-static] RSS fetch failed for ${feed.name}:`, err);
    }
  }

  const seen = new Set<string>();
  return articles.filter((article) => {
    const key = article.url || article.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildGenerationPrompt(articles: NewsArticle[], now: Date, articleLimit = 40): string {
  const today = now.toISOString().slice(0, 10);
  const promptArticles = articles.filter(isSafeArticleForTrivia).slice(0, articleLimit);
  const questionLimit = Math.max(1, Math.min(promptArticles.length, DEFAULT_MAX_DYNAMIC_QUESTIONS));
  return `Create exactly ${questionLimit} multiple-choice current-events trivia questions from these recent news articles, with no more than one question per article.

Rules:
- Return strict JSON only: {"questions":[...]}
- Each question must have id, category, difficulty, question, options, correctIndex, sourceUrl, publishedAt.
- id must be unique and start with "${DYNAMIC_ID_PREFIX}${today}-".
- category must be "current-events".
- difficulty must be easy, medium, or hard.
- options must contain exactly four unique strings.
- The question text must name a concrete subject from the article title/description (for example a company, agency, mission, place, policy, product, or discovery). Do not use vague references like "the country", "the company", "the two countries", "this event", or "the most significant test". Do not ask generic meta-questions like "What is the current event..." or "Which headline is most relevant...".
- The correct answer must appear verbatim in the article title, description, or sourceName.
- Use only facts present in the supplied title/description/sourceName. Do not invent people, companies, products, numbers, dates, or expert names.
- Avoid tragedies, deaths, graphic crime, speculation, and opinion.
- Prefer questions that will still make sense for 1-3 weeks.
- If fewer than ${questionLimit} safe high-quality questions are possible, return fewer rather than filler; the publisher will reject undersized batches.

Articles:
${JSON.stringify(promptArticles)}`;
}

function parseQuestionsFromJsonText(text: string): StaticCurrentEventQuestion[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidateText = fenced ?? text;
  const start = candidateText.indexOf('{');
  const end = candidateText.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return [];

  const parsed = JSON.parse(candidateText.slice(start, end + 1));
  const questions = Array.isArray(parsed) ? parsed : parsed.questions;
  return Array.isArray(questions) ? questions : [];
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error && error.cause instanceof Error ? `: ${error.cause.message}` : '';
  return `${message}${cause}`;
}

export async function generateQuestionsWithOllama(
  articles: NewsArticle[],
  {
    fetchImpl = fetch as FetchLike,
    model = process.env.CURRENT_EVENTS_OLLAMA_MODEL ?? 'qwen2.5-coder:3b',
    ollamaUrl = process.env.OLLAMA_HOST ?? 'http://localhost:11434',
    now = new Date(),
    articleLimit = parseInt(process.env.CURRENT_EVENTS_ARTICLE_LIMIT ?? '40', 10),
    maxAttempts = parseInt(process.env.CURRENT_EVENTS_OLLAMA_MAX_ATTEMPTS ?? `${DEFAULT_OLLAMA_MAX_ATTEMPTS}`, 10),
    retryDelayMs = parseInt(process.env.CURRENT_EVENTS_OLLAMA_RETRY_DELAY_MS ?? `${DEFAULT_OLLAMA_RETRY_DELAY_MS}`, 10),
    attemptTimeoutMs = parseInt(process.env.CURRENT_EVENTS_OLLAMA_ATTEMPT_TIMEOUT_MS ?? `${DEFAULT_OLLAMA_ATTEMPT_TIMEOUT_MS}`, 10),
    disableOllama = process.env.CURRENT_EVENTS_DISABLE_OLLAMA === '1',
    sleep = sleepMs,
  }: {
    fetchImpl?: FetchLike;
    model?: string;
    ollamaUrl?: string;
    now?: Date;
    articleLimit?: number;
    maxAttempts?: number;
    retryDelayMs?: number;
    attemptTimeoutMs?: number;
    disableOllama?: boolean;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<StaticCurrentEventQuestion[]> {
  if (disableOllama) return [];
  if (articles.length === 0) return [];

  const attempts = Math.max(1, Number.isFinite(maxAttempts) ? Math.floor(maxAttempts) : DEFAULT_OLLAMA_MAX_ATTEMPTS);
  const delayMs = Math.max(0, Number.isFinite(retryDelayMs) ? Math.floor(retryDelayMs) : DEFAULT_OLLAMA_RETRY_DELAY_MS);
  const timeoutMs = Math.max(0, Number.isFinite(attemptTimeoutMs) ? Math.floor(attemptTimeoutMs) : DEFAULT_OLLAMA_ATTEMPT_TIMEOUT_MS);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = timeoutMs > 0
      ? setTimeout(() => controller.abort(new DOMException(`Ollama generation timed out after ${timeoutMs}ms`, 'TimeoutError')), timeoutMs)
      : null;

    try {
      const res = await fetchImpl(`${ollamaUrl.replace(/\/$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          prompt: buildGenerationPrompt(articles, now, articleLimit),
          stream: false,
          format: 'json',
          options: { temperature: 0.1, num_predict: 1200 },
        }),
      });
      if (!res.ok || !res.json) {
        console.warn(`[current-events-static] Ollama generation attempt ${attempt}/${attempts} failed: ${res.status} ${res.statusText ?? ''}`);
        if (attempt < attempts && (!res.status || res.status >= 500)) {
          if (delayMs > 0) {
            console.warn(`[current-events-static] Retrying Ollama generation in ${delayMs}ms`);
            await sleep(delayMs);
          }
          continue;
        }
        return [];
      }

      let responseText = '';
      if (res.text) {
        const body = await res.text();
        for (const line of body.split('\n')) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line) as { response?: string };
            responseText += chunk.response ?? '';
          } catch {
            // Some tests/fallbacks may provide a non-stream JSON string directly.
            responseText += line;
          }
        }
      } else if (res.json) {
        const data = await res.json() as { response?: string };
        responseText = data.response ?? '';
      }

      if (!responseText) return [];
      return parseQuestionsFromJsonText(responseText);
    } catch (error) {
      console.warn(`[current-events-static] Ollama generation attempt ${attempt}/${attempts} failed: ${describeError(error)}`);
      if (attempt < attempts) {
        if (delayMs > 0) {
          console.warn(`[current-events-static] Retrying Ollama generation in ${delayMs}ms`);
          await sleep(delayMs);
        }
        continue;
      }
      return [];
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  return [];
}

export async function generateQuestionsWithHermes(
  articles: NewsArticle[],
  {
    execFileImpl = execFileAsync as ExecFileLike,
    hermesCli = process.env.CURRENT_EVENTS_HERMES_CLI ?? 'hermes',
    provider = process.env.CURRENT_EVENTS_HERMES_PROVIDER,
    model = process.env.CURRENT_EVENTS_HERMES_MODEL,
    now = new Date(),
    articleLimit = parseInt(process.env.CURRENT_EVENTS_ARTICLE_LIMIT ?? '40', 10),
    timeoutMs = parseInt(process.env.CURRENT_EVENTS_HERMES_TIMEOUT_MS ?? `${DEFAULT_HERMES_TIMEOUT_MS}`, 10),
  }: {
    execFileImpl?: ExecFileLike;
    hermesCli?: string;
    provider?: string;
    model?: string;
    now?: Date;
    articleLimit?: number;
    timeoutMs?: number;
  } = {},
): Promise<StaticCurrentEventQuestion[]> {
  if (articles.length === 0) return [];

  const args = ['--ignore-rules', '-t', '', '-z', buildGenerationPrompt(articles, now, articleLimit)];
  if (provider?.trim()) args.splice(0, 0, '--provider', provider.trim());
  if (model?.trim()) args.splice(0, 0, '-m', model.trim());

  try {
    const { stdout } = await execFileImpl(hermesCli, args, {
      timeout: Math.max(1, Number.isFinite(timeoutMs) ? Math.floor(timeoutMs) : DEFAULT_HERMES_TIMEOUT_MS),
      maxBuffer: 1024 * 1024,
      env: { ...process.env, HERMES_ACCEPT_HOOKS: '1' },
    });
    return parseQuestionsFromJsonText(stdout);
  } catch (error) {
    console.warn(`[current-events-static] Hermes generation failed: ${describeError(error)}`);
    return [];
  }
}

async function generateQuestionsWithConfiguredProvider(
  articles: NewsArticle[],
  now: Date,
): Promise<StaticCurrentEventQuestion[]> {
  const generator = (process.env.CURRENT_EVENTS_GENERATOR ?? 'hermes').toLowerCase();
  if (generator === 'ollama') return generateQuestionsWithOllama(articles, { now });
  if (generator === 'none') return [];
  return generateQuestionsWithHermes(articles, { now });
}

export async function refreshCurrentEventsJson(
  deps: RefreshCurrentEventsJsonDeps = {},
): Promise<RefreshCurrentEventsJsonResult> {
  const now = deps.now ?? new Date();
  const fetchArticles = deps.fetchArticles ?? fetchRssArticles;
  const generateQuestions = deps.generateQuestions ?? ((articles) => generateQuestionsWithConfiguredProvider(articles, now));
  const read = deps.readExisting ?? (() => readExisting(CURRENT_EVENTS_CATEGORY));
  const write = deps.writeQuestions ?? ((questions) => writeCategoryQuestions(CURRENT_EVENTS_CATEGORY, questions as Question[]));
  const minDynamicQuestions = deps.minDynamicQuestions ?? DEFAULT_MIN_DYNAMIC_QUESTIONS;
  const maxDynamicQuestions = deps.maxDynamicQuestions ?? DEFAULT_MAX_DYNAMIC_QUESTIONS;

  const existing = read();
  const retainedExisting: StoredStaticCurrentEventQuestion[] = [];
  for (const question of existing) {
    if (!isDynamicQuestion(question)) continue;
    if (isExpired(question, now)) continue;
    const validation = validateStaticCurrentEventQuestion(question, now);
    if (!validation.valid) continue;
    retainedExisting.push(question as StoredStaticCurrentEventQuestion);
  }

  const removedExpired = existing.length - retainedExisting.length;
  const remainingCapacity = Math.max(0, maxDynamicQuestions - retainedExisting.length);
  const neededTopUp = Math.max(0, minDynamicQuestions - retainedExisting.length);

  let acceptedGenerated: StoredStaticCurrentEventQuestion[] = [];
  if (remainingCapacity > 0 && neededTopUp > 0) {
    const articles = await fetchArticles();
    const generated = articles.length > 0 ? await generateQuestions(articles) : [];
    const accepted: StoredStaticCurrentEventQuestion[] = [];
    for (const question of generated) {
      if (!validateStaticCurrentEventQuestion(question, now).valid) continue;
      if (!isQuestionSupportedBySource(question, articles)) continue;
      if (!hasUniqueQuestionText(question, retainedExisting)) continue;
      if (!hasUniqueQuestionText(question, accepted)) continue;
      accepted.push(toStoredQuestion(question, now));
    }
    const { unique } = deduplicate(accepted, retainedExisting);
    acceptedGenerated = unique.slice(0, Math.min(remainingCapacity, neededTopUp));
  }

  const nextQuestions = [...retainedExisting, ...acceptedGenerated].slice(0, Math.max(0, maxDynamicQuestions));

  if (nextQuestions.length < minDynamicQuestions) {
    return {
      added: 0,
      kept: retainedExisting.length,
      removedExpired,
      total: retainedExisting.length,
    };
  }

  if (removedExpired > 0 || acceptedGenerated.length > 0) {
    write(nextQuestions);
  }

  return {
    added: acceptedGenerated.length,
    kept: retainedExisting.length,
    removedExpired,
    total: nextQuestions.length,
  };
}
