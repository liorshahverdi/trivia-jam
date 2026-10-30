import { useEffect, useState } from 'react';
import { useGameStore } from '../stores/gameStore';

/** How long to wait before assuming the free-tier server is cold-starting. */
export const COLD_START_HINT_DELAY_MS = 1500;

/**
 * Connection + host-presence notices shown above every screen:
 * - first load with no socket yet → the free Render instance is probably waking up
 * - lost connection mid-game → we're auto-reconnecting
 * - player view while the host's screen is away → wait for them
 */
export default function StatusBanners() {
  const connected = useGameStore((s) => s.connected);
  const role = useGameStore((s) => s.role);
  const hostConnected = useGameStore((s) => s.hostConnected);
  const [showColdStart, setShowColdStart] = useState(false);

  useEffect(() => {
    if (connected) {
      setShowColdStart(false);
      return;
    }
    const timer = setTimeout(() => setShowColdStart(true), COLD_START_HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [connected]);

  let message: string | null = null;
  if (!connected && role !== 'none') {
    message = 'Connection lost — reconnecting…';
  } else if (!connected && showColdStart) {
    message = 'Waking up the game server… free hosting can take up to a minute on first load.';
  } else if (connected && role === 'player' && !hostConnected) {
    message = 'The host’s screen disconnected — hang tight while they reconnect.';
  }

  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-jam-yellow/90 px-4 py-2 text-center text-sm font-semibold text-jam-dark shadow-lg"
    >
      {!connected && <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-jam-dark border-t-transparent" />}
      {message}
    </div>
  );
}
