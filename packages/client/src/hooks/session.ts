/**
 * Persisted reconnect credentials. Tokens are private secrets issued by the
 * server; the public player id is never enough to resume a seat.
 */
export type SavedSession =
  | { role: 'player'; code: string; token: string }
  | { role: 'host'; code: string; hostToken: string };

const SESSION_KEY = 'trivia-jam-session';

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedSession> & Record<string, unknown>;
    if (typeof parsed.code !== 'string') return null;
    if (parsed.role === 'player' && typeof parsed.token === 'string') {
      return { role: 'player', code: parsed.code, token: parsed.token };
    }
    if (parsed.role === 'host' && typeof parsed.hostToken === 'string') {
      return { role: 'host', code: parsed.code, hostToken: parsed.hostToken };
    }
  } catch {
    // fall through: corrupt or legacy ({ code, playerId }) sessions are discarded
  }
  clearSession();
  return null;
}

export function saveSession(session: SavedSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
