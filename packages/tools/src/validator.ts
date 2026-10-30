import type { Question } from '@trivia-jam/shared';

export function validate(questions: Question[]): { valid: Question[]; invalid: number } {
  const valid: Question[] = [];
  let invalid = 0;

  for (const q of questions) {
    if (
      q.id &&
      q.category &&
      q.difficulty &&
      typeof q.question === 'string' &&
      q.question.trim().length >= 15 &&
      q.question.length < 500 &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      q.options.every((o: string) => typeof o === 'string' && o.trim().length > 0) &&
      new Set(q.options.map((o: string) => o.trim().toLowerCase())).size === 4 &&
      typeof q.correctIndex === 'number' &&
      q.correctIndex >= 0 &&
      q.correctIndex <= 3
    ) {
      valid.push(q);
    } else {
      invalid++;
    }
  }

  return { valid, invalid };
}
