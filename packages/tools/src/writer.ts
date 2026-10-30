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

export function getBlocklistPath(): string {
  return join(import.meta.dirname, '..', '..', 'shared', 'src', 'question-blocklist.json');
}

/** Ids of questions that must not be served or retained (see question-blocklist.json). */
export function readBlocklist(): Set<string> {
  try {
    const entries = JSON.parse(readFileSync(getBlocklistPath(), 'utf-8')) as Array<{ id: string }>;
    return new Set(entries.map((entry) => entry.id));
  } catch {
    return new Set();
  }
}
