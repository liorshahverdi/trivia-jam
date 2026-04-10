import { useGameStore } from '../../stores/gameStore';
import Timer from '../../components/Timer';
import ProgressBar from '../../components/ProgressBar';

const ANSWER_COLORS = [
  'border-jam-red bg-jam-red/20',
  'border-jam-blue bg-jam-blue/20',
  'border-jam-yellow bg-jam-yellow/20',
  'border-jam-green bg-jam-green/20',
];

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

  return (
    <div className="min-h-screen flex flex-col p-4 pb-6">
      {/* Timer */}
      <Timer seconds={timeSeconds} />

      {/* Progress */}
      <div className="mt-3 mb-4">
        <ProgressBar current={questionIndex} total={questionsTotal} />
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col">
        <h2 className="text-xl font-bold text-center mb-6 leading-relaxed">
          {currentQuestion.question}
        </h2>

        {/* Answer buttons */}
        <div className="flex flex-col gap-3 mt-auto">
          {currentQuestion.options.map((option, i) => {
            const isSelected = myAnswer === i;
            const baseColor = ANSWER_COLORS[i];

            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                className={`btn-answer border-2 rounded-xl px-4 py-4 min-h-[48px] text-left text-lg font-medium transition-all duration-200 ${baseColor} ${
                  isSelected
                    ? 'ring-2 ring-white scale-[1.02]'
                    : 'active:scale-95'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>

        {/* Selection message */}
        {myAnswer !== null && (
          <div className="text-center mt-4">
            <p className="text-jam-green font-bold text-lg">
              Locked in! Tap another to change.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
