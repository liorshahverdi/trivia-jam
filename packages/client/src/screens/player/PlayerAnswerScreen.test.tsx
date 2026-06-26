import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayerAnswerScreen from './PlayerAnswerScreen';
import { useGameStore } from '../../stores/gameStore';

describe('PlayerAnswerScreen', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  const setQuestionState = (myAnswer: number | null = null) => {
    useGameStore.setState({
      phase: 'question',
      currentQuestion: {
        id: 'q1',
        category: 'math',
        difficulty: 'easy',
        question: 'What is &pi; approximately?',
        options: ['3 &lt; 4', '2 &amp; 2', '3.14', '&quot;none&quot;'],
      },
      questionIndex: 0,
      questionsTotal: 10,
      timeSeconds: 20,
      myAnswer,
    });
  };

  it('renders decoded HTML entities in question text and answers', () => {
    setQuestionState();

    render(<PlayerAnswerScreen submitAnswer={vi.fn()} />);

    expect(screen.getByText('What is π approximately?')).toBeTruthy();
    expect(screen.getByText('3 < 4')).toBeTruthy();
    expect(screen.getByText('2 & 2')).toBeTruthy();
    expect(screen.getByText('"none"')).toBeTruthy();
  });

  it('shows A/B/C/D labels on player answers to match the host view', () => {
    setQuestionState();

    render(<PlayerAnswerScreen submitAnswer={vi.fn()} />);

    expect(screen.getByRole('button', { name: /^A\s+3 < 4$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^B\s+2 & 2$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^C\s+3\.14$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^D\s+"none"$/i })).toBeTruthy();
  });

  it('announces the exact selected answer and marks the selected option without relying only on color', () => {
    setQuestionState();
    const submitAnswer = vi.fn((answerIndex: number) => useGameStore.setState({ myAnswer: answerIndex }));

    const { rerender } = render(<PlayerAnswerScreen submitAnswer={submitAnswer} />);
    fireEvent.click(screen.getByRole('button', { name: /^B\s+2 & 2$/i }));
    rerender(<PlayerAnswerScreen submitAnswer={submitAnswer} />);

    expect(submitAnswer).toHaveBeenCalledWith(1);
    expect(screen.getByText('Locked in: B — 2 & 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Selected answer B\s+2 & 2$/i })).toBeTruthy();
  });

  it('keeps question and answers in a centered tablet-friendly content column', () => {
    setQuestionState();

    const { container } = render(<PlayerAnswerScreen submitAnswer={vi.fn()} />);

    const layout = container.querySelector('[data-testid="player-answer-layout"]');
    expect(layout?.className).toContain('max-w-2xl');
    expect(layout?.className).not.toContain('mt-auto');
  });
});
