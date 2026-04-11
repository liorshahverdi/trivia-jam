import type pg from 'pg';
import type { Question } from '@trivia-jam/shared';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const questionsDir = join(__dirname, '..', '..', 'shared', 'src', 'questions');

export async function seedFromFiles(pool: pg.Pool): Promise<void> {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM questions');
  if (rows[0].count > 0) {
    console.log(`[DB] Already seeded (${rows[0].count} questions)`);
    return;
  }

  let total = 0;
  const files = readdirSync(questionsDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const questions: Question[] = JSON.parse(readFileSync(join(questionsDir, file), 'utf-8'));
    if (questions.length === 0) continue;

    for (const q of questions) {
      await pool.query(
        `INSERT INTO questions (id, category, difficulty, question, options, correct_index, question_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (question_key) DO NOTHING`,
        [q.id, q.category, q.difficulty, q.question, JSON.stringify(q.options), q.correctIndex, q.question.toLowerCase().trim()]
      );
    }
    total += questions.length;
  }

  console.log(`[DB] Seeded ${total} questions from JSON files`);
}
