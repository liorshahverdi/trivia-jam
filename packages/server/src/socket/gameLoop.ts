import type { Server } from 'socket.io';
import type {
  Room,
  Question,
  QuestionForClient,
  PlayerResult,
  CoopResult,
  RevealData,
  GameOverData,
} from '@trivia-jam/shared';
import {
  ServerEvents,
  COUNTDOWN_SECONDS,
  QUESTION_TIME_SECONDS,
  REVEAL_TIME_SECONDS,
  LEADERBOARD_TIME_SECONDS,
} from '@trivia-jam/shared';
import { selectQuestions } from '../game/QuestionPicker.js';
import { calculatePoints, calculateCoopTarget } from '../game/ScoreCalculator.js';
import { getPlayerLeaderboard, getTeamLeaderboard, addTeamScore } from '../game/TeamManager.js';
import { assignTeams } from './roomManager.js';

const activeGames = new Set<string>();

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stripCorrectIndex(q: Question): QuestionForClient {
  const { correctIndex, ...rest } = q;
  return rest;
}

function emitPhase(io: Server, room: Room): void {
  io.to(room.code).emit(ServerEvents.GAME_PHASE, room.phase);
}

export async function startGameLoop(io: Server, room: Room): Promise<void> {
  if (activeGames.has(room.code)) return;
  activeGames.add(room.code);

  try {
    // Pick questions
    const categories = room.selectedCategories.length > 0
      ? room.selectedCategories
      : ['math', 'science', 'history', 'current-events', 'music', 'food', 'tech', 'geography', 'art', 'entertainment', 'animals', 'general', 'musicals', 'television', 'video-games', 'board-games', 'mythology', 'gadgets', 'anime', 'cartoons'] as any;

    const questions = await selectQuestions(categories, room.questionsPerGame);
    if (questions.length === 0) {
      activeGames.delete(room.code);
      return;
    }

    // Assign teams if in teams mode
    if (room.mode === 'teams') {
      assignTeams(room);
      io.to(room.code).emit(ServerEvents.ROOM_STATE, buildRoomState(room));
    }

    room.questionIndex = 0;

    for (let qi = 0; qi < questions.length; qi++) {
      if (!activeGames.has(room.code)) break;

      room.questionIndex = qi;
      room.answers = {};
      room.votes = {};

      // Countdown
      room.phase = 'countdown';
      emitPhase(io, room);
      for (let c = COUNTDOWN_SECONDS; c > 0; c--) {
        room.countdownValue = c;
        io.to(room.code).emit(ServerEvents.GAME_COUNTDOWN, c);
        await sleep(1000);
      }

      // Question phase
      const question = questions[qi];
      room.currentQuestion = question;
      room.phase = 'question';
      emitPhase(io, room);
      io.to(room.code).emit(ServerEvents.GAME_QUESTION, {
        question: stripCorrectIndex(question),
        index: qi,
        total: questions.length,
        timeSeconds: QUESTION_TIME_SECONDS,
      });

      const questionStartMs = Date.now();

      // Wait for answers or timeout
      await waitForAnswers(io, room, QUESTION_TIME_SECONDS * 1000);

      // Reveal phase
      room.phase = 'reveal';
      emitPhase(io, room);

      const revealData = processAnswers(room, question, questionStartMs);
      io.to(room.code).emit(ServerEvents.GAME_REVEAL, revealData);
      await sleep(REVEAL_TIME_SECONDS * 1000);

      // Leaderboard phase (skip on last question)
      if (qi < questions.length - 1) {
        room.phase = 'leaderboard';
        emitPhase(io, room);
        io.to(room.code).emit(ServerEvents.GAME_LEADERBOARD, {
          players: getPlayerLeaderboard(room),
          teamScores: room.mode === 'teams' ? getTeamLeaderboard(room) : undefined,
          coopScore: room.mode === 'coop' ? room.coopScore : undefined,
        });
        await sleep(LEADERBOARD_TIME_SECONDS * 1000);
      }
    }

    // Game over
    room.phase = 'game_over';
    emitPhase(io, room);

    const coopTarget = calculateCoopTarget(room.questionsPerGame);
    const gameOverData: GameOverData = {
      mode: room.mode,
      players: getPlayerLeaderboard(room),
      teamScores: room.mode === 'teams' ? getTeamLeaderboard(room) : undefined,
      coopScore: room.mode === 'coop' ? room.coopScore : undefined,
      coopTarget: room.mode === 'coop' ? coopTarget : undefined,
      coopWin: room.mode === 'coop' ? room.coopScore >= coopTarget : undefined,
    };
    io.to(room.code).emit(ServerEvents.GAME_OVER, gameOverData);
  } finally {
    activeGames.delete(room.code);
  }
}

