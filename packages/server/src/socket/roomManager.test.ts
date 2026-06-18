import { describe, expect, it } from 'vitest';
import { canStartGame, createRoom, joinRoom } from './roomManager';

describe('roomManager lobby validation', () => {
  it('rejects duplicate player names within a room', () => {
    const room = createRoom('host-duplicate-name');

    expect(joinRoom(room.code, 'Alice', 'socket-1')).not.toBeNull();
    expect(joinRoom(room.code, ' alice ', 'socket-2')).toBeNull();
  });

  it('requires even player counts before starting teams mode', () => {
    const room = createRoom('host-odd-teams');
    room.mode = 'teams';
    room.selectedCategories = ['math'];
    joinRoom(room.code, 'Alice', 'socket-a');
    joinRoom(room.code, 'Bob', 'socket-b');
    joinRoom(room.code, 'Cara', 'socket-c');

    expect(canStartGame(room)).toEqual({
      ok: false,
      message: 'Teams mode needs an even number of players. Add or remove one player before starting.',
    });
  });

  it('allows teams mode to start with categories and an even player count', () => {
    const room = createRoom('host-even-teams');
    room.mode = 'teams';
    room.selectedCategories = ['math'];
    joinRoom(room.code, 'Alice', 'socket-a1');
    joinRoom(room.code, 'Bob', 'socket-b1');

    expect(canStartGame(room)).toEqual({ ok: true });
  });
});
