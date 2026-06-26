import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayerFinalScreen from './PlayerFinalScreen';
import HostFinalScreen from '../host/HostFinalScreen';
import { useGameStore } from '../../stores/gameStore';

const tiedPlayers = [
  { playerId: 'alpha', name: 'AlphaLongPlayerName2', avatar: '🦊', score: 1100, streak: 0 },
  { playerId: 'beta', name: 'Beta', avatar: '🐸', score: 1100, streak: 0 },
  { playerId: 'gamma', name: 'Gamma', avatar: '🦉', score: 1100, streak: 0 },
];

describe('Co-op final screens', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
    useGameStore.setState({
      playerId: 'beta',
      myPlayer: { id: 'beta', name: 'Beta', avatar: '🐸', connected: true, score: 1100, streak: 0 },
      gameOverData: {
        mode: 'coop',
        players: tiedPlayers,
        coopScore: 1100,
        coopTarget: 2000,
        coopWin: false,
      },
    });
  });

  it('does not show misleading competitive rank for tied players in co-op final screen', () => {
    render(<PlayerFinalScreen />);

    expect(screen.getByText(/team result/i)).toBeTruthy();
    expect(screen.getByText(/tied with 3 players/i)).toBeTruthy();
    expect(screen.queryByText('#2')).toBeNull();
  });

  it('labels tied co-op standings on the host final screen instead of assigning medals', () => {
    render(<HostFinalScreen playAgain={vi.fn()} />);

    expect(screen.getByText(/shared team standings/i)).toBeTruthy();
    expect(screen.getAllByText(/tied/i).length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText('🥈')).toBeNull();
    expect(screen.queryByText('🥉')).toBeNull();
  });
});
