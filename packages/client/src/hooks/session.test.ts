import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, loadSession, saveSession } from './session';

describe('saved session', () => {
  beforeEach(() => {
    // Newer Node versions ship a partial global localStorage that shadows jsdom's; use a clean in-memory one.
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, String(value)),
      removeItem: (key: string) => void data.delete(key),
      clear: () => data.clear(),
    });
  });

  it('round-trips player and host sessions', () => {
    saveSession({ role: 'player', code: 'ABCD', token: 'secret' });
    expect(loadSession()).toEqual({ role: 'player', code: 'ABCD', token: 'secret' });
    saveSession({ role: 'host', code: 'WXYZ', hostToken: 'host-secret' });
    expect(loadSession()).toEqual({ role: 'host', code: 'WXYZ', hostToken: 'host-secret' });
    clearSession();
    expect(loadSession()).toBeNull();
  });

  it('discards legacy { code, playerId } sessions that relied on public ids', () => {
    localStorage.setItem('trivia-jam-session', JSON.stringify({ code: 'ABCD', playerId: 'socket-id' }));
    expect(loadSession()).toBeNull();
    expect(localStorage.getItem('trivia-jam-session')).toBeNull();
  });

  it('discards corrupt sessions', () => {
    localStorage.setItem('trivia-jam-session', '{nope');
    expect(loadSession()).toBeNull();
  });
});
