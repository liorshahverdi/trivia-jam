import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import type { Question } from '@trivia-jam/shared';
import { fetchQuestions } from './QuestionCrawler';

function loadCurrentEvents(): Question[] {
  const path = join(process.cwd(), '..', 'shared', 'src', 'questions', 'current-events.json');
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('current events question sourcing', () => {
  it('does not ship generic society-and-culture trivia in the current-events pack', () => {
    expect(loadCurrentEvents().every((q) => !q.id.includes('trivia'))).toBe(true);
  });

  it('does not source current-events from The Trivia API society_and_culture category', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(fetchQuestions('current-events', 10)).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
