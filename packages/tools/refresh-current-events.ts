import { refreshCurrentEventsJson } from './src/current-events-static.js';

async function main(): Promise<void> {
  const result = await refreshCurrentEventsJson();
  console.log(`Current Events refresh complete: +${result.added}, kept ${result.kept}, removed expired ${result.removedExpired}, total ${result.total}`);
}

main().catch((err) => {
  console.error('[refresh-current-events] Failed:', err);
  process.exit(1);
});
