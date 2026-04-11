import type { Category, Difficulty, Question } from '@trivia-jam/shared';
import { CATEGORY_LABELS } from '@trivia-jam/shared';
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type pg from 'pg';
import { getPool } from '../db.js';
import { clearQuestionCache } from './QuestionPicker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const questionsDir = join(__dirname, '..', '..', '..', 'shared', 'src', 'questions');

const ALL_CATEGORIES: Category[] = [
  'math', 'science', 'history', 'current-events', 'music', 'food', 'tech',
  'geography', 'art', 'entertainment', 'animals', 'general',
  'musicals', 'television', 'video-games', 'board-games', 'mythology',
  'gadgets', 'anime', 'cartoons',
];

// Open Trivia DB category mapping
// Categories without a direct OpenTDB match are excluded (undefined) so the
// crawler skips them and we rely on the curated JSON question files instead.
const OPENTDB_CATEGORY_MAP: Partial<Record<Category, number>> = {
  math: 19,              // Mathematics
  science: 17,           // Science & Nature
  history: 23,           // History
  music: 12,             // Entertainment: Music
  tech: 18,              // Science: Computers
  geography: 22,         // Geography
  art: 25,               // Art
  entertainment: 11,     // Entertainment: Film
  animals: 27,           // Animals
  general: 9,            // General Knowledge
  musicals: 13,          // Entertainment: Musicals & Theatres
  television: 14,        // Entertainment: Television
  'video-games': 15,     // Entertainment: Video Games
  'board-games': 16,     // Entertainment: Board Games
  mythology: 20,         // Mythology
  gadgets: 30,           // Science: Gadgets
  anime: 31,             // Entertainment: Japanese Anime & Manga
  cartoons: 32,          // Entertainment: Cartoon & Animations
};

// The Trivia API (https://the-trivia-api.com) category mapping
// Used for categories that OpenTDB doesn't cover.
const TRIVIA_API_CATEGORY_MAP: Partial<Record<Category, string>> = {
  food: 'food_and_drink',
  'current-events': 'society_and_culture',
};

interface TriviaAPIQuestion {
  id: string;
  category: string;
  correctAnswer: string;
  incorrectAnswers: string[];
  question: { text: string };
  difficulty: string;
}

async function fetchFromTriviaAPI(category: Category, count: number): Promise<Question[]> {
  const apiCategory = TRIVIA_API_CATEGORY_MAP[category];
  if (!apiCategory) return [];
  const url = `https://the-trivia-api.com/v2/questions?categories=${apiCategory}&limit=${count}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data: TriviaAPIQuestion[] = await res.json();

    return data.map((item, i) => {
      const correct = item.correctAnswer;
      const incorrect = item.incorrectAnswers.slice(0, 3);
      if (incorrect.length < 3) return null;
      const options = [...incorrect];
      const correctIndex = Math.floor(Math.random() * 4);
      options.splice(correctIndex, 0, correct);

      return {
        id: `${category}-trivia-${Date.now()}-${i}`,
        category,
        difficulty: mapDifficulty(item.difficulty),
        question: item.question.text,
        options: options.slice(0, 4) as [string, string, string, string],
        correctIndex,
      };
    }).filter((q): q is Question => q !== null);
  } catch (err) {
    console.warn(`[QuestionCrawler] Failed to fetch from Trivia API for ${category}:`, err);
    return [];
  }
}

interface OpenTDBResponse {
  response_code: number;
  results: Array<{
    category: string;
    type: string;
    difficulty: string;
    question: string;
    correct_answer: string;
    incorrect_answers: string[];
  }>;
}

function decodeHTML(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&eacute;/g, 'é')
    .replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&hellip;/g, '...')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&shy;/g, '')
    .replace(/&#\d+;/g, (m) => {
      const code = parseInt(m.slice(2, -1), 10);
      return String.fromCharCode(code);
    });
}

function mapDifficulty(d: string): Difficulty {
  if (d === 'easy') return 'easy';
  if (d === 'medium') return 'medium';
  return 'hard';
}

async function fetchQuestions(category: Category, count: number): Promise<Question[]> {
  const catId = OPENTDB_CATEGORY_MAP[category];
  if (catId !== undefined) return fetchFromOpenTDB(category, count);
  if (TRIVIA_API_CATEGORY_MAP[category]) return fetchFromTriviaAPI(category, count);
  return [];
}

async function fetchFromOpenTDB(category: Category, count: number): Promise<Question[]> {
  const catId = OPENTDB_CATEGORY_MAP[category]!;
  const url = `https://opentdb.com/api.php?amount=${count}&type=multiple&category=${catId}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data: OpenTDBResponse = await res.json();
    if (data.response_code !== 0) return [];

    return data.results.map((item, i) => {
      const correct = decodeHTML(item.correct_answer);
      const incorrect = item.incorrect_answers.map(decodeHTML);
      const options = [...incorrect];
      const correctIndex = Math.floor(Math.random() * 4);
      options.splice(correctIndex, 0, correct);

      return {
        id: `${category}-crawl-${Date.now()}-${i}`,
        category,
        difficulty: mapDifficulty(item.difficulty),
        question: decodeHTML(item.question),
        options: options.slice(0, 4) as [string, string, string, string],
        correctIndex,
      };
    });
  } catch (err) {
    console.warn(`[QuestionCrawler] Failed to fetch from OpenTDB for ${category}:`, err);
    return [];
  }
}

