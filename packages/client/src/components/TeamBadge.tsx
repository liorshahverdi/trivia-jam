import type { TeamColor } from '@trivia-jam/shared';

interface TeamBadgeProps {
  team: TeamColor;
  score?: number;
}

export default function TeamBadge({ team, score }: TeamBadgeProps) {
  const color = team === 'red' ? 'bg-jam-red' : 'bg-jam-blue';
  const label = team === 'red' ? 'Red' : 'Blue';

  return (
    <span className={`${color} text-white text-xs font-bold px-2 py-1 rounded-full inline-flex items-center gap-1`}>
      {label}
      {score !== undefined && <span className="ml-1">{score}</span>}
    </span>
  );
}
