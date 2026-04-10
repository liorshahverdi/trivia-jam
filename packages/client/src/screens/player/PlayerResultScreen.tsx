import { useGameStore } from '../../stores/gameStore';
import ScorePopup from '../../components/ScorePopup';
import TeamBadge from '../../components/TeamBadge';

export default function PlayerResultScreen() {
  const {
    phase,
    mode,
    playerId,
    revealData,
    currentQuestion,
    leaderboard,
    myPlayer,
  } = useGameStore();

  // Reveal phase
  if (phase === 'reveal') {
    if (!revealData || !currentQuestion) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <p className="text-white/50 animate-pulse">Revealing answer...</p>
        </div>
      );
    }

    const myResult = revealData.playerResults.find((r) => r.playerId === playerId);
    const correctAnswer = currentQuestion.options[revealData.correctIndex];

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
        {/* Correct/Wrong popup */}
        {myResult && (
          <ScorePopup points={myResult.pointsEarned} correct={myResult.correct} />
        )}

        {/* Correct answer */}
        <div className="card px-6 py-4 text-center border-jam-green bg-jam-green/10">
          <p className="text-white/60 text-sm mb-1">Correct Answer</p>
          <p className="text-lg font-bold">{correctAnswer}</p>
        </div>

        {/* Teams mode: points and streak */}
        {mode === 'teams' && myResult && (
          <div className="flex flex-col items-center gap-2">
            {myResult.team && <TeamBadge team={myResult.team} />}
            <p className="text-white/80">
              <span className="font-bold text-jam-yellow">+{myResult.pointsEarned}</span> points
            </p>
            {myResult.streak >= 2 && (
              <p className="text-jam-orange font-bold">
                Streak x{myResult.streak}!
              </p>
            )}
          </div>
        )}

        {/* Co-op mode: group vote result */}
        {mode === 'coop' && revealData.coopResult && (
          <div className="card px-6 py-4 text-center">
            <p className="text-white/60 text-sm mb-1">Group Vote</p>
            <p className={`text-lg font-bold ${revealData.coopResult.correct ? 'text-jam-green' : 'text-jam-red'}`}>
              {revealData.coopResult.correct ? 'The group was right!' : 'The group was wrong!'}
            </p>
            <p className="text-white/60 text-sm mt-1">
              +{revealData.coopResult.pointsEarned} points (Total: {revealData.coopResult.newCoopScore})
            </p>
          </div>
        )}
      </div>
    );
  }

  // Leaderboard phase
  const myEntry = leaderboard.find((e) => e.playerId === playerId);
  const myRank = leaderboard.findIndex((e) => e.playerId === playerId) + 1;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      <h2 className="text-2xl font-bold">Leaderboard</h2>

      {myEntry && (
        <div className="card px-8 py-6 text-center border-jam-purple bg-jam-purple/10">
          <p className="text-4xl mb-2">{myPlayer?.avatar ?? myEntry.avatar}</p>
          <p className="text-white/60 text-sm">Your Rank</p>
          <p className="text-5xl font-black text-jam-yellow">#{myRank}</p>
          <p className="text-white/80 mt-2">
            <span className="font-bold text-2xl">{myEntry.score}</span> points
          </p>
          {myEntry.streak >= 2 && (
            <p className="text-jam-orange font-bold mt-1">
              Streak x{myEntry.streak}
            </p>
          )}
        </div>
      )}

      <p className="text-white/40 text-sm">
        {leaderboard.length} player{leaderboard.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
