import { fireEvent, render, screen } from '@testing-library/react';
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

  it('shows a player-name character limit so truncation is not silent', () => {
    render(<PlayerJoinScreen createRoom={vi.fn()} joinRoom={vi.fn()} />);

    const nameInput = screen.getByPlaceholderText('Your Name');
    fireEvent.change(nameInput, { target: { value: 'AlphaLongPlayerName20' } });

    expect(screen.getByText('20 / 20 characters')).toBeTruthy();
    expect(screen.getByText(/names are limited to 20 characters/i)).toBeTruthy();
  });

  it('makes the enabled Join button visually distinct from its disabled state', () => {
    render(<PlayerJoinScreen createRoom={vi.fn()} joinRoom={vi.fn()} />);

    const joinButton = screen.getByRole('button', { name: /^join$/i });
    expect(joinButton.className).toContain('opacity-40');

    fireEvent.change(screen.getByPlaceholderText('Room Code'), { target: { value: 'ABCD' } });
    fireEvent.change(screen.getByPlaceholderText('Your Name'), { target: { value: 'Beta' } });

    expect(joinButton.hasAttribute('disabled')).toBe(false);
    expect(joinButton.className).toContain('ring-jam-yellow');
    expect(joinButton.className).not.toContain('opacity-40');
  });
});
