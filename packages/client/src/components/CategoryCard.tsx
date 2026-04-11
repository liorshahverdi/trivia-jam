import { CATEGORY_LABELS } from '@trivia-jam/shared';
import type { Category } from '@trivia-jam/shared';

interface CategoryCardProps {
  category: Category;
  selected: boolean;
  onToggle: (cat: Category) => void;
}

const CATEGORY_EMOJIS: Record<string, string> = {
  math: '🔢',
  science: '🔬',
  history: '📜',
  'current-events': '📰',
  music: '🎵',
  food: '🍕',
  tech: '💻',
  geography: '🌍',
  art: '🎨',
  entertainment: '🎬',
  animals: '🐾',
  general: '🧠',
  musicals: '🎭',
  television: '📺',
  'video-games': '🎮',
  'board-games': '🎲',
  mythology: '⚡',
  gadgets: '🔧',
  anime: '🍥',
  cartoons: '🖍️',
};

export default function CategoryCard({ category, selected, onToggle }: CategoryCardProps) {
  return (
    <button
      onClick={() => onToggle(category)}
      className={`card !p-3 cursor-pointer transition-all duration-200 flex flex-col items-center justify-center ${
        selected
          ? 'border-jam-purple bg-jam-purple/20 ring-2 ring-jam-purple'
          : 'hover:border-white/30'
      }`}
    >
      <div className="text-3xl mb-2">{CATEGORY_EMOJIS[category]}</div>
      <div className="font-bold text-xs leading-tight text-center">{CATEGORY_LABELS[category]}</div>
    </button>
  );
}
