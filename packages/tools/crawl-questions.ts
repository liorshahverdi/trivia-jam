import type { Category } from '@trivia-jam/shared';
import { fetchFromOpenTDB } from './src/sources/opentdb.js';
import { deduplicate } from './src/deduplicator.js';
import { validate } from './src/validator.js';
import { readExisting, writeQuestions } from './src/writer.js';

const ALL_CATEGORIES: Category[] = ['math', 'science', 'history', 'current-events', 'music', 'food'];

async function main() {
  const args = process.argv.slice(2);

  let categories: Category[] = ALL_CATEGORIES;
  let count = 50;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--category' && args[i + 1]) {
      categories = [args[++i] as Category];
    } else if (args[i] === '--count' && args[i + 1]) {
      count = parseInt(args[++i], 10);
    } else if (args[i] === '--all') {
      categories = ALL_CATEGORIES;
    }
  }

  for (const category of categories) {
    console.log(`\n📦 Crawling: ${category} (target: ${count})`);

    const existing = readExisting(category);
    console.log(`  Existing questions: ${existing.length}`);

    // Fetch from OpenTDB
    console.log('  Fetching from OpenTDB...');
    const fetched = await fetchFromOpenTDB(category, count);
    console.log(`  Fetched: ${fetched.length}`);

    if (fetched.length === 0) {
      console.log(`  ⚠️  No questions fetched for ${category} (may not be available on OpenTDB)`);
      continue;
    }

    // Validate
    const { valid, invalid } = validate(fetched);
    if (invalid > 0) console.log(`  Invalid: ${invalid}`);

    // Deduplicate
    const { unique, duplicates } = deduplicate(valid, existing);
    if (duplicates > 0) console.log(`  Duplicates: ${duplicates}`);

    if (unique.length === 0) {
      console.log('  No new unique questions to add.');
      continue;
    }

    // Write
    const combined = [...existing, ...unique];
    writeQuestions(category, combined);
    console.log(`  ✅ Added ${unique.length} questions (total: ${combined.length})`);

    // Rate limit between categories
    if (categories.length > 1) {
      await new Promise(r => setTimeout(r, 5500));
    }
  }

  console.log('\n🎉 Done!');
}

main().catch(console.error);
