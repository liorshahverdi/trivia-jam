import { useGameStore } from '../../stores/gameStore';
import RoomCodeDisplay from '../../components/RoomCodeDisplay';
import PlayerAvatar from '../../components/PlayerAvatar';
import TeamBadge from '../../components/TeamBadge';

export default function PlayerLobbyScreen() {
  const { roomCode, myPlayer, players, mode, roomError } = useGameStore();

  const otherPlayers = players.filter((p) => p.id !== myPlayer?.id);
  const connectedPlayerCount = players.filter((player) => player.connected).length;
  const teamsOddPlayerCount = mode === 'teams' && connectedPlayerCount > 0 && connectedPlayerCount % 2 !== 0;
  const waitingIssue = roomError ?? (teamsOddPlayerCount
    ? 'Teams mode needs an even number of players. Waiting for one more player or for the host to switch modes.'
    : null);

  return (
    <div className="min-h-screen flex flex-col items-center p-6 pt-10">
      {/* Room code */}
      {roomCode && <RoomCodeDisplay code={roomCode} large />}

      {/* My avatar */}
      {myPlayer && (
        <div className="mt-8 mb-6">
          <PlayerAvatar player={myPlayer} size="lg" showName />
          {myPlayer.team && (
            <div className="mt-2 flex justify-center">
              <TeamBadge team={myPlayer.team} />
            </div>
          )}
        </div>
      )}

      {/* Game mode */}
      <div className="card px-4 py-2 mb-6">
        <span className="text-white/60 text-sm">Mode: </span>
        <span className="font-bold">
          {mode === 'coop' ? 'Co-op' : 'Teams'}
        </span>
      </div>

      {waitingIssue && (
        <p role="alert" className="mb-6 w-full max-w-sm rounded-xl border border-jam-yellow/50 bg-jam-yellow/15 px-4 py-3 text-center text-sm font-semibold text-jam-yellow">
          {waitingIssue}
        </p>
      )}

      {/* Other players */}
      {otherPlayers.length > 0 && (
        <div className="w-full max-w-sm mb-8">
          <h3 className="text-white/80 text-sm uppercase tracking-wider mb-3 text-center">
            Other Players in Room
          </h3>
          <div className="flex flex-wrap justify-center gap-4">
            {otherPlayers.map((p) => (
              <div key={p.id} className="flex flex-col items-center">
                <PlayerAvatar player={p} size="sm" showName />
                {p.team && (
                  <div className="mt-1">
                    <TeamBadge team={p.team} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Waiting message */}
      <div className="mt-auto pb-8 text-center">
        <p className="text-white/70 animate-pulse text-lg">
          Waiting for host to start...
        </p>
      </div>
    </div>
  );
}
