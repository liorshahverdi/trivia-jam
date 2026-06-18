import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayerAnswerScreen from './PlayerAnswerScreen';
import { useGameStore } from '../../stores/gameStore';

describe('PlayerAnswerScreen', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('renders decoded HTML entities in question text and answers', () => {
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
    });

    render(<PlayerAnswerScreen submitAnswer={vi.fn()} />);

    expect(screen.getByText('What is π approximately?')).toBeTruthy();
    expect(screen.getByText('3 < 4')).toBeTruthy();
    expect(screen.getByText('2 & 2')).toBeTruthy();
    expect(screen.getByText('"none"')).toBeTruthy();
  });
});
