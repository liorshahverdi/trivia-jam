import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canStartGame,
  clearAllRooms,
  createRoom,
  disconnectHost,
  disconnectPlayer,
  getRoom,
  isCurrentSocket,
  joinRoom,
  reconnectHost,
  reconnectPlayer,
  setCategories,
  setMode,
} from './roomManager';

function join(code: string, name: string, socketId: string) {
  const result = joinRoom(code, name, socketId);
  if (!result.ok) throw new Error(result.error);
  return result;
}

afterEach(() => {
  clearAllRooms();
  vi.useRealTimers();
});

describe('roomManager lobby validation', () => {
  it('rejects duplicate player names within a room', () => {
    const { room } = createRoom('host-duplicate-name');
    expect(joinRoom(room.code, 'Alice', 'socket-1').ok).toBe(true);
    expect(joinRoom(room.code, ' alice ', 'socket-2')).toEqual({ ok: false, error: 'That name is already taken in this room.' });
  });

  it('rejects over-long and blank names', () => {
    const { room } = createRoom('host');
    expect(joinRoom(room.code, 'x'.repeat(21), 's1').ok).toBe(false);
    expect(joinRoom(room.code, '   ', 's1').ok).toBe(false);
    expect(joinRoom(room.code, 42, 's1').ok).toBe(false);
  });

  it('requires even player counts before starting teams mode', () => {
    const { room } = createRoom('host-odd-teams');
    room.mode = 'teams';
    room.selectedCategories = ['math'];
    join(room.code, 'Alice', 'socket-a');
    join(room.code, 'Bob', 'socket-b');
    join(room.code, 'Cara', 'socket-c');
    expect(canStartGame(room)).toEqual({
      ok: false,
      message: 'Teams mode needs an even number of players. Add or remove one player before starting.',
    });
  });

  it('allows teams mode to start with categories and an even player count', () => {
    const { room } = createRoom('host-even-teams');
    room.mode = 'teams';
    room.selectedCategories = ['math'];
    join(room.code, 'Alice', 'socket-a1');
    join(room.code, 'Bob', 'socket-b1');
    expect(canStartGame(room)).toEqual({ ok: true });
  });

  it('only accepts known modes and categories', () => {
    const { room } = createRoom('host');
    expect(setMode(room, 'chaos')).toBe(false);
    expect(room.mode).toBe('coop');
    setCategories(room, ['math', '../../etc/passwd', 'math', 7]);
    expect(room.selectedCategories).toEqual(['math']);
  });
});

describe('roomManager reconnects', () => {
  it('uses a stable player id and a private token that survives repeated reconnects', () => {
    const { room } = createRoom('host');
    const { player, token } = join(room.code, 'Alice', 'sock-1');
    expect(player.id).not.toBe('sock-1');

    expect(reconnectPlayer(room.code, token, 'sock-2')?.player.id).toBe(player.id);
    expect(reconnectPlayer(room.code, token, 'sock-3')?.player.id).toBe(player.id);
    expect(isCurrentSocket(player.id, 'sock-3')).toBe(true);
  });

  it('does not let someone reconnect with only the public player id', () => {
    const { room } = createRoom('host');
    const { player } = join(room.code, 'Alice', 'sock-1');
    expect(reconnectPlayer(room.code, player.id, 'attacker')).toBeNull();
  });

  it('ignores disconnects from a stale socket after the player reconnected elsewhere', () => {
    const { room } = createRoom('host');
    const { player, token } = join(room.code, 'Alice', 'sock-1');
    reconnectPlayer(room.code, token, 'sock-2');
    expect(disconnectPlayer(player.id, 'sock-1')).toBeNull();
    expect(room.players[0].connected).toBe(true);
  });

  it('removes a disconnected player after the grace period', () => {
    vi.useFakeTimers();
    const { room } = createRoom('host');
    const { player, token } = join(room.code, 'Alice', 'sock-1');
    const onRemoved = vi.fn();
    disconnectPlayer(player.id, 'sock-1', onRemoved);
    expect(room.players[0].connected).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(onRemoved).toHaveBeenCalledOnce();
    expect(room.players).toHaveLength(0);
    expect(reconnectPlayer(room.code, token, 'sock-2')).toBeNull();
  });

  it('lets the host reconnect within the grace period and closes the room after it', () => {
    vi.useFakeTimers();
    const { room, hostToken } = createRoom('host-1');
    const onExpired = vi.fn();
    expect(disconnectHost(room.code, 'host-1', onExpired)).toBe(room);
    expect(room.hostConnected).toBe(false);
    expect(reconnectHost(room.code, 'wrong', 'host-2')).toBeNull();
    expect(reconnectHost(room.code, hostToken, 'host-2')).toBe(room);
    vi.advanceTimersByTime(120_000);
    expect(onExpired).not.toHaveBeenCalled();

    disconnectHost(room.code, 'host-2', onExpired);
    vi.advanceTimersByTime(60_000);
    expect(onExpired).toHaveBeenCalledWith(room);
    expect(getRoom(room.code)).toBe(room); // deletion is the caller's job (it also stops the game)
  });
});
