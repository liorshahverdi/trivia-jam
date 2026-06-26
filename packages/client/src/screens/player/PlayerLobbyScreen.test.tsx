import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import PlayerLobbyScreen from './PlayerLobbyScreen';
import { useGameStore } from '../../stores/gameStore';

const alpha = { id: 'alpha', name: 'AlphaLongPlayerName2', avatar: '🦊', connected: true, score: 0, streak: 0 };
const beta = { id: 'beta', name: 'Beta', avatar: '🐸', connected: true, score: 0, streak: 0 };
const gamma = { id: 'gamma', name: 'Gamma', avatar: '🦉', connected: true, score: 0, streak: 0 };

describe('PlayerLobbyScreen', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
    useGameStore.setState({
      roomCode: 'ABCD',
      playerId: 'gamma',
      myPlayer: gamma,
      players: [alpha, beta, gamma],
      mode: 'teams',
      roomError: null,
    });
  });

  it('labels the peer list as other players so the local player is not implied missing', () => {
    render(<PlayerLobbyScreen />);

    expect(screen.getByText(/other players in room/i)).toBeTruthy();
    expect(screen.queryByText(/^players in room$/i)).toBeNull();
  });

  it('surfaces host-side start blockers to waiting players', () => {
    useGameStore.setState({
      roomError: 'Teams mode needs an even number of players. Add or remove one player before starting.',
    });

    render(<PlayerLobbyScreen />);

    expect(screen.getByRole('alert').textContent).toContain('Teams mode needs an even number of players');
  });
});
