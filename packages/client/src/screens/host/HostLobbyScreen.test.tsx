import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HostLobbyScreen from './HostLobbyScreen';
import { useGameStore } from '../../stores/gameStore';

const player = {
  id: 'p1',
  name: 'Alice',
  avatar: '🦊',
  connected: true,
  score: 0,
  streak: 0,
};

describe('HostLobbyScreen', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
    useGameStore.setState({
      roomCode: 'ABCD',
      players: [player],
      selectedCategories: [],
      mode: 'coop',
      roomError: null,
    });
  });

  it('tells players to join using the deployed Trivia Jam path, not only the portfolio origin', () => {
    render(
      <HostLobbyScreen
        setMode={vi.fn()}
        selectCategories={vi.fn()}
        startGame={vi.fn()}
      />
    );

    expect(screen.getByText('http://localhost:3000/trivia-jam/')).toBeTruthy();
  });

  it('explains why the host cannot start before selecting a category', () => {
    render(
      <HostLobbyScreen
        setMode={vi.fn()}
        selectCategories={vi.fn()}
        startGame={vi.fn()}
      />
    );

    expect(screen.getByText(/select at least one category to start/i)).toBeTruthy();
  });

  it('shows host-side room errors such as invalid teams mode start attempts', () => {
    useGameStore.setState({
      roomError: 'Teams mode needs an even number of players. Add or remove one player before starting.',
    });

    render(
      <HostLobbyScreen
        setMode={vi.fn()}
        selectCategories={vi.fn()}
        startGame={vi.fn()}
      />
    );

    expect(screen.getByRole('alert').textContent).toContain('Teams mode needs an even number of players');
  });
});
