import type { CoopResult, PlayerResult, Question, RevealData, Room } from '@trivia-jam/shared';
import { calculatePoints } from './ScoreCalculator.js';
import { addTeamScore } from './TeamManager.js';
import type { Random } from './QuestionPicker.js';

export function isValidAnswerIndex(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 3;
}

/**
 * Record a teams-mode answer. Changing to a different option resets the
 * timestamp, so a placeholder tap can't lock in the maximum speed bonus.
 */
export function recordTeamAnswer(room: Room, playerId: string, answerIndex: number, now: number): void {
  const existing = room.answers[playerId];
  if (existing?.answerIndex === answerIndex) return;
  room.answers[playerId] = { playerId, answerIndex, timestamp: now };
}

export function recordVote(room: Room, playerId: string, answerIndex: number): void {
  room.votes[playerId] = answerIndex;
}

export function tallyVotes(votes: Record<string, number>): number[] {
  const counts = [0, 0, 0, 0];
  for (const idx of Object.values(votes)) {
    if (isValidAnswerIndex(idx)) counts[idx]++;
  }
  return counts;
}

/** Group choice: the most-voted option, ties broken randomly, -1 when nobody voted. */
export function pickMajority(voteCounts: number[], random: Random = Math.random): number {
  const max = Math.max(...voteCounts);
  if (max <= 0) return -1;
  const leaders = voteCounts.flatMap((count, idx) => (count === max ? [idx] : []));
  return leaders[Math.floor(random() * leaders.length)];
}

/** Every connected player has submitted (vacuously true when nobody is connected). */
export function allConnectedAnswered(room: Room): boolean {
  const submitted = room.mode === 'coop' ? room.votes : room.answers;
  return room.players.filter((p) => p.connected).every((p) => p.id in submitted);
}

export function processCoopAnswers(room: Room, question: Question, random: Random = Math.random): RevealData {
  const voteCounts = tallyVotes(room.votes);
  const majorityIndex = pickMajority(voteCounts, random);
  const correct = majorityIndex !== -1 && majorityIndex === question.correctIndex;
  const pointsEarned = correct ? calculatePoints(question.difficulty, 'coop', true, 0, 0, 0) : 0;
  room.coopScore += pointsEarned;

  const coopResult: CoopResult = {
    majorityIndex,
    voteCounts,
    correct,
    pointsEarned,
    newCoopScore: room.coopScore,
  };

  const playerResults: PlayerResult[] = room.players
    .filter((p) => p.connected)
    .map((p) => {
      const playerVote = room.votes[p.id];
      const playerCorrect = playerVote === question.correctIndex;
      p.streak = playerCorrect ? p.streak + 1 : 0;
      const playerPoints = playerCorrect ? pointsEarned : 0;
      p.score += playerPoints;
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

export function processTeamAnswers(room: Room, question: Question, questionStartMs: number): RevealData {
  const playerResults: PlayerResult[] = [];

  for (const player of room.players) {
    if (!player.connected) continue;

    const answer = room.answers[player.id];
    const answerIndex = answer?.answerIndex ?? -1;
    const correct = answerIndex === question.correctIndex;
    player.streak = correct ? player.streak + 1 : 0;

    const points = calculatePoints(
      question.difficulty,
      'teams',
      correct,
      player.streak,
      answer?.timestamp ?? questionStartMs,
      questionStartMs,
    );

    player.score += points;
    if (player.team && points > 0) addTeamScore(room, player.team, points);

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
