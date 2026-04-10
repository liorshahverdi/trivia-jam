import { httpServer, io } from './app.js';
import { setupSocketHandlers } from './socket/handler.js';
import { crawlAllQuestions } from './game/QuestionCrawler.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

setupSocketHandlers(io);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 TriviaJam server running on http://0.0.0.0:${PORT}`);

  // Crawl for fresh questions in the background on startup
  crawlAllQuestions().catch((err) =>
    console.error('[QuestionCrawler] Startup crawl failed:', err)
  );
});
