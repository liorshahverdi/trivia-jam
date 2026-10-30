/**
 * Server/tooling-only question pack loader. Exposed as `@trivia-jam/shared/questions`
 * (not re-exported from the package root) so the client bundle never pulls in `fs`.
 *
 * The JSON packs are copied next to the compiled loader at build time
 * (see scripts/copy-question-packs.mjs), so runtime never depends on `src/`.
 */
import type { Category, Question } from '../types.js';
import { isCategory } from '../constants.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const QUESTION_PACK_DIR = __dirname;
export const BLOCKLIST_PATH = join(__dirname, '..', 'question-blocklist.json');

export interface BlocklistEntry {
  id: string;
  reason?: string;
  addedAt?: string;
}

const packCache = new Map<Category, Question[]>();
let blocklistCache: Set<string> | null = null;

/** Load a committed question pack. Unknown categories return [] and never touch the filesystem. */
export function loadQuestionPack(category: Category): Question[] {
  if (!isCategory(category)) return [];
  const cached = packCache.get(category);
  if (cached) return cached;
  try {
    const data = JSON.parse(readFileSync(join(QUESTION_PACK_DIR, `${category}.json`), 'utf-8')) as Question[];
    packCache.set(category, data);
    return data;
  } catch (err) {
    console.error(`[questions] Failed to load pack ${category}:`, err);
    return [];
  }
}

/** Question ids that must never be served (bad facts, poor distractors, player reports). */
export function loadBlocklist(): Set<string> {
  if (blocklistCache) return blocklistCache;
  try {
    const entries = JSON.parse(readFileSync(BLOCKLIST_PATH, 'utf-8')) as BlocklistEntry[];
    blocklistCache = new Set(entries.map((entry) => entry.id));
  } catch {
    blocklistCache = new Set();
  }
  return blocklistCache;
}

export function clearQuestionPackCache(): void {
  packCache.clear();
  blocklistCache = null;
}
