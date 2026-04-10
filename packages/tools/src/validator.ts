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
      q.question.length > 5 &&
      q.question.length < 500 &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      q.options.every((o: string) => typeof o === 'string' && o.length > 0) &&
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
