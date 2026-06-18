#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${TRIVIA_JAM_REPO_DIR:-/home/lior/projects/trivia-jam}"
BRANCH="${TRIVIA_JAM_BRANCH:-main}"
REMOTE="${TRIVIA_JAM_REMOTE:-origin}"

cd "$REPO_DIR"

if ! command -v ollama >/dev/null 2>&1; then
  echo "ollama is not installed or not on PATH" >&2
  exit 1
fi

MODEL="${CURRENT_EVENTS_OLLAMA_MODEL:-qwen2.5-coder:3b}"
if ! ollama list | awk 'NR > 1 {print $1}' | grep -Fxq "$MODEL"; then
  echo "Ollama model $MODEL is not installed. Run: ollama pull $MODEL" >&2
  exit 1
fi

# Keep this worker on the latest deployed source before refreshing static data.
git fetch "$REMOTE" "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only "$REMOTE" "$BRANCH"

npm ci
npm run refresh-current-events -w packages/tools
npm test -w packages/tools
npm run build -w packages/shared
npm run build -w packages/client

if git diff --quiet -- packages/shared/src/questions/current-events.json; then
  echo "No Current Events question changes to commit."
  exit 0
fi

git add packages/shared/src/questions/current-events.json
git commit -m "chore: refresh current events questions"
git push "$REMOTE" "$BRANCH"
