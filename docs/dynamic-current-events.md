# Dynamic Current Events Questions

Trivia Jam treats `current-events` differently from evergreen trivia categories.

## GitHub Pages behavior

GitHub Pages cannot run the Node crawler, database, or secret-backed question generation at request time. To keep the static demo fresh, the repository includes `.github/workflows/refresh-current-events.yml`.

That workflow:

- runs daily and on manual dispatch
- fetches current news headlines
- asks OpenAI to generate candidate multiple-choice questions
- validates the generated questions deterministically
- writes accepted questions into `packages/shared/src/questions/current-events.json`
- commits the refreshed JSON file
- deploys a refreshed GitHub Pages build from the same workflow when the JSON changes

## Optional server runtime behavior

If the full server is deployed with a database, `crawlAllQuestions()` can also refresh dynamic Current Events questions on startup and every 6 hours.

- Dynamic Current Events questions are sourced from current news articles, converted into multiple-choice questions with an LLM, validated, and cached in the `questions` table.
- The game picker excludes expired dynamic DB questions with `expires_at <= NOW()`.
- Static `packages/shared/src/questions/current-events.json` remains the GitHub Pages/static fallback and is refreshed by GitHub Actions.

## Required secrets / environment variables

For the GitHub Actions static refresh, configure these repository secrets:

- `NEWS_API_KEY`: fetches current headlines from NewsAPI.
- `OPENAI_API_KEY`: generates multiple-choice questions from selected headlines.

For optional server-side DB refresh, also configure:

- `DATABASE_URL`: enables database-backed question storage.

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
