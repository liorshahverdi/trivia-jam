import { useEffect, useState } from 'react';
import { useGameStore } from './stores/gameStore';
import { useSocket } from './hooks/useSocket';
import { useSoundEffects } from './hooks/useSoundEffects';

// Host screens
import HostLobbyScreen from './screens/host/HostLobbyScreen';
import HostCategoryScreen from './screens/host/HostCategoryScreen';
import HostQuestionScreen from './screens/host/HostQuestionScreen';
import HostResultsScreen from './screens/host/HostResultsScreen';
import HostLeaderboard from './screens/host/HostLeaderboard';
import HostFinalScreen from './screens/host/HostFinalScreen';

// Player screens
import PlayerJoinScreen from './screens/player/PlayerJoinScreen';
import PlayerLobbyScreen from './screens/player/PlayerLobbyScreen';
import PlayerCategoryScreen from './screens/player/PlayerCategoryScreen';
import PlayerAnswerScreen from './screens/player/PlayerAnswerScreen';
import PlayerResultScreen from './screens/player/PlayerResultScreen';
import PlayerFinalScreen from './screens/player/PlayerFinalScreen';

function HostAudio() {
  const { unlock } = useSoundEffects();
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (unlocked) return;

    const handle = () => {
      unlock();
      setUnlocked(true);
      document.removeEventListener('click', handle);
      document.removeEventListener('touchstart', handle);
    };

    document.addEventListener('click', handle);
    document.addEventListener('touchstart', handle);
    return () => {
      document.removeEventListener('click', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, [unlock, unlocked]);

  return null;
}

export default function App() {
  const { role, phase } = useGameStore();
  const { createRoom, joinRoom, setMode, selectCategories, startGame, submitAnswer, playAgain } =
    useSocket();

  if (role === 'none') {
    return <PlayerJoinScreen createRoom={createRoom} joinRoom={joinRoom} />;
  }

  if (role === 'host') {
    return (
      <>
        <HostAudio />
        {(() => {
          switch (phase) {
            case 'lobby':
              return (
                <HostLobbyScreen
                  setMode={setMode}
                  selectCategories={selectCategories}
                  startGame={startGame}
                />
              );
            case 'category_select':
              return <HostCategoryScreen />;
            case 'countdown':
            case 'question':
              return <HostQuestionScreen />;
            case 'reveal':
              return <HostResultsScreen />;
            case 'leaderboard':
              return <HostLeaderboard />;
            case 'game_over':
              return <HostFinalScreen playAgain={playAgain} />;
            default:
              return (
                <HostLobbyScreen
                  setMode={setMode}
                  selectCategories={selectCategories}
                  startGame={startGame}
                />
              );
          }
        })()}
      </>
    );
  }

  // Player role
  switch (phase) {
    case 'lobby':
      return <PlayerLobbyScreen />;
    case 'category_select':
      return <PlayerCategoryScreen />;
    case 'countdown':
    case 'question':
      return <PlayerAnswerScreen submitAnswer={submitAnswer} />;
    case 'reveal':
    case 'leaderboard':
      return <PlayerResultScreen />;
    case 'game_over':
      return <PlayerFinalScreen />;
    default:
      return <PlayerLobbyScreen />;
  }
}
