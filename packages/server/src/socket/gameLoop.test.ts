import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question, Room } from '@trivia-jam/shared';
import { ServerEvents } from '@trivia-jam/shared';
import { defaultGameLoopDeps, isGameActive, notifyAnswersChanged, startGameLoop, stopGame, type GameLoopDeps, type RoomBroadcaster } from './gameLoop';
import { recordTeamAnswer, recordVote } from '../game/answers';

const questions: Question[] = [1, 2].map((n) => ({
  id: `q${n}`,
  category: 'math',
  difficulty: 'easy',
  question: `Question ${n}?`,
  options: ['a', 'b', 'c', 'd'],
  correctIndex: 1,
}));

function makeRoom(mode: Room['mode']): Room {
  return {
    code: `R${mode}`,
    hostId: 'host',
    hostConnected: true,
    players: [
      { id: 'p1', name: 'One', avatar: '🦊', connected: true, score: 0, streak: 0 },
      { id: 'p2', name: 'Two', avatar: '🐸', connected: true, score: 0, streak: 0 },
    ],
    phase: 'lobby',
    mode,
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
  };
}

function recorder() {
  const events: Array<{ event: string; args: unknown[] }> = [];
  const io = { to: () => ({ emit: (event: string, ...args: unknown[]) => events.push({ event, args }) }) } as unknown as RoomBroadcaster;
  return { io, events, names: () => events.map((e) => e.event) };
}

const deps = (pool: Question[] = questions): GameLoopDeps => ({
  ...defaultGameLoopDeps,
  now: () => Date.now(),
  random: () => 0.5,
  selectQuestions: vi.fn(() => pool),
});

describe('gameLoop', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reports to the caller instead of silently hanging when no questions are available', () => {
    const { io, events } = recorder();
    const result = startGameLoop(io, makeRoom('coop'), deps([]));
    expect(result).toEqual({ ok: false, message: expect.stringContaining('No questions') });
    expect(events).toEqual([]);
  });

  it('ends a question as soon as every connected player has answered', async () => {
    const { io, names } = recorder();
    const room = makeRoom('teams');
    const result = startGameLoop(io, room, deps());
    expect(result.ok).toBe(true);
    expect(room.seenQuestionIds).toEqual(['q1', 'q2']);
    expect(room.questionsPerGame).toBe(2);

    await vi.advanceTimersByTimeAsync(3000);
    expect(room.phase).toBe('question');
    recordTeamAnswer(room, 'p1', 1, Date.now());
    notifyAnswersChanged(room.code);
    expect(room.phase).toBe('question');
    recordTeamAnswer(room, 'p2', 0, Date.now());
    notifyAnswersChanged(room.code);
    await vi.advanceTimersByTimeAsync(0);
    expect(room.phase).toBe('reveal');
    expect(names()).toContain(ServerEvents.GAME_REVEAL);
    stopGame(room.code);
  });

  it('stops waiting on a player who disconnects mid-question', async () => {
    const { io } = recorder();
    const room = makeRoom('coop');
    startGameLoop(io, room, deps());
    await vi.advanceTimersByTimeAsync(3000);
    recordVote(room, 'p1', 1);
    room.players[1].connected = false;
    notifyAnswersChanged(room.code);
    await vi.advanceTimersByTimeAsync(0);
    expect(room.phase).toBe('reveal');
    stopGame(room.code);
  });

  it('emits nothing further once stopped', async () => {
    const { io, names } = recorder();
    const room = makeRoom('coop');
    const result = startGameLoop(io, room, deps());
    await vi.advanceTimersByTimeAsync(1000);
    stopGame(room.code);
    const before = names().length;
    await vi.runAllTimersAsync();
    if (result.ok) await result.done;
    expect(names().length).toBe(before);
    expect(names()).not.toContain(ServerEvents.GAME_OVER);
    expect(isGameActive(room.code)).toBe(false);
  });

  it('plays a full co-op game to game over', async () => {
    const { io, events } = recorder();
    const room = makeRoom('coop');
    const result = startGameLoop(io, room, deps());
    await vi.runAllTimersAsync();
    if (result.ok) await result.done;
    const over = events.find((e) => e.event === ServerEvents.GAME_OVER);
    expect(over?.args[0]).toMatchObject({ mode: 'coop', coopScore: 0, coopTarget: 400, coopWin: false });
    expect(room.phase).toBe('game_over');
  });

  it('only assigns teams to connected players', async () => {
    const { io } = recorder();
    const room = makeRoom('teams');
    room.players.push({ id: 'p3', name: 'Gone', avatar: '🦉', connected: false, score: 0, streak: 0 });
    startGameLoop(io, room, deps());
    expect(room.players.map((p) => p.team)).toEqual([expect.any(String), expect.any(String), undefined]);
    expect(new Set(room.players.slice(0, 2).map((p) => p.team)).size).toBe(2);
    stopGame(room.code);
  });
});
