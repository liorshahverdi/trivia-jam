import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Category, Question } from '@trivia-jam/shared';

export function getQuestionsPath(category: Category): string {
  return join(import.meta.dirname, '..', '..', 'shared', 'src', 'questions', `${category}.json`);
}

export function readExisting(category: Category): Question[] {
  try {
    const filePath = getQuestionsPath(category);
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
}

export function writeQuestions(category: Category, questions: Question[]): void {
  const filePath = getQuestionsPath(category);
  writeFileSync(filePath, JSON.stringify(questions, null, 2) + '\n');
}
