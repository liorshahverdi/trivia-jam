import { useGameStore } from '../../stores/gameStore';
import TeamBadge from '../../components/TeamBadge';
import { QUESTIONS_PER_GAME } from '@trivia-jam/shared';

export default function HostLeaderboard() {
  const { mode, leaderboard, teamScores, coopScore, questionsTotal } = useGameStore();

  const coopTarget = (questionsTotal || QUESTIONS_PER_GAME) * 200;
  const coopPct = Math.min((coopScore / coopTarget) * 100, 100);
  const sortedPlayers = [...leaderboard].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-jam-dark text-white flex flex-col items-center p-8">
      <h1 className="text-5xl font-black mb-10 animate-bounce-in bg-gradient-to-r from-jam-yellow to-jam-pink bg-clip-text text-transparent">
        Leaderboard
      </h1>

      {/* Teams mode: Team scores */}
      {mode === 'teams' && teamScores && (
        <div className="flex items-center gap-8 mb-10 animate-slide-up">
          <div className="text-center">
            <div className="bg-jam-red/20 border-2 border-jam-red rounded-2xl p-6 min-w-[180px]">
              <p className="text-jam-red text-lg font-bold mb-1">Red Team</p>
              <p className="text-5xl font-black">{teamScores.red}</p>
            </div>
          </div>
          <span className="text-4xl font-black text-white/30">VS</span>
          <div className="text-center">
            <div className="bg-jam-blue/20 border-2 border-jam-blue rounded-2xl p-6 min-w-[180px]">
              <p className="text-jam-blue text-lg font-bold mb-1">Blue Team</p>
              <p className="text-5xl font-black">{teamScores.blue}</p>
            </div>
          </div>
        </div>
      )}

      {/* Co-op mode: Score progress */}
      {mode === 'coop' && (
        <div className="w-full max-w-2xl mb-10 animate-slide-up">
          <div className="flex justify-between text-lg mb-2">
            <span className="text-white/60">Co-op Score</span>
            <span className="font-bold text-jam-yellow">{coopScore} / {coopTarget}</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-6 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-jam-green to-jam-yellow transition-all duration-1000"
              style={{ width: `${coopPct}%` }}
            />
          </div>
          <p className="text-center text-white/40 mt-2">
            {coopPct >= 100 ? 'Target reached!' : `${Math.round(coopTarget - coopScore)} points to target`}
          </p>
        </div>
      )}

      {/* Individual leaderboard */}
      <div className="w-full max-w-2xl animate-slide-up">
        <div className="space-y-2">
          {sortedPlayers.map((player, i) => (
            <div
              key={player.playerId}
              className={`flex items-center gap-4 p-4 rounded-xl ${
                i === 0 ? 'bg-jam-yellow/10 border border-jam-yellow/30' : 'bg-white/5 border border-white/10'
              }`}
            >
              <span className={`text-2xl font-black w-10 text-center ${i === 0 ? 'text-jam-yellow' : 'text-white/40'}`}>
                {i + 1}
              </span>
              <span className="text-3xl">{player.avatar}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg">{player.name}</span>
                  {player.team && <TeamBadge team={player.team} />}
                </div>
                {player.streak >= 2 && (
                  <span className="text-sm text-jam-yellow">🔥 {player.streak} streak</span>
                )}
              </div>
              <span className="text-2xl font-black">{player.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
