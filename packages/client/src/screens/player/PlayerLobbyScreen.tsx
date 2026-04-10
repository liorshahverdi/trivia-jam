import { useGameStore } from '../../stores/gameStore';
import RoomCodeDisplay from '../../components/RoomCodeDisplay';
import PlayerAvatar from '../../components/PlayerAvatar';
import TeamBadge from '../../components/TeamBadge';

export default function PlayerLobbyScreen() {
  const { roomCode, myPlayer, players, mode } = useGameStore();

  const otherPlayers = players.filter((p) => p.id !== myPlayer?.id);

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

      {/* Other players */}
      {otherPlayers.length > 0 && (
        <div className="w-full max-w-sm mb-8">
          <h3 className="text-white/60 text-sm uppercase tracking-wider mb-3 text-center">
            Players in Room
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
        <p className="text-white/50 animate-pulse text-lg">
          Waiting for host to start...
        </p>
      </div>
    </div>
  );
}
