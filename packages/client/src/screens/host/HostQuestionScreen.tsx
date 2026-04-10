import { useGameStore } from '../../stores/gameStore';
import ProgressBar from '../../components/ProgressBar';
import Timer from '../../components/Timer';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const OPTION_COLORS = [
  'border-jam-red bg-jam-red/10',
  'border-jam-blue bg-jam-blue/10',
  'border-jam-yellow bg-jam-yellow/10',
  'border-jam-green bg-jam-green/10',
];

export default function HostQuestionScreen() {
  const {
    phase,
    currentQuestion,
    questionIndex,
    questionsTotal,
    timeSeconds,
    countdownValue,
    voteCounts,
    mode,
    players,
  } = useGameStore();

  // During countdown phase, show big countdown
  if (phase === 'countdown') {
    return (
      <div className="min-h-screen bg-jam-dark text-white flex flex-col items-center justify-center p-8">
        <div className="mb-8 w-full max-w-3xl">
          <ProgressBar current={questionIndex} total={questionsTotal} />
        </div>
        <div className="animate-bounce-in">
          <div className="text-[12rem] font-black leading-none bg-gradient-to-b from-jam-yellow to-jam-pink bg-clip-text text-transparent">
            {countdownValue}
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const totalVotes = voteCounts.reduce((a, b) => a + b, 0);
  const maxVote = Math.max(...voteCounts);
  const answeredCount = totalVotes;
  const totalPlayers = players.length;

  return (
    <div className="min-h-screen bg-jam-dark text-white flex flex-col p-8">
      {/* Progress */}
      <div className="w-full max-w-4xl mx-auto mb-4 animate-slide-up">
        <ProgressBar current={questionIndex} total={questionsTotal} />
      </div>

      {/* Timer */}
      <div className="w-full max-w-4xl mx-auto mb-8">
        <Timer seconds={timeSeconds} />
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full">
        <h1 className="text-4xl md:text-5xl font-black text-center mb-12 animate-bounce-in leading-tight">
          {currentQuestion.question}
        </h1>

        {/* Answer options */}
        <div className="grid grid-cols-2 gap-4 w-full animate-slide-up">
          {currentQuestion.options.map((option, i) => (
            <div
              key={i}
              className={`p-6 rounded-2xl border-2 ${OPTION_COLORS[i]} flex items-center gap-4`}
            >
              <span className="text-3xl font-black opacity-60">{OPTION_LABELS[i]}</span>
              <span className="text-xl font-bold flex-1">{option}</span>

              {/* Co-op: live vote bar */}
              {mode === 'coop' && totalVotes > 0 && (
                <div className="flex items-center gap-2 min-w-[120px]">
                  <div className="flex-1 bg-white/10 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        voteCounts[i] === maxVote && voteCounts[i] > 0 ? 'bg-jam-yellow' : 'bg-white/30'
                      }`}
                      style={{ width: `${(voteCounts[i] / totalVotes) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold w-8 text-right">{voteCounts[i]}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Teams mode: answered count */}
        {mode === 'teams' && (
          <div className="mt-8 text-center animate-slide-up">
            <p className="text-2xl text-white/60">
              <span className="text-white font-bold">{answeredCount}</span> / {totalPlayers} players answered
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
