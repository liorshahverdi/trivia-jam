import { useGameStore } from '../../stores/gameStore';
import { CATEGORY_LABELS } from '@trivia-jam/shared';

export default function HostCategoryScreen() {
  const { selectedCategories, countdownValue } = useGameStore();

  return (
    <div className="min-h-screen bg-jam-dark text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-6xl font-black mb-8 animate-bounce-in bg-gradient-to-r from-jam-yellow to-jam-pink bg-clip-text text-transparent">
        Get Ready!
      </h1>

      <div className="flex flex-wrap gap-3 justify-center mb-12 animate-slide-up">
        {selectedCategories.map((cat) => (
          <span
            key={cat}
            className="bg-jam-purple/20 border border-jam-purple text-jam-purple px-4 py-2 rounded-full text-lg font-bold"
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </span>
        ))}
      </div>

      <div className="animate-bounce-in">
        <div className="text-[10rem] font-black leading-none bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">
          {countdownValue}
        </div>
      </div>
    </div>
  );
}
