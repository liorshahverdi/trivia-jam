# Dynamic Current Events Questions

Trivia Jam treats `current-events` differently from evergreen trivia categories.

## Runtime behavior

- On startup and every 6 hours, `crawlAllQuestions()` refreshes dynamic Current Events questions when a database is configured.
- Dynamic Current Events questions are sourced from current news articles, converted into multiple-choice questions with an LLM, validated, and cached in the `questions` table.
- The game picker excludes expired dynamic questions with `expires_at <= NOW()`.
- Static `packages/shared/src/questions/current-events.json` remains the fallback when no database or API keys are configured.

## Required environment variables

- `DATABASE_URL`: enables database-backed question storage.
- `NEWS_API_KEY`: enables fetching current headlines from NewsAPI.
- `OPENAI_API_KEY`: enables LLM generation of multiple-choice questions.

## Optional environment variables

- `CURRENT_EVENTS_NEWS_COUNTRY`: NewsAPI top-headlines country. Defaults to `us`.
- `CURRENT_EVENTS_NEWS_PAGE_SIZE`: NewsAPI page size. Defaults to `30`.
- `CURRENT_EVENTS_NEWS_CATEGORY`: optional NewsAPI category filter.
- `CURRENT_EVENTS_OPENAI_MODEL`: model for question generation. Falls back to `OPENAI_MODEL`, then `gpt-4o-mini`.

## Freshness rules

- Generated candidates older than 45 days are rejected.
- Accepted questions expire 21 days after the article `publishedAt` date.
- Expired questions are pruned during refresh and excluded by the question picker.

## Validation rules

Generated Current Events questions are accepted only when they have:

- category exactly `current-events`
- `easy`, `medium`, or `hard` difficulty
- a real question string
- exactly four unique non-empty options
- a valid `correctIndex`
- a valid HTTP(S) `sourceUrl`
- a recent, non-future `publishedAt` timestamp

This keeps generated content out of live games unless it passes deterministic checks first.
