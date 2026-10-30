import type { Question, QuestionForClient, Room, RoomState } from '@trivia-jam/shared';

/** Strip everything the client must not see (correctIndex, source metadata). */
export function toClientQuestion(question: Question): QuestionForClient {
  const { id, category, difficulty, question: text, options } = question;
  return { id, category, difficulty, question: text, options: [...options] as Question['options'] };
}

/** The single, public projection of a room. Never includes tokens, answers, or votes. */
export function toRoomState(room: Room): RoomState {
  return {
    code: room.code,
    players: room.players.map((p) => ({ ...p })),
    phase: room.phase,
    mode: room.mode,
    selectedCategories: [...room.selectedCategories],
    difficulty: room.difficulty,
    hostConnected: room.hostConnected,
    currentQuestion: room.currentQuestion ? toClientQuestion(room.currentQuestion) : null,
    questionIndex: room.questionIndex,
    questionsPerGame: room.questionsPerGame,
    coopScore: room.coopScore,
    teamScores: { ...room.teamScores },
    countdownValue: room.countdownValue,
  };
}
