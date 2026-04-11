import { httpServer, io } from './app.js';
import { setupSocketHandlers } from './socket/handler.js';
import { crawlAllQuestions } from './game/QuestionCrawler.js';
import { getPool } from './db.js';
import { runMigrations } from './db-migrate.js';
import { seedFromFiles } from './db-seed.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

setupSocketHandlers(io);

async function initDb(): Promise<void> {
  const pool = getPool();
  if (!pool) {
    console.log('[DB] No DATABASE_URL set, using JSON file fallback');
    return;
  }
  await runMigrations(pool);
  await seedFromFiles(pool);
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 TriviaJam server running on http://0.0.0.0:${PORT}`);

  // Init DB then crawl for fresh questions
  initDb()
    .then(() => crawlAllQuestions())
    .catch((err) => console.error('[Startup] Init failed:', err));

  // Recurring crawl every 6 hours
  setInterval(() => {
    crawlAllQuestions().catch((err) =>
      console.error('[QuestionCrawler] Scheduled crawl failed:', err)
    );
  }, 6 * 60 * 60 * 1000);
});
