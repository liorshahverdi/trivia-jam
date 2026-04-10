import { useGameStore } from '../../stores/gameStore';
import TeamBadge from '../../components/TeamBadge';

export default function PlayerFinalScreen() {
  const { gameOverData, playerId, myPlayer } = useGameStore();

  if (!gameOverData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-white/50 animate-pulse">Loading results...</p>
      </div>
    );
  }

  const { mode, players, teamScores, coopScore, coopTarget, coopWin } = gameOverData;
  const myEntry = players.find((p) => p.playerId === playerId);
  const myRank = players.findIndex((p) => p.playerId === playerId) + 1;

  // Determine if the player "won"
  let isWin = false;
  let resultTitle = '';
  let resultEmoji = '';

  if (mode === 'coop') {
    isWin = coopWin ?? false;
    resultTitle = isWin ? 'You Win!' : 'Game Over';
    resultEmoji = isWin ? '🎉🥳🎊' : '😔💔';
  } else {
    // Teams mode
    const winningTeam =
      teamScores && teamScores.red !== teamScores.blue
        ? teamScores.red > teamScores.blue
          ? 'red' as const
          : 'blue' as const
        : null;

    if (winningTeam && myEntry?.team === winningTeam) {
      isWin = true;
      resultTitle = 'Your Team Wins!';
      resultEmoji = '🏆🎉🥇';
    } else if (winningTeam) {
      resultTitle = `Team ${winningTeam === 'red' ? 'Red' : 'Blue'} Wins!`;
      resultEmoji = '😢👏';
    } else {
      resultTitle = "It's a Tie!";
      resultEmoji = '🤝';
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      {/* Emojis */}
      <div className="text-5xl">{resultEmoji}</div>

      {/* Result title */}
      <h1
        className={`text-3xl font-black text-center ${
          isWin ? 'text-jam-yellow' : 'text-white/80'
        }`}
      >
        {resultTitle}
      </h1>

      {/* Co-op score */}
      {mode === 'coop' && coopTarget !== undefined && (
        <div className="card px-6 py-4 text-center">
          <p className="text-white/60 text-sm mb-1">Co-op Score</p>
          <p className="text-3xl font-black">
            {coopScore} <span className="text-white/40 text-lg">/ {coopTarget}</span>
          </p>
        </div>
      )}

      {/* Teams scores */}
      {mode === 'teams' && teamScores && (
        <div className="flex gap-4">
          <div className="card px-6 py-4 text-center">
            <TeamBadge team="red" />
            <p className="text-2xl font-black mt-2">{teamScores.red}</p>
          </div>
          <div className="card px-6 py-4 text-center">
            <TeamBadge team="blue" />
            <p className="text-2xl font-black mt-2">{teamScores.blue}</p>
          </div>
        </div>
      )}

      {/* Player's own score */}
      {myEntry && (
        <div className="card px-8 py-6 text-center border-jam-purple bg-jam-purple/10">
          <p className="text-4xl mb-2">{myPlayer?.avatar ?? myEntry.avatar}</p>
          <p className="font-bold text-lg">{myEntry.name}</p>
          <p className="text-white/60 text-sm mt-1">Rank</p>
          <p className="text-4xl font-black text-jam-yellow">#{myRank}</p>
          <p className="text-white/80 mt-1">
            <span className="font-bold text-xl">{myEntry.score}</span> points
          </p>
        </div>
      )}

      {/* Waiting message */}
      <div className="mt-4 text-center">
        <p className="text-white/40 animate-pulse">
          Waiting for host...
        </p>
      </div>
    </div>
  );
}
