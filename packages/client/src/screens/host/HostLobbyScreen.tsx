import { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import RoomCodeDisplay from '../../components/RoomCodeDisplay';
import PlayerAvatar from '../../components/PlayerAvatar';
import CategoryCard from '../../components/CategoryCard';
import type { Category, GameMode } from '@trivia-jam/shared';

const ALL_CATEGORIES: Category[] = ['math', 'science', 'history', 'current-events', 'music', 'food', 'tech', 'geography', 'art', 'entertainment', 'animals', 'general', 'musicals', 'television', 'video-games', 'board-games', 'mythology', 'gadgets', 'anime', 'cartoons'];

interface Props {
  setMode: (mode: string) => void;
  selectCategories: (categories: string[]) => void;
  startGame: () => void;
}

export default function HostLobbyScreen({ setMode, selectCategories, startGame }: Props) {
  const { roomCode, players, mode, selectedCategories } = useGameStore();
  const [localCategories, setLocalCategories] = useState<Category[]>(selectedCategories);

  const toggleCategory = (cat: Category) => {
    const next = localCategories.includes(cat)
      ? localCategories.filter((c) => c !== cat)
      : [...localCategories, cat];
    setLocalCategories(next);
    selectCategories(next);
  };

  const handleSetMode = (m: GameMode) => {
    setMode(m);
  };

  const canStart = players.length > 0 && localCategories.length > 0;

  return (
    <div className="min-h-screen bg-jam-dark text-white p-8 flex flex-col items-center">
      {/* Room Code */}
      <div className="animate-bounce-in mb-6">
        <RoomCodeDisplay code={roomCode ?? '----'} large />
      </div>

      <p className="text-white/50 text-lg mb-10 animate-slide-up">
        Go to <span className="text-jam-yellow font-bold">{window.location.origin}</span> on your phone to join!
      </p>

      {/* Connected Players */}
      <div className="w-full max-w-4xl mb-10 animate-slide-up">
        <h2 className="text-2xl font-bold text-center mb-4">
          Players <span className="text-jam-purple">({players.length})</span>
        </h2>
        {players.length === 0 ? (
          <p className="text-center text-white/40 text-lg">Waiting for players to join...</p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4 justify-items-center">
            {players.map((player) => (
              <PlayerAvatar key={player.id} player={player} size="lg" />
            ))}
          </div>
        )}
      </div>

      {/* Game Mode Selector */}
      <div className="w-full max-w-2xl mb-10 animate-slide-up">
        <h2 className="text-2xl font-bold text-center mb-4">Game Mode</h2>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleSetMode('coop')}
            className={`p-6 rounded-2xl text-center font-bold text-xl transition-all duration-200 border-2 cursor-pointer ${
              mode === 'coop'
                ? 'border-jam-green bg-jam-green/20 ring-2 ring-jam-green text-jam-green'
                : 'border-white/10 bg-white/5 text-white/60 hover:border-white/30'
            }`}
          >
            <div className="text-4xl mb-2">🤝</div>
            Co-Op
            <p className="text-sm font-normal mt-1 opacity-70">Work together as a team</p>
          </button>
          <button
            onClick={() => handleSetMode('teams')}
            className={`p-6 rounded-2xl text-center font-bold text-xl transition-all duration-200 border-2 cursor-pointer ${
              mode === 'teams'
                ? 'border-jam-blue bg-jam-blue/20 ring-2 ring-jam-blue text-jam-blue'
                : 'border-white/10 bg-white/5 text-white/60 hover:border-white/30'
            }`}
          >
            <div className="text-4xl mb-2">⚔️</div>
            Teams
            <p className="text-sm font-normal mt-1 opacity-70">Red vs Blue showdown</p>
          </button>
        </div>
      </div>

      {/* Category Selector */}
      <div className="w-full max-w-4xl mb-10 animate-slide-up">
        <h2 className="text-2xl font-bold text-center mb-4">Categories</h2>
        <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-10 gap-3">
          {ALL_CATEGORIES.map((cat) => (
            <CategoryCard
              key={cat}
              category={cat}
              selected={localCategories.includes(cat)}
              onToggle={toggleCategory}
            />
          ))}
        </div>
      </div>

      {/* Start Game */}
      <button
        onClick={startGame}
        disabled={!canStart}
        className={`px-12 py-4 rounded-2xl text-2xl font-black uppercase tracking-wider transition-all duration-200 animate-bounce-in ${
          canStart
            ? 'bg-gradient-to-r from-jam-purple to-jam-pink text-white hover:scale-105 cursor-pointer shadow-lg shadow-jam-purple/30'
            : 'bg-white/10 text-white/30 cursor-not-allowed'
        }`}
      >
        Start Game
      </button>
    </div>
  );
}
