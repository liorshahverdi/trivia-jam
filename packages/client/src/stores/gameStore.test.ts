import { describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore';

const basePlayer = {
  name: 'Alice',
  avatar: '🦊',
  connected: true,
  score: 0,
  streak: 0,
};

describe('gameStore.restoreState', () => {
  it('refreshes myPlayer from restored room players so assigned teams are visible', () => {
    useGameStore.getState().reset();
    useGameStore.setState({
      playerId: 'socket-1',
      myPlayer: { id: 'socket-1', ...basePlayer },
    });

    useGameStore.getState().restoreState({
      players: [{ id: 'socket-1', ...basePlayer, team: 'red' }],
      phase: 'lobby',
      mode: 'teams',
      selectedCategories: ['math'],
      currentQuestion: null,
      questionIndex: 0,
      coopScore: 0,
      teamScores: { red: 0, blue: 0 },
    });

    expect(useGameStore.getState().myPlayer?.team).toBe('red');
  });
});
