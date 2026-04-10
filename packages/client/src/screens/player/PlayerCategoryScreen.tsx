import { useGameStore } from '../../stores/gameStore';
import { CATEGORY_LABELS } from '@trivia-jam/shared';

export default function PlayerCategoryScreen() {
  const { selectedCategories } = useGameStore();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      {selectedCategories.length === 0 ? (
        <div className="text-center">
          <div className="text-5xl mb-6 animate-pulse">🎯</div>
          <h2 className="text-2xl font-bold mb-2">Waiting for categories...</h2>
          <p className="text-white/50">The host is picking categories</p>
        </div>
      ) : (
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-6">Categories Selected</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {selectedCategories.map((cat) => (
              <div
                key={cat}
                className="card px-4 py-2 border-jam-purple bg-jam-purple/20"
              >
                <span className="font-bold">{CATEGORY_LABELS[cat] ?? cat}</span>
              </div>
            ))}
          </div>
          <p className="text-white/50 mt-6 animate-pulse">
            Get ready...
          </p>
        </div>
      )}
    </div>
  );
}
