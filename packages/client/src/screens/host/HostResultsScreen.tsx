import { useGameStore } from '../../stores/gameStore';
import ScorePopup from '../../components/ScorePopup';
import TeamBadge from '../../components/TeamBadge';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export default function HostResultsScreen() {
  const { currentQuestion, revealData, mode } = useGameStore();

  if (!currentQuestion || !revealData) return null;

  const { correctIndex, playerResults, coopResult } = revealData;

  return (
    <div className="min-h-screen bg-jam-dark text-white flex flex-col items-center p-8">
      {/* Question */}
      <h2 className="text-3xl font-bold text-center mb-8 animate-slide-up max-w-4xl">
        {currentQuestion.question}
      </h2>

      {/* Options with correct/wrong highlights */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-4xl mb-10 animate-slide-up">
        {currentQuestion.options.map((option, i) => {
          const isCorrect = i === correctIndex;
          const isCoopMajority = coopResult && i === coopResult.majorityIndex;

          let border = 'border-white/10 bg-white/5';
          if (isCorrect) border = 'border-jam-green bg-jam-green/20 ring-2 ring-jam-green';
          else if (isCoopMajority && !isCorrect) border = 'border-jam-red bg-jam-red/20 ring-2 ring-jam-red';

          return (
            <div key={i} className={`p-5 rounded-2xl border-2 ${border} flex items-center gap-4`}>
              <span className="text-2xl font-black opacity-60">{OPTION_LABELS[i]}</span>
              <span className="text-lg font-bold flex-1">{option}</span>
              {isCorrect && <span className="text-3xl">✅</span>}
              {isCoopMajority && !isCorrect && <span className="text-3xl">❌</span>}
            </div>
          );
        })}
      </div>

      {/* Co-op result */}
      {mode === 'coop' && coopResult && (
        <div className="animate-bounce-in text-center mb-8">
          <p className="text-xl text-white/60 mb-2">
            Group voted: <span className="font-bold text-white">{OPTION_LABELS[coopResult.majorityIndex]}</span>
            {' '}({coopResult.voteCounts[coopResult.majorityIndex]} votes)
          </p>
          <ScorePopup points={coopResult.pointsEarned} correct={coopResult.correct} />
          <p className="mt-4 text-2xl font-bold text-jam-purple">
            Co-op Score: {coopResult.newCoopScore}
          </p>
        </div>
      )}

      {/* Teams mode: player results */}
      {mode === 'teams' && (
        <div className="w-full max-w-3xl animate-slide-up">
          <h3 className="text-2xl font-bold text-center mb-4">Player Results</h3>
          <div className="space-y-2">
            {playerResults.map((result) => (
              <div
                key={result.playerId}
                className={`flex items-center justify-between p-3 rounded-xl ${
                  result.correct ? 'bg-jam-green/10 border border-jam-green/30' : 'bg-jam-red/10 border border-jam-red/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  {result.team && <TeamBadge team={result.team} />}
                  <span className="font-bold">{result.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {result.correct ? (
                    <span className="text-jam-green font-bold">+{result.pointsEarned}</span>
                  ) : (
                    <span className="text-jam-red font-bold">+0</span>
                  )}
                  {result.streak >= 2 && (
                    <span className="text-jam-yellow text-sm">🔥 {result.streak}</span>
                  )}
                  <span className="text-xl">{result.correct ? '✅' : '❌'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
