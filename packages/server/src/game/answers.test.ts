import { describe, expect, it } from 'vitest';
import type { Question, Room } from '@trivia-jam/shared';
import {
  allConnectedAnswered,
  isValidAnswerIndex,
  pickMajority,
  processCoopAnswers,
  processTeamAnswers,
  recordTeamAnswer,
  recordVote,
} from './answers';

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    code: 'TEST',
    hostId: 'host',
    hostConnected: true,
    players: [
      { id: 'a', name: 'A', avatar: '🦊', connected: true, score: 0, streak: 0, team: 'red' },
      { id: 'b', name: 'B', avatar: '🐸', connected: true, score: 0, streak: 0, team: 'blue' },
    ],
    phase: 'question',
    mode: 'teams',
    selectedCategories: ['math'],
    difficulty: 'mixed',
    seenQuestionIds: [],
    currentQuestion: null,
    questionIndex: 0,
    questionsPerGame: 10,
    answers: {},
    votes: {},
    coopScore: 0,
    teamScores: { red: 0, blue: 0 },
    countdownValue: 0,
    ...overrides,
  };
}

const question: Question = {
  id: 'q1',
  category: 'math',
  difficulty: 'medium',
  question: 'What is 2 + 2?',
  options: ['4', '3', '5', '22'],
  correctIndex: 0,
};

describe('teams answers', () => {
  it('resets the speed-bonus timestamp when a player switches answers', () => {
    const room = makeRoom();
    const start = 1_000_000;
    recordTeamAnswer(room, 'a', 2, start + 100); // placeholder tap
    recordTeamAnswer(room, 'a', 0, start + 18_000); // real answer, late
    expect(room.answers.a).toEqual({ playerId: 'a', answerIndex: 0, timestamp: start + 18_000 });

    const reveal = processTeamAnswers(room, question, start);
    const result = reveal.playerResults.find((r) => r.playerId === 'a')!;
    // 200 base + small time bonus (2s left of 20s => 5), not the near-max 50.
    expect(result.pointsEarned).toBe(205);
  });

  it('keeps the original timestamp when the same answer is re-sent', () => {
    const room = makeRoom();
    recordTeamAnswer(room, 'a', 0, 100);
    recordTeamAnswer(room, 'a', 0, 900);
    expect(room.answers.a.timestamp).toBe(100);
  });

  it('adds points to the correct team', () => {
    const room = makeRoom();
    recordTeamAnswer(room, 'a', 0, 0);
    recordTeamAnswer(room, 'b', 1, 0);
    processTeamAnswers(room, question, 0);
    expect(room.teamScores.red).toBeGreaterThan(0);
    expect(room.teamScores.blue).toBe(0);
  });
});

describe('co-op answers', () => {
  it('awards nothing when nobody votes, even if the answer is option A', () => {
    const room = makeRoom({ mode: 'coop' });
    const reveal = processCoopAnswers(room, question);
    expect(reveal.coopResult).toMatchObject({ majorityIndex: -1, correct: false, pointsEarned: 0 });
    expect(room.coopScore).toBe(0);
  });

  it('breaks ties randomly instead of always favouring the lowest option', () => {
    expect(pickMajority([1, 1, 0, 0], () => 0)).toBe(0);
    expect(pickMajority([1, 1, 0, 0], () => 0.99)).toBe(1);
    expect(pickMajority([0, 2, 0, 2], () => 0.99)).toBe(3);
    expect(pickMajority([0, 0, 0, 0])).toBe(-1);
  });

  it('scores the group when the majority is right', () => {
    const room = makeRoom({ mode: 'coop' });
    recordVote(room, 'a', 0);
    recordVote(room, 'b', 0);
    const reveal = processCoopAnswers(room, question);
    expect(reveal.coopResult?.correct).toBe(true);
    expect(room.coopScore).toBe(200);
  });
});

describe('answer helpers', () => {
  it('validates answer indexes', () => {
    expect([0, 1, 2, 3].every(isValidAnswerIndex)).toBe(true);
    expect([-1, 4, 1.5, '1', null, undefined].some(isValidAnswerIndex)).toBe(false);
  });

  it('only waits on connected players', () => {
    const room = makeRoom();
    recordTeamAnswer(room, 'a', 0, 0);
    expect(allConnectedAnswered(room)).toBe(false);
    room.players[1].connected = false;
    expect(allConnectedAnswered(room)).toBe(true);
  });
});