function waitForAnswers(io: Server, room: Room, timeoutMs: number): Promise<void> {
  return new Promise(resolve => {
    const connectedCount = room.players.filter(p => p.connected).length;
    const checkDone = () => {
      const answerCount = room.mode === 'coop'
        ? Object.keys(room.votes).length
        : Object.keys(room.answers).length;
      if (answerCount >= connectedCount) {
        clearTimeout(timer);
        resolve();
      }
    };

    // Set up a listener on the room for answer events
    const interval = setInterval(checkDone, 250);
    const timer = setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, timeoutMs);

    // Also check immediately in case everyone already answered
    checkDone();
    // Clean up interval when done
    const origResolve = resolve;
    resolve = () => {
      clearInterval(interval);
      origResolve();
    };
  });
}

function processAnswers(room: Room, question: Question, questionStartMs: number): RevealData {
  if (room.mode === 'coop') {
    return processCoopAnswers(room, question);
  } else {
    return processTeamAnswers(room, question, questionStartMs);
  }
}

function processCoopAnswers(room: Room, question: Question): RevealData {
  // Tally votes
  const voteCounts = [0, 0, 0, 0];
  for (const answerIndex of Object.values(room.votes)) {
    if (answerIndex >= 0 && answerIndex <= 3) {
      voteCounts[answerIndex]++;
    }
  }

  // Majority vote
  let majorityIndex = 0;
  let maxVotes = 0;
  voteCounts.forEach((count, idx) => {
    if (count > maxVotes) {
      maxVotes = count;
      majorityIndex = idx;
    }
  });

  const correct = majorityIndex === question.correctIndex;
  const pointsEarned = correct
    ? calculatePoints(question.difficulty, 'coop', true, 0, 0, 0)
    : 0;

  room.coopScore += pointsEarned;

  const coopResult: CoopResult = {
    majorityIndex,
    voteCounts,
    correct,
    pointsEarned,
    newCoopScore: room.coopScore,
  };

  const playerResults: PlayerResult[] = room.players
    .filter(p => p.connected)
    .map(p => {
      const playerVote = room.votes[p.id];
      const playerCorrect = playerVote === question.correctIndex;
      if (playerCorrect) {
        p.streak++;
      } else {
        p.streak = 0;
      }
      const playerPoints = playerCorrect ? pointsEarned : 0;
      p.score += playerPoints;
      console.log(`[COOP SCORE] ${p.name}: vote=${playerVote} correct=${playerCorrect} +${playerPoints} total=${p.score}`);
      return {
        playerId: p.id,
        name: p.name,
        answerIndex: playerVote ?? -1,
        correct: playerCorrect,
        pointsEarned: playerPoints,
        streak: p.streak,
        newScore: p.score,
      };
    });

  return { correctIndex: question.correctIndex, playerResults, coopResult };
}

function processTeamAnswers(room: Room, question: Question, questionStartMs: number): RevealData {
  const playerResults: PlayerResult[] = [];

  for (const player of room.players) {
    if (!player.connected) continue;

    const answer = room.answers[player.id];
    const answerIndex = answer?.answerIndex ?? -1;
    const correct = answerIndex === question.correctIndex;

    if (correct) {
      player.streak++;
    } else {
      player.streak = 0;
    }

    const points = calculatePoints(
      question.difficulty,
      'teams',
      correct,
      player.streak,
      answer?.timestamp ?? Date.now(),
      questionStartMs
    );

    player.score += points;
    if (player.team && points > 0) {
      addTeamScore(room, player.team, points);
    }

    playerResults.push({
      playerId: player.id,
      name: player.name,
      answerIndex,
      correct,
      pointsEarned: points,
      streak: player.streak,
      newScore: player.score,
      team: player.team,
    });
  }

  return { correctIndex: question.correctIndex, playerResults };
}

export function stopGame(roomCode: string): void {
  activeGames.delete(roomCode);
}

function buildRoomState(room: Room) {
  return {
    code: room.code,
    players: room.players,
    phase: room.phase,
    mode: room.mode,
    selectedCategories: room.selectedCategories,
    currentQuestion: null,
    questionIndex: room.questionIndex,
    questionsPerGame: room.questionsPerGame,
    votes: {},
    coopScore: room.coopScore,
    teamScores: room.teamScores,
    countdownValue: 0,
  };
}
