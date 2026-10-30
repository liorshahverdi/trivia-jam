import type { Category, Difficulty } from '@trivia-jam/shared';
import { CATEGORY_MAP, fetchFromOpenTDB } from './src/sources/opentdb.js';
import { deduplicate } from './src/deduplicator.js';
import { validate } from './src/validator.js';
import { readExisting, writeQuestions } from './src/writer.js';

const CRAWLABLE_CATEGORIES = Object.keys(CATEGORY_MAP) as Category[];
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

/**
 * Usage:
 *   npm run crawl -- --all                         # top up every OpenTDB-backed category
 *   npm run crawl -- --category musicals --per-difficulty 20
 *   npm run crawl -- --all --target 100            # stop once a pack has 100 questions
 */
async function main() {
  const args = process.argv.slice(2);

  let categories: Category[] = CRAWLABLE_CATEGORIES;
  let perDifficulty = 30;
  let target = Infinity;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--category' && args[i + 1]) {
      categories = [args[++i] as Category];
    } else if ((args[i] === '--per-difficulty' || args[i] === '--count') && args[i + 1]) {
      perDifficulty = parseInt(args[++i], 10);
    } else if (args[i] === '--target' && args[i + 1]) {
      target = parseInt(args[++i], 10);
    } else if (args[i] === '--all') {
      categories = CRAWLABLE_CATEGORIES;
    }
  }

  for (const category of categories) {
    const existing = readExisting(category);
    console.log(`\n📦 Crawling: ${category} (existing: ${existing.length})`);
    if (existing.length >= target) {
      console.log(`  Already at target ${target}; skipping.`);
      continue;
    }

    let combined = existing;
    // Crawl per difficulty so packs stay balanced (OpenTDB skews easy/medium).
    for (const difficulty of DIFFICULTIES) {
      if (combined.length >= target) break;
      const have = combined.filter(q => q.difficulty === difficulty).length;
      const fetched = await fetchFromOpenTDB(category, perDifficulty, difficulty);
      const { valid, invalid } = validate(fetched);
      const { unique, duplicates } = deduplicate(valid, combined);
      const added = unique.slice(0, Math.max(0, target - combined.length));
      combined = [...combined, ...added];
      console.log(`  ${difficulty}: had ${have}, fetched ${fetched.length}, invalid ${invalid}, dupes ${duplicates}, added ${added.length}`);
    }

    if (combined.length > existing.length) {
      writeQuestions(category, combined);
      console.log(`  ✅ ${category}: ${existing.length} → ${combined.length}`);
    } else {
      console.log('  No new unique questions to add.');
    }
  }

  console.log('\n🎉 Done!');
}

main().catch(console.error);