function loadExisting(category: Category): Question[] {
  try {
    const filePath = join(questionsDir, `${category}.json`);
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
}

function deduplicateQuestions(questions: Question[]): Question[] {
  const seen = new Set<string>();
  return questions.filter((q) => {
    const key = q.question.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function crawlCategoryToDb(pool: pg.Pool, category: Category): Promise<number> {
  const fetched = await fetchQuestions(category, 30);
  if (fetched.length === 0) return 0;

  let inserted = 0;
  for (const q of fetched) {
    const result = await pool.query(
      `INSERT INTO questions (id, category, difficulty, question, options, correct_index, question_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (question_key) DO NOTHING`,
      [q.id, q.category, q.difficulty, q.question, JSON.stringify(q.options), q.correctIndex, q.question.toLowerCase().trim()]
    );
    if (result.rowCount && result.rowCount > 0) inserted++;
  }
  return inserted;
}

async function crawlCategory(category: Category): Promise<number> {
  const existing = loadExisting(category);
  const existingQuestions = new Set(existing.map((q) => q.question.toLowerCase().trim()));

  // Fetch 30 questions (across difficulties) to get a good mix
  const fetched = await fetchQuestions(category, 30);
  const newQuestions = fetched.filter(
    (q) => !existingQuestions.has(q.question.toLowerCase().trim())
  );

  if (newQuestions.length === 0) {
    return 0;
  }

  const merged = deduplicateQuestions([...existing, ...newQuestions]);
  const filePath = join(questionsDir, `${category}.json`);
  writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n');

  return newQuestions.length;
}

/**
 * Crawls the Open Trivia Database for fresh questions across all categories.
 * Uses DB if available, falls back to JSON files.
 */
export async function crawlAllQuestions(): Promise<void> {
  console.log('[QuestionCrawler] Starting question crawl...');

  const pool = getPool();
  let totalNew = 0;

  for (const category of ALL_CATEGORIES) {
    const label = CATEGORY_LABELS[category] ?? category;
    try {
      const count = pool
        ? await crawlCategoryToDb(pool, category)
        : await crawlCategory(category);
      if (count > 0) {
        console.log(`[QuestionCrawler] ${label}: +${count} new questions`);
        totalNew += count;
      } else {
        console.log(`[QuestionCrawler] ${label}: no new questions`);
      }
    } catch (err) {
      console.warn(`[QuestionCrawler] ${label}: error`, err);
    }
    // Rate limit: OpenTDB allows ~1 request per 5 seconds
    await new Promise((r) => setTimeout(r, 5500));
  }

  if (totalNew > 0) {
    clearQuestionCache();
    console.log(`[QuestionCrawler] Question cache cleared — new questions will be used in next game.`);
  }
  console.log(`[QuestionCrawler] Done! ${totalNew} new questions added across all categories.`);
}
