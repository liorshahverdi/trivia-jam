import { useGameStore } from '../../stores/gameStore';
import TeamBadge from '../../components/TeamBadge';

interface Props {
  playAgain: () => void;
}

export default function HostFinalScreen({ playAgain }: Props) {
  const { gameOverData } = useGameStore();

  if (!gameOverData) return null;

  const { mode, players, teamScores, coopScore, coopTarget, coopWin } = gameOverData;
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const mvp = sortedPlayers[0];

  const winningTeam =
    teamScores && teamScores.red !== teamScores.blue
      ? teamScores.red > teamScores.blue
        ? 'red'
        : 'blue'
      : null;

  return (
    <div className="min-h-screen bg-jam-dark text-white flex flex-col items-center p-8 overflow-y-auto">
      {/* Title */}
      <h1 className="text-6xl font-black mb-4 animate-bounce-in bg-gradient-to-r from-jam-purple via-jam-pink to-jam-yellow bg-clip-text text-transparent">
        Game Over!
      </h1>

      {/* Teams mode result */}
      {mode === 'teams' && teamScores && (
        <div className="text-center mb-8 animate-bounce-in">
          {winningTeam ? (
            <>
              <p className="text-2xl text-white/60 mb-2">The winner is...</p>
              <div
                className={`text-7xl font-black animate-bounce-in ${
                  winningTeam === 'red' ? 'text-jam-red' : 'text-jam-blue'
                }`}
              >
                {winningTeam === 'red' ? '🔴 Red Team!' : '🔵 Blue Team!'}
              </div>
              <div className="flex items-center justify-center gap-6 mt-6">
                <div className="text-center">
                  <p className="text-jam-red text-lg font-bold">Red</p>
                  <p className="text-4xl font-black">{teamScores.red}</p>
                </div>
                <span className="text-3xl text-white/20">-</span>
                <div className="text-center">
                  <p className="text-jam-blue text-lg font-bold">Blue</p>
                  <p className="text-4xl font-black">{teamScores.blue}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-5xl font-black text-jam-yellow animate-bounce-in">
              It&apos;s a Tie!
              <div className="flex items-center justify-center gap-6 mt-4">
                <span className="text-3xl">{teamScores.red}</span>
                <span className="text-white/20">-</span>
                <span className="text-3xl">{teamScores.blue}</span>
              </div>
            </div>
          )}

          {/* MVP */}
          {mvp && (
            <div className="mt-6 animate-slide-up">
              <p className="text-white/50 text-sm uppercase tracking-wider mb-1">MVP</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-5xl">{mvp.avatar}</span>
                <div>
                  <p className="text-2xl font-bold">{mvp.name}</p>
                  <p className="text-jam-yellow font-bold">{mvp.score} pts</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Co-op mode result */}
      {mode === 'coop' && (
        <div className="text-center mb-8 animate-bounce-in">
          <div
            className={`text-8xl font-black mb-4 ${
              coopWin ? 'text-jam-green' : 'text-jam-red'
            }`}
          >
            {coopWin ? 'YOU WIN!' : 'YOU LOSE'}
          </div>
          <p className="text-2xl text-white/60 mb-2">
            {coopWin ? 'Amazing teamwork!' : 'Better luck next time!'}
          </p>
          <div className="flex items-center justify-center gap-4 text-3xl font-bold mt-4">
            <span className={coopWin ? 'text-jam-green' : 'text-jam-red'}>{coopScore}</span>
            <span className="text-white/30">/</span>
            <span className="text-white/50">{coopTarget}</span>
          </div>
          <div className="w-64 mx-auto mt-4 bg-white/10 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                coopWin ? 'bg-jam-green' : 'bg-jam-red'
              }`}
              style={{ width: `${Math.min(((coopScore ?? 0) / (coopTarget ?? 1)) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Player Leaderboard */}
      <div className="w-full max-w-2xl mb-10 animate-slide-up">
        <h2 className="text-2xl font-bold text-center mb-4">Final Standings</h2>
        <div className="space-y-2">
          {sortedPlayers.map((player, i) => (
            <div
              key={player.playerId}
              className={`flex items-center gap-4 p-4 rounded-xl ${
                i === 0
                  ? 'bg-jam-yellow/10 border border-jam-yellow/30'
                  : i === 1
                  ? 'bg-white/10 border border-white/20'
                  : i === 2
                  ? 'bg-jam-pink/5 border border-jam-pink/20'
                  : 'bg-white/5 border border-white/10'
              }`}
            >
              <span
                className={`text-2xl font-black w-10 text-center ${
                  i === 0 ? 'text-jam-yellow' : i === 1 ? 'text-white/70' : i === 2 ? 'text-jam-pink' : 'text-white/40'
                }`}
              >
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
              </span>
              <span className="text-3xl">{player.avatar}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg">{player.name}</span>
                  {player.team && <TeamBadge team={player.team} />}
                </div>
              </div>
              <span className="text-2xl font-black">{player.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Play Again */}
      <button
        onClick={playAgain}
        className="px-12 py-4 rounded-2xl text-2xl font-black uppercase tracking-wider bg-gradient-to-r from-jam-purple to-jam-pink text-white hover:scale-105 cursor-pointer shadow-lg shadow-jam-purple/30 transition-all duration-200 animate-bounce-in"
      >
        Play Again
      </button>
    </div>
  );
}
