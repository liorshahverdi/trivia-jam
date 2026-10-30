import { beforeEach, describe, expect, it } from 'vitest';
import type { RoomState } from '@trivia-jam/shared';
import { useGameStore } from './gameStore';

const basePlayer = {
  name: 'Alice',
  avatar: '🦊',
  connected: true,
  score: 0,
  streak: 0,
};

const roomState = (overrides: Partial<RoomState> = {}): RoomState => ({
  code: 'ABCD',
  players: [{ id: 'player-1', ...basePlayer, team: 'red' }],
  phase: 'lobby',
  mode: 'teams',
  selectedCategories: ['math'],
  difficulty: 'hard',
  hostConnected: false,
  currentQuestion: null,
  questionIndex: 0,
  questionsPerGame: 7,
  coopScore: 0,
  teamScores: { red: 0, blue: 0 },
  countdownValue: 0,
  ...overrides,
});

describe('gameStore', () => {
  beforeEach(() => useGameStore.getState().reset());

  it('refreshes myPlayer from restored room players so assigned teams are visible', () => {
    useGameStore.setState({
      playerId: 'player-1',
      myPlayer: { id: 'player-1', ...basePlayer },
    });

    useGameStore.getState().restoreState(roomState());

    const state = useGameStore.getState();
    expect(state.myPlayer?.team).toBe('red');
    expect(state.difficulty).toBe('hard');
    expect(state.hostConnected).toBe(false);
    expect(state.questionsTotal).toBe(7);
  });

  it('marks players disconnected without removing them during the grace period', () => {
    useGameStore.getState().restoreState(roomState());
    useGameStore.getState().setPlayerConnected('player-1', false);
    expect(useGameStore.getState().players).toEqual([expect.objectContaining({ id: 'player-1', connected: false })]);
  });

  it('leaveRoom returns to the join screen with a reason but keeps connection status', () => {
    useGameStore.setState({ role: 'player', roomCode: 'ABCD', connected: true });
    useGameStore.getState().leaveRoom('The host left the game.');
    const state = useGameStore.getState();
    expect(state.role).toBe('none');
    expect(state.roomCode).toBeNull();
    expect(state.connected).toBe(true);
    expect(state.roomError).toBe('The host left the game.');
  });
});
