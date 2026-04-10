import type { Player } from '@trivia-jam/shared';

interface PlayerAvatarProps {
  player: Player;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

const sizes = { sm: 'text-2xl', md: 'text-4xl', lg: 'text-6xl' };
const nameSizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

export default function PlayerAvatar({ player, size = 'md', showName = true }: PlayerAvatarProps) {
  return (
    <div className={`flex flex-col items-center gap-1 ${!player.connected ? 'opacity-40' : ''}`}>
      <span className={sizes[size]}>{player.avatar}</span>
      {showName && (
        <span className={`${nameSizes[size]} font-medium truncate max-w-[80px]`}>{player.name}</span>
      )}
    </div>
  );
}
