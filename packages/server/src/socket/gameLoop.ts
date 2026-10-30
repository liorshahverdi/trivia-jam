import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  GameOverData,
  GamePhase,
  Question,
  RevealData,
  Room,
  ServerToClientEvents,
} from '@trivia-jam/shared';
import {
  ServerEvents,
  COUNTDOWN_SECONDS,
  QUESTION_TIME_SECONDS,
  REVEAL_TIME_SECONDS,
  LEADERBOARD_TIME_SECONDS,
} from '@trivia-jam/shared';
import { selectQuestions, type Random } from '../game/QuestionPicker.js';
import { calculateCoopTarget } from '../game/ScoreCalculator.js';
import { getPlayerLeaderboard, getTeamLeaderboard, assignTeams } from '../game/TeamManager.js';
import { allConnectedAnswered, processCoopAnswers, processTeamAnswers } from '../game/answers.js';
import { toClientQuestion, toRoomState } from './roomState.js';

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
/** Only the broadcast surface the loop needs, so tests can pass a recorder. */
export type RoomBroadcaster = Pick<TypedServer, 'to'>;

export interface GameLoopDeps {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  random: Random;
  selectQuestions: typeof selectQuestions;
}

export const defaultGameLoopDeps: GameLoopDeps = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random: Math.random,
  selectQuestions,
};

class GameStopped extends Error {}

const activeGames = new Set<string>();
/** Per-room callback that re-checks whether everyone has answered. */
const answerWaiters = new Map<string, () => void>();

export function isGameActive(roomCode: string): boolean {
  return activeGames.has(roomCode);
}

/** Wake the question timer early when answers/votes or connections change. */
export function notifyAnswersChanged(roomCode: string): void {
  answerWaiters.get(roomCode)?.();
}

/** Stop a running game; the loop exits at its next step without emitting more events. */
export function stopGame(roomCode: string): void {
  activeGames.delete(roomCode);
  answerWaiters.get(roomCode)?.();
}

function waitForAnswers(room: Room, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      answerWaiters.delete(room.code);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    // Re-evaluated on every answer/disconnect, so dropped players don't stall the round.
    const check = () => {
      if (!activeGames.has(room.code) || allConnectedAnswered(room)) finish();
    };
    answerWaiters.set(room.code, check);
    check();
  });
}

export type StartGameResult = { ok: true; done: Promise<void> } | { ok: false; message: string };

/**
 * Pick questions synchronously (so the caller can report problems to the host),
 * then run the countdown → question → reveal → leaderboard timeline in the background.
 */
export function startGameLoop(
  io: RoomBroadcaster,
  room: Room,
  deps: GameLoopDeps = defaultGameLoopDeps,
): StartGameResult {
  if (activeGames.has(room.code)) return { ok: false, message: 'Game is already running.' };

  const questions = deps.selectQuestions({
    categories: room.selectedCategories,
    count: room.questionsPerGame,
    difficulty: room.difficulty,
    excludeIds: new Set(room.seenQuestionIds),
    random: deps.random,
    now: deps.now(),
  });
  if (questions.length === 0) {
    const staleCurrentEvents = room.selectedCategories.includes('current-events')
      ? ' Current Events questions expire after a few weeks and none are fresh right now.'
      : '';
    return {
      ok: false,
      message: `No questions are available for the selected categories.${staleCurrentEvents} Try adding another category.`,
    };
  }

  activeGames.add(room.code);
  for (const q of questions) {
    if (!room.seenQuestionIds.includes(q.id)) room.seenQuestionIds.push(q.id);
  }

  const done = runGame(io, room, questions, deps)
    .catch((err) => {
      if (!(err instanceof GameStopped)) console.error(`[game ${room.code}] loop crashed:`, err);
    })
    .finally(() => {
      activeGames.delete(room.code);
      answerWaiters.delete(room.code);
    });

  return { ok: true, done };
}

async function runGame(io: RoomBroadcaster, room: Room, questions: Question[], deps: GameLoopDeps): Promise<void> {
  const emit = io.to(room.code);
  const ensureActive = () => {
    if (!activeGames.has(room.code)) throw new GameStopped();
  };
  const pause = async (ms: number) => {
    await deps.sleep(ms);
    ensureActive();
  };
  const setPhase = (phase: GamePhase) => {
    room.phase = phase;
    emit.emit(ServerEvents.GAME_PHASE, phase);
  };

  room.questionsPerGame = questions.length;
  if (room.mode === 'teams') assignTeams(room, deps.random);
  emit.emit(ServerEvents.ROOM_STATE, toRoomState(room));

  for (let qi = 0; qi < questions.length; qi++) {
    room.questionIndex = qi;
    room.answers = {};
    room.votes = {};

    setPhase('countdown');
    for (let c = COUNTDOWN_SECONDS; c > 0; c--) {
      room.countdownValue = c;
      emit.emit(ServerEvents.GAME_COUNTDOWN, c);
      await pause(1000);
    }

    const question = questions[qi];
    room.currentQuestion = question;
    setPhase('question');
    emit.emit(ServerEvents.GAME_QUESTION, {
      question: toClientQuestion(question),
      index: qi,
      total: questions.length,
      timeSeconds: QUESTION_TIME_SECONDS,
    });
    const questionStartMs = deps.now();

    await waitForAnswers(room, QUESTION_TIME_SECONDS * 1000);
    ensureActive();

    setPhase('reveal');
    const reveal: RevealData = room.mode === 'coop'
      ? processCoopAnswers(room, question, deps.random)
      : processTeamAnswers(room, question, questionStartMs);
    emit.emit(ServerEvents.GAME_REVEAL, reveal);
    await pause(REVEAL_TIME_SECONDS * 1000);

    if (qi < questions.length - 1) {
      setPhase('leaderboard');
      emit.emit(ServerEvents.GAME_LEADERBOARD, {
        players: getPlayerLeaderboard(room),
        teamScores: room.mode === 'teams' ? getTeamLeaderboard(room) : undefined,
        coopScore: room.mode === 'coop' ? room.coopScore : undefined,
      });
      await pause(LEADERBOARD_TIME_SECONDS * 1000);
    }
  }

  setPhase('game_over');
  const coopTarget = calculateCoopTarget(room.questionsPerGame);
  const gameOverData: GameOverData = {
    mode: room.mode,
    players: getPlayerLeaderboard(room),
    teamScores: room.mode === 'teams' ? getTeamLeaderboard(room) : undefined,
    coopScore: room.mode === 'coop' ? room.coopScore : undefined,
    coopTarget: room.mode === 'coop' ? coopTarget : undefined,
    coopWin: room.mode === 'coop' ? room.coopScore >= coopTarget : undefined,
  };
  emit.emit(ServerEvents.GAME_OVER, gameOverData);
}
