import { useState } from 'react';

interface PlayerJoinScreenProps {
  createRoom: () => void;
  joinRoom: (code: string, name: string) => void;
}

export default function PlayerJoinScreen({ createRoom, joinRoom }: PlayerJoinScreenProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  const handleJoin = () => {
    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    if (trimmedCode.length !== 4) return;
    if (!trimmedName) return;
    joinRoom(trimmedCode, trimmedName);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-5xl font-black mb-12 bg-gradient-to-r from-jam-purple via-jam-pink to-jam-yellow bg-clip-text text-transparent">
        TriviaJam
      </h1>

      <div className="w-full max-w-sm flex flex-col gap-8">
        {/* Host option */}
        <button
          onClick={createRoom}
          className="btn-primary w-full py-4 text-lg font-bold"
        >
          Host a Game
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-white/20" />
          <span className="text-white/40 text-sm uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-white/20" />
        </div>

        {/* Join section */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold text-center">Join a Game</h2>

          <input
            type="text"
            placeholder="Room Code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
            maxLength={4}
            className="input-field text-center text-2xl font-mono tracking-[0.3em] uppercase"
          />

          <input
            type="text"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            className="input-field text-center text-lg"
          />

          <button
            onClick={handleJoin}
            disabled={code.trim().length !== 4 || !name.trim()}
            className="btn-primary w-full py-4 text-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Join
          </button>
        </div>
      </div>
    </div>
  );
}
