import type pg from 'pg';
import type { Question } from '@trivia-jam/shared';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const questionsDir = join(__dirname, '..', '..', 'shared', 'src', 'questions');

// Bump this version to force a full re-seed (truncate + re-insert).
const SEED_VERSION = 2;

export async function seedFromFiles(pool: pg.Pool): Promise<void> {
  // Track seed version so we can force a re-seed after data fixes
  await pool.query(`
    CREATE TABLE IF NOT EXISTS seed_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  const { rows: metaRows } = await pool.query(
    `SELECT value FROM seed_meta WHERE key = 'seed_version'`
  );
  const currentVersion = metaRows.length > 0 ? parseInt(metaRows[0].value, 10) : 0;

  if (currentVersion >= SEED_VERSION) {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM questions');
    console.log(`[DB] Already seeded v${SEED_VERSION} (${rows[0].count} questions)`);
    return;
  }

  // Wipe old data and re-seed from clean JSON files
  console.log(`[DB] Re-seeding: v${currentVersion} -> v${SEED_VERSION}`);
  await pool.query('TRUNCATE TABLE questions');

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

  // Record the seed version
  await pool.query(
    `INSERT INTO seed_meta (key, value) VALUES ('seed_version', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1`,
    [String(SEED_VERSION)]
  );

  console.log(`[DB] Seeded ${total} questions from JSON files (v${SEED_VERSION})`);
}
