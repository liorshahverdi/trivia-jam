import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StatusBanners, { COLD_START_HINT_DELAY_MS } from './StatusBanners';
import FlagQuestionButton from './FlagQuestionButton';
import { useGameStore } from '../stores/gameStore';

describe('StatusBanners', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.getState().reset();
  });
  afterEach(() => vi.useRealTimers());

  it('explains a slow first connection as the server waking up', () => {
    render(<StatusBanners />);
    expect(screen.queryByRole('status')).toBeNull();
    act(() => vi.advanceTimersByTime(COLD_START_HINT_DELAY_MS));
    expect(screen.getByRole('status').textContent).toMatch(/waking up the game server/i);

    act(() => useGameStore.setState({ connected: true }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('tells players when the host screen drops', () => {
    useGameStore.setState({ connected: true, role: 'player', hostConnected: false });
    render(<StatusBanners />);
    expect(screen.getByRole('status').textContent).toMatch(/host’s screen disconnected/i);
  });

  it('shows reconnecting mid-game', () => {
    useGameStore.setState({ connected: false, role: 'host' });
    render(<StatusBanners />);
    expect(screen.getByRole('status').textContent).toMatch(/reconnecting/i);
  });
});

describe('FlagQuestionButton', () => {
  it('reports once per question', () => {
    const onFlag = vi.fn();
    const { rerender } = render(<FlagQuestionButton questionId="q1" onFlag={onFlag} />);
    act(() => screen.getByRole('button').click());
    expect(onFlag).toHaveBeenCalledWith('q1');
    expect(screen.queryByRole('button')).toBeNull();

    rerender(<FlagQuestionButton questionId="q2" onFlag={onFlag} />);
    expect(screen.getByRole('button')).toBeTruthy();
  });
});
