import type pg from 'pg';

export async function runMigrations(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      question TEXT NOT NULL,
      options JSONB NOT NULL,
      correct_index INTEGER NOT NULL,
      question_key TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_questions_category ON questions (category)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_questions_category_difficulty ON questions (category, difficulty)
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_question_key ON questions (question_key)
  `);

  console.log('[DB] Migrations complete');
}
