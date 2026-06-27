import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPool: vi.fn(() => ({ query: vi.fn() })),
  runMigrations: vi.fn(),
  seedFromFiles: vi.fn(),
  crawlAllQuestions: vi.fn(),
}));

vi.mock('./db.js', () => ({ getPool: mocks.getPool }));
vi.mock('./db-migrate.js', () => ({ runMigrations: mocks.runMigrations }));
vi.mock('./db-seed.js', () => ({ seedFromFiles: mocks.seedFromFiles }));
vi.mock('./game/QuestionCrawler.js', () => ({ crawlAllQuestions: mocks.crawlAllQuestions }));

const { startQuestionServices } = await import('./startup');

describe('server startup question services', () => {
  it('does not initialize database, seed database, or crawl questions because runtime is JSON-file managed', async () => {
    await startQuestionServices();

    expect(mocks.getPool).not.toHaveBeenCalled();
    expect(mocks.runMigrations).not.toHaveBeenCalled();
    expect(mocks.seedFromFiles).not.toHaveBeenCalled();
    expect(mocks.crawlAllQuestions).not.toHaveBeenCalled();
  });
});
