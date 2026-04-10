import type { Question } from '@trivia-jam/shared';

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;

  const wordsA = new Set(na.split(' '));
  const wordsB = new Set(nb.split(' '));
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}

export function deduplicate(
  newQuestions: Question[],
  existing: Question[],
  threshold = 0.75
): { unique: Question[]; duplicates: number } {
  const unique: Question[] = [];
  let duplicates = 0;

  for (const nq of newQuestions) {
    const isDupe = existing.some(eq => similarity(nq.question, eq.question) >= threshold)
      || unique.some(uq => similarity(nq.question, uq.question) >= threshold);

    if (isDupe) {
      duplicates++;
    } else {
      unique.push(nq);
    }
  }

  return { unique, duplicates };
}
