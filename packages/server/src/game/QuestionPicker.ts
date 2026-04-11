import type { Category, Difficulty, Question } from '@trivia-jam/shared';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getPool } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve path to the shared package's question JSON files
const questionsDir = join(__dirname, '..', '..', '..', 'shared', 'src', 'questions');

const questionCache = new Map<Category, Question[]>();

/** Clear the question cache so fresh data is loaded on next game. */
export function clearQuestionCache(): void {
  questionCache.clear();
}

async function loadQuestions(category: Category): Promise<Question[]> {
  if (questionCache.has(category)) return questionCache.get(category)!;

  const pool = getPool();
  if (pool) {
    try {
      const { rows } = await pool.query(
        'SELECT id, category, difficulty, question, options, correct_index FROM questions WHERE category = $1',
        [category]
      );
      const questions: Question[] = rows.map(r => ({
        id: r.id,
        category: r.category as Category,
        difficulty: r.difficulty as Difficulty,
        question: r.question,
        options: r.options as [string, string, string, string],
        correctIndex: r.correct_index,
      }));
      questionCache.set(category, questions);
      return questions;
    } catch (err) {
      console.error(`[QuestionPicker] DB query failed for ${category}, falling back to file:`, err);
    }
  }

  // Fallback to JSON file
  try {
    const filePath = join(questionsDir, `${category}.json`);
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    questionCache.set(category, data);
    return data;
  } catch (err) {
    console.error(`Failed to load questions for ${category}:`, err);
    return [];
  }
}

export async function selectQuestions(
  categories: Category[],
  count: number,
  difficulties?: Difficulty[]
): Promise<Question[]> {
  const pool: Question[] = [];
  for (const cat of categories) {
    const qs = await loadQuestions(cat);
    if (difficulties) {
      pool.push(...qs.filter(q => difficulties.includes(q.difficulty)));
    } else {
      pool.push(...qs);
    }
  }
  // Shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
