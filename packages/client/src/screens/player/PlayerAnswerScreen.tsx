import { useGameStore } from '../../stores/gameStore';
import Timer from '../../components/Timer';
import ProgressBar from '../../components/ProgressBar';
import { decodeHtmlEntities } from '../../utils/html';

const ANSWER_COLORS = [
  'border-jam-red bg-jam-red/20',
  'border-jam-blue bg-jam-blue/20',
  'border-jam-yellow bg-jam-yellow/20',
  'border-jam-green bg-jam-green/20',
];
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

interface PlayerAnswerScreenProps {
  submitAnswer: (answerIndex: number) => void;
}

export default function PlayerAnswerScreen({ submitAnswer }: PlayerAnswerScreenProps) {
  const {
    phase,
    countdownValue,
    currentQuestion,
    questionIndex,
    questionsTotal,
    timeSeconds,
    myAnswer,
  } = useGameStore();

  // Countdown phase
  if (phase === 'countdown') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <p className="text-white/60 text-lg mb-4">Get Ready!</p>
        <div className="text-8xl font-black text-jam-yellow animate-bounce-in">
          {countdownValue}
        </div>
      </div>
    );
  }

  // Question phase
  if (!currentQuestion) return null;

  const handleAnswer = (index: number) => {
    submitAnswer(index);
  };

  const selectedLabel = myAnswer !== null ? OPTION_LABELS[myAnswer] : null;
  const selectedAnswer = myAnswer !== null && currentQuestion.options[myAnswer]
    ? decodeHtmlEntities(currentQuestion.options[myAnswer])
    : null;

  return (
    <div className="min-h-screen flex flex-col p-4 pb-6">
      {/* Timer */}
      <Timer seconds={timeSeconds} />

      {/* Progress */}
      <div className="mt-3 mb-4">
        <ProgressBar current={questionIndex} total={questionsTotal} />
      </div>

      {/* Question */}
      <div data-testid="player-answer-layout" className="flex-1 flex flex-col justify-center w-full max-w-2xl mx-auto gap-6 md:gap-8">
        <h2 className="text-xl md:text-2xl font-bold text-center leading-relaxed">
          {decodeHtmlEntities(currentQuestion.question)}
        </h2>

        {/* Answer buttons */}
        <div className="flex flex-col gap-3 md:gap-4">
          {currentQuestion.options.map((option, i) => {
            const isSelected = myAnswer === i;
            const baseColor = ANSWER_COLORS[i];
            const label = OPTION_LABELS[i];
            const decodedOption = decodeHtmlEntities(option);

            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                aria-pressed={isSelected}
                aria-label={`${isSelected ? 'Selected answer ' : ''}${label} ${decodedOption}`}
                className={`btn-answer border-2 rounded-xl px-4 py-4 min-h-[56px] text-left text-lg font-medium transition-all duration-200 ${baseColor} ${
                  isSelected
                    ? 'ring-4 ring-white scale-[1.02] shadow-lg shadow-white/20'
                    : 'active:scale-95'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-base font-black">
                    {label}
                  </span>
                  <span className="flex-1">{decodedOption}</span>
                  {isSelected && <span className="text-2xl" aria-hidden="true">✓</span>}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selection message */}
        {selectedLabel && selectedAnswer && (
          <div className="text-center">
            <p className="rounded-xl border border-jam-green/40 bg-jam-green/15 px-4 py-3 text-jam-green font-bold text-lg">
              Locked in: {selectedLabel} — {selectedAnswer}
            </p>
            <p className="mt-2 text-white/70 text-sm">Tap another answer to change.</p>
          </div>
        )}
      </div>
    </div>
  );
}
