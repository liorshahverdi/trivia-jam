export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameMode = 'coop' | 'teams';
export type TeamColor = 'red' | 'blue';

export type GamePhase =
  | 'lobby'
  | 'category_select'
  | 'countdown'
  | 'question'
  | 'reveal'
  | 'leaderboard'
  | 'game_over';

export type Category = 'math' | 'science' | 'history' | 'current-events' | 'music' | 'food' | 'tech';

export interface Question {
  id: string;
  category: Category;
  difficulty: Difficulty;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
}

export interface QuestionForClient extends Omit<Question, 'correctIndex'> {}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  connected: boolean;
  team?: TeamColor;
  score: number;
  streak: number;
}

export interface Room {
  code: string;
  hostId: string;
  players: Player[];
  phase: GamePhase;
  mode: GameMode;
  selectedCategories: Category[];
  currentQuestion: Question | null;
  questionIndex: number;
  questionsPerGame: number;
  answers: Record<string, PlayerAnswer>;
  votes: Record<string, number>;
  coopScore: number;
  teamScores: Record<TeamColor, number>;
  countdownValue: number;
}

export interface PlayerAnswer {
  playerId: string;
  answerIndex: number;
  timestamp: number;
}

export interface RevealData {
  correctIndex: number;
  playerResults: PlayerResult[];
  coopResult?: CoopResult;
}

export interface PlayerResult {
  playerId: string;
  name: string;
  answerIndex: number;
  correct: boolean;
  pointsEarned: number;
  streak: number;
  newScore: number;
  team?: TeamColor;
}

export interface CoopResult {
  majorityIndex: number;
  voteCounts: number[];
  correct: boolean;
  pointsEarned: number;
  newCoopScore: number;
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  avatar: string;
  score: number;
  streak: number;
  team?: TeamColor;
}

export interface TeamLeaderboard {
  red: number;
  blue: number;
}

export interface GameOverData {
  mode: GameMode;
  players: LeaderboardEntry[];
  teamScores?: TeamLeaderboard;
  coopScore?: number;
  coopTarget?: number;
  coopWin?: boolean;
}

export interface RoomState {
  code: string;
  players: Player[];
  phase: GamePhase;
  mode: GameMode;
  selectedCategories: Category[];
  currentQuestion: QuestionForClient | null;
  questionIndex: number;
  questionsPerGame: number;
  votes: Record<string, number>;
  coopScore: number;
  teamScores: Record<TeamColor, number>;
  countdownValue: number;
  myAnswer?: number;
}
