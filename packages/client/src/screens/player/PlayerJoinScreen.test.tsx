import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayerJoinScreen from './PlayerJoinScreen';
import { useGameStore } from '../../stores/gameStore';

describe('PlayerJoinScreen', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('shows join errors inline instead of failing silently', () => {
    useGameStore.setState({ roomError: 'Room not found, full, or game already started' });

    render(<PlayerJoinScreen createRoom={vi.fn()} joinRoom={vi.fn()} />);

    expect(screen.getByRole('alert').textContent).toContain('Room not found, full, or game already started');
  });
});
