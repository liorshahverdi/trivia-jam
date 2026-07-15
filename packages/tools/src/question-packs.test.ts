import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const QUESTION_DIR = new URL('../../shared/src/questions/', import.meta.url);
const MIN_QUESTIONS_PER_CATEGORY = 20;
const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const CURRENT_EVENTS_UNSAFE_PATTERN = /\b(killed|murder|death|deadly|war|terror|terrorist|rape|suicide|shooting|genocide|porn|sex)\b/i;

interface QuestionRecord {
  id?: unknown;
  category?: unknown;
  difficulty?: unknown;
  question?: unknown;
  options?: unknown;
  correctIndex?: unknown;
}

function loadQuestionPack(fileName: string): QuestionRecord[] {
  return JSON.parse(readFileSync(join(QUESTION_DIR.pathname, fileName), 'utf-8'));
}

describe('committed question packs', () => {
  const files = readdirSync(QUESTION_DIR).filter((file) => file.endsWith('.json')).sort();

  it('has at least one question pack', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('keeps every category above the single-category play floor with valid question records', () => {
    const failures: string[] = [];

    for (const file of files) {
      const expectedCategory = file.replace(/\.json$/, '');
      const questions = loadQuestionPack(file);
      if (questions.length < MIN_QUESTIONS_PER_CATEGORY) {
        failures.push(`${expectedCategory}: expected at least ${MIN_QUESTIONS_PER_CATEGORY}, found ${questions.length}`);
      }

      const ids = new Set<string>();
      const texts = new Set<string>();
      questions.forEach((question, index) => {
        const label = `${expectedCategory}[${index}]`;
        if (typeof question.id !== 'string' || question.id.trim().length === 0) {
          failures.push(`${label}: missing id`);
        } else if (ids.has(question.id)) {
          failures.push(`${label}: duplicate id ${question.id}`);
        } else {
          ids.add(question.id);
        }

        if (question.category !== expectedCategory) {
          failures.push(`${label}: category ${String(question.category)} does not match ${expectedCategory}`);
        }

        if (typeof question.difficulty !== 'string' || !DIFFICULTIES.has(question.difficulty)) {
          failures.push(`${label}: invalid difficulty ${String(question.difficulty)}`);
        }

        if (typeof question.question !== 'string' || question.question.trim().length < 15) {
          failures.push(`${label}: question text is missing or too short`);
        } else {
          const normalizedText = question.question.trim().toLowerCase();
          if (texts.has(normalizedText)) failures.push(`${label}: duplicate question text`);
          texts.add(normalizedText);
        }

        if (!Array.isArray(question.options) || question.options.length !== 4) {
          failures.push(`${label}: expected exactly 4 options`);
        } else {
          const normalizedOptions = question.options.map((option) => String(option).trim().toLowerCase());
          if (normalizedOptions.some((option) => option.length === 0)) failures.push(`${label}: blank option`);
          if (new Set(normalizedOptions).size !== 4) failures.push(`${label}: duplicate options`);
        }

        const correctIndex = question.correctIndex;
        if (!Number.isInteger(correctIndex) || typeof correctIndex !== 'number' || correctIndex < 0 || correctIndex > 3) {
          failures.push(`${label}: invalid correctIndex ${String(question.correctIndex)}`);
        }

        if (expectedCategory === 'current-events') {
          const text = [question.question, ...(Array.isArray(question.options) ? question.options : [])].join(' ');
          if (CURRENT_EVENTS_UNSAFE_PATTERN.test(text)) {
            failures.push(`${label}: unsafe current-events subject`);
          }
        }
      });
    }

    expect(failures).toEqual([]);
  });
});
