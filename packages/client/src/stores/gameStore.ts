import { create } from 'zustand';
import type {
  Player,
  GamePhase,
  GameMode,
  Category,
  QuestionForClient,
  RevealData,
  LeaderboardEntry,
  TeamLeaderboard,
  GameOverData,
  TeamColor,
} from '@trivia-jam/shared';

export type Role = 'none' | 'host' | 'player';

interface GameState {
  // Connection
  role: Role;
  roomCode: string | null;
  playerId: string | null;
  myPlayer: Player | null;
  connected: boolean;

  // Room
  players: Player[];
  phase: GamePhase;
  mode: GameMode;
  selectedCategories: Category[];

  // Question
  currentQuestion: QuestionForClient | null;
  questionIndex: number;
  questionsTotal: number;
  timeSeconds: number;
  myAnswer: number | null;
  voteCounts: number[];

  // Results
  revealData: RevealData | null;
  leaderboard: LeaderboardEntry[];
  teamScores: TeamLeaderboard | null;
  coopScore: number;

  // Game over
  gameOverData: GameOverData | null;

  // Countdown
  countdownValue: number;

  // Actions
  setRole: (role: Role) => void;
  setRoomCode: (code: string) => void;
  setPlayerId: (id: string) => void;
  setMyPlayer: (player: Player) => void;
  setConnected: (connected: boolean) => void;
  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  setPhase: (phase: GamePhase) => void;
  setMode: (mode: GameMode) => void;
  setCategories: (categories: Category[]) => void;
  setQuestion: (q: QuestionForClient, index: number, total: number, time: number) => void;
  setMyAnswer: (index: number) => void;
  setVoteCounts: (counts: number[]) => void;
  setRevealData: (data: RevealData) => void;
  setLeaderboard: (players: LeaderboardEntry[], teamScores?: TeamLeaderboard, coopScore?: number) => void;
  setGameOver: (data: GameOverData) => void;
  setCountdown: (value: number) => void;
  setCoopScore: (score: number) => void;
  setTeamScores: (scores: TeamLeaderboard) => void;
  restoreState: (state: any) => void;
  reset: () => void;
}

const initialState = {
  role: 'none' as Role,
  roomCode: null as string | null,
  playerId: null as string | null,
  myPlayer: null as Player | null,
  connected: false,
  players: [] as Player[],
  phase: 'lobby' as GamePhase,
  mode: 'coop' as GameMode,
  selectedCategories: [] as Category[],
  currentQuestion: null as QuestionForClient | null,
  questionIndex: 0,
  questionsTotal: 0,
  timeSeconds: 0,
  myAnswer: null as number | null,
  voteCounts: [0, 0, 0, 0],
  revealData: null as RevealData | null,
  leaderboard: [] as LeaderboardEntry[],
  teamScores: null as TeamLeaderboard | null,
  coopScore: 0,
  gameOverData: null as GameOverData | null,
  countdownValue: 0,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  setRole: (role) => set({ role }),
  setRoomCode: (code) => set({ roomCode: code }),
  setPlayerId: (id) => set({ playerId: id }),
  setMyPlayer: (player) => set({ myPlayer: player }),
  setConnected: (connected) => set({ connected }),
  setPlayers: (players) => set({ players }),
  addPlayer: (player) =>
    set((s) => ({
      players: s.players.some((p) => p.id === player.id)
        ? s.players.map((p) => (p.id === player.id ? player : p))
        : [...s.players, player],
    })),
  removePlayer: (playerId) =>
    set((s) => ({ players: s.players.filter((p) => p.id !== playerId) })),
  setPhase: (phase) => set({ phase, myAnswer: phase === 'question' ? null : undefined }),
  setMode: (mode) => set({ mode }),
  setCategories: (categories) => set({ selectedCategories: categories }),
  setQuestion: (q, index, total, time) =>
    set({
      currentQuestion: q,
      questionIndex: index,
      questionsTotal: total,
      timeSeconds: time,
      myAnswer: null,
      voteCounts: [0, 0, 0, 0],
    }),
  setMyAnswer: (index) => set({ myAnswer: index }),
  setVoteCounts: (counts) => set({ voteCounts: counts }),
  setRevealData: (data) => set({ revealData: data }),
  setLeaderboard: (players, teamScores, coopScore) =>
    set({
      leaderboard: players,
      teamScores: teamScores ?? null,
      coopScore: coopScore ?? 0,
    }),
  setGameOver: (data) => set({ gameOverData: data }),
  setCountdown: (value) => set({ countdownValue: value }),
  setCoopScore: (score) => set({ coopScore: score }),
  setTeamScores: (scores) => set({ teamScores: scores }),
  restoreState: (state) =>
    set({
      players: state.players,
      phase: state.phase,
      mode: state.mode,
      selectedCategories: state.selectedCategories,
      currentQuestion: state.currentQuestion,
      questionIndex: state.questionIndex,
      coopScore: state.coopScore,
      teamScores: state.teamScores,
    }),
  reset: () => set(initialState),
}));
