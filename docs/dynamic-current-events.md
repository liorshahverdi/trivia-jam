# Dynamic Current Events Questions

Trivia Jam treats `current-events` differently from evergreen trivia categories.

## GitHub Pages behavior

GitHub Pages cannot run a Node crawler, database, local LLM, or secret-backed generation at request time. For a zero-cost static demo, the refresh happens on an always-on local machine and pushes an updated static question pack to GitHub.

Local refresh flow:

1. Pull latest `main`.
2. Fetch recent articles from free public RSS feeds.
3. Generate candidate questions with local Ollama.
4. Validate, dedupe, and expire generated questions deterministically.
5. Write accepted questions into `packages/shared/src/questions/current-events.json`.
6. Commit and push the changed JSON file.
7. The existing GitHub Pages deploy workflow rebuilds the static site from the push.

## Local always-on refresh

Run this on the always-on machine:

```bash
scripts/refresh-current-events-local.sh
```

The script checks that Ollama and the selected model are installed, pulls the latest repo state, refreshes questions, runs the tools tests, builds the static client, commits changed questions, and pushes to `main`.

Default local wrapper model:

```text
qwen2.5:0.5b
```

The always-on refresh machine uses this smaller default because `qwen2.5-coder:3b` can fail to load under normal memory pressure on the 8GB host. Override it with:

```bash
CURRENT_EVENTS_OLLAMA_MODEL=qwen2.5:7b scripts/refresh-current-events-local.sh
```

Useful optional environment variables:

- `TRIVIA_JAM_REPO_DIR`: repo path. Defaults to `/home/lior/projects/trivia-jam`.
- `TRIVIA_JAM_BRANCH`: branch to refresh/push. Defaults to `main`.
- `TRIVIA_JAM_REMOTE`: git remote. Defaults to `origin`.
- `CURRENT_EVENTS_OLLAMA_MODEL`: Ollama model for the local wrapper. Defaults to `qwen2.5:0.5b`.
- `CURRENT_EVENTS_ARTICLE_LIMIT`: max articles sent to Ollama per run. Defaults to `4`.
- `OLLAMA_HOST`: Ollama host URL. Defaults to `http://localhost:11434`.

## Static refresh command

The lower-level tool command is:

```bash
npm run refresh-current-events -w packages/tools
```

By default it uses:

- free RSS feeds for article input:
  - NPR News
  - BBC World
  - PBS NewsHour
  - NASA Breaking News
  - ScienceDaily Top News
  - Space.com
  - Smithsonian Smart News
  - The Verge
  - Ars Technica
  - Hacker News
- local Ollama for question generation
- no NewsAPI key
- no OpenAI key

## Optional server runtime behavior

If the full server is deployed with a database, `crawlAllQuestions()` can also refresh dynamic Current Events questions on startup and every 6 hours.

- Dynamic Current Events questions are sourced from current news articles, converted into multiple-choice questions with an LLM, validated, and cached in the `questions` table.
- The game picker excludes expired dynamic DB questions with `expires_at <= NOW()`.
- Static `packages/shared/src/questions/current-events.json` remains the GitHub Pages/static fallback and is refreshed by the local always-on worker.

## Freshness rules

- Generated candidates older than 45 days are rejected.
- Accepted questions expire 21 days after the article `publishedAt` date.
- Expired questions are pruned during refresh and excluded by the question picker.
- Legacy static Current Events fallback questions are removed once fresh generated questions exist, so multi-year-old “current events” do not stay in rotation.

## Validation rules

Generated Current Events questions are accepted only when they have:

- category exactly `current-events`
- `easy`, `medium`, or `hard` difficulty
- an id starting with `current-events-dynamic-`
- a real question string
- exactly four unique non-empty options
- a valid `correctIndex`
- a valid HTTP(S) `sourceUrl`
- a recent, non-future `publishedAt` timestamp

This keeps generated content out of live games unless it passes deterministic checks first.
