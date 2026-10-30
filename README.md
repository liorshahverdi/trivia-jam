# Trivia Jam

Jackbox-style party trivia. A host screen (TV or laptop) shows the questions, and players join from their phones with a 4-letter room code. Play co-op, where the group votes, or Red vs Blue teams, where speed and streak bonuses count.

## Layout

| Package | What it is |
| --- | --- |
| `packages/shared` | Types, constants, typed Socket.IO event maps, and the committed question packs (`src/questions/*.json`) plus `question-blocklist.json` |
| `packages/server` | Express + Socket.IO game server with all room state in memory (`socket/handler.ts` → `roomManager.ts` / `gameLoop.ts`, `game/*` for picking and scoring) |
| `packages/client` | React 19 + Zustand + Tailwind client (host and player screens) |
| `packages/tools` | Question tooling: OpenTDB crawler and the Current Events refresh job |

## Develop

```bash
npm ci
npm run build -w packages/shared   # server/client consume shared's dist
npm run dev                        # server :3001 + client :5173
npm test                           # server, client and tools test suites
npm run typecheck
```

## Questions

- Evergreen packs are topped up from OpenTDB, balanced per difficulty and deduplicated:
  `npm run crawl -- --all --per-difficulty 30 --target 120`
- Current Events are generated from news RSS feeds by a scheduled local job. See [docs/dynamic-current-events.md](docs/dynamic-current-events.md).
- Answer options are shuffled every time a question is served. Expired, blocklisted and player-reported questions are skipped. A room avoids repeating questions across "play again" until a pack runs dry.
- To remove a bad question, add its id to `packages/shared/src/question-blocklist.json`. Player reports are listed at `GET /flags` on the server.

## Deploy

- **Client**: GitHub Pages, via `.github/workflows/deploy.yml`, after the CI test job passes.
- **Server**: Render free plan (`render.yaml`, `autoDeployTrigger: checksPass`). The free instance sleeps, so the client shows a "waking up the server" notice on first load.
- Hosts and players can refresh or briefly drop off without losing their seat. Reconnecting uses a private token stored in `localStorage`, and the room survives the host being away for up to 60 seconds.
