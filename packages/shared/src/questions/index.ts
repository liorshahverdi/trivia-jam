import type { Category, Difficulty, Question } from '../types.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const questionCache = new Map<Category, Question[]>();

export function loadQuestions(category: Category): Question[] {
  if (questionCache.has(category)) return questionCache.get(category)!;
  try {
    const filePath = join(__dirname, `${category}.json`);
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    questionCache.set(category, data);
    return data;
  } catch {
    return [];
  }
}

export function pickQuestions(
  categories: Category[],
  count: number,
  difficulties?: Difficulty[]
): Question[] {
  const pool: Question[] = [];
  for (const cat of categories) {
    const qs = loadQuestions(cat);
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
