import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import {
  ClientEvents,
  ServerEvents,
  type ClientToServerEvents,
  type CreateRoomResponse,
  type JoinRoomResponse,
  type ServerToClientEvents,
} from '@trivia-jam/shared';
import { setupSocketHandlers } from './handler';
import { clearAllRooms, getRoom } from './roomManager';

type Client = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

let url = '';
let ioServer: Server<ClientToServerEvents, ServerToClientEvents>;
const clients: Client[] = [];

beforeAll(async () => {
  const http = createServer();
  ioServer = new Server(http);
  setupSocketHandlers(ioServer);
  await new Promise<void>((resolve) => http.listen(0, resolve));
  url = `http://localhost:${(http.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => ioServer.close(() => resolve())));

afterEach(() => {
  clients.splice(0).forEach((c) => c.disconnect());
  clearAllRooms();
});

async function client(): Promise<Client> {
  const c: Client = connect(url, { transports: ['websocket'], forceNew: true });
  clients.push(c);
  await new Promise<void>((resolve) => c.on('connect', () => resolve()));
  return c;
}

const createRoom = (c: Client) =>
  new Promise<CreateRoomResponse>((resolve) => c.emit(ClientEvents.ROOM_CREATE, resolve));
const joinRoom = (c: Client, code: string, name: string) =>
  new Promise<JoinRoomResponse>((resolve) => c.emit(ClientEvents.ROOM_JOIN, { code, name }, resolve));
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

describe('socket handler', () => {
  it('only lets the host change lobby settings', async () => {
    const host = await client();
    const player = await client();
    const { code } = await createRoom(host);
    await joinRoom(player, code, 'Mallory');

    player.emit(ClientEvents.GAME_SET_MODE, { mode: 'teams' });
    player.emit(ClientEvents.GAME_SELECT_CATEGORIES, { categories: ['math'] });
    await tick();
    expect(getRoom(code)?.mode).toBe('coop');
    expect(getRoom(code)?.selectedCategories).toEqual([]);

    host.emit(ClientEvents.GAME_SELECT_CATEGORIES, { categories: ['math', '../../../package'] as never });
    host.emit(ClientEvents.GAME_SET_DIFFICULTY, { difficulty: 'hard' });
    await tick();
    expect(getRoom(code)?.selectedCategories).toEqual(['math']);
    expect(getRoom(code)?.difficulty).toBe('hard');
  });

  it('survives malformed payloads without crashing', async () => {
    const c = await client();
    (c as unknown as { emit: (...a: unknown[]) => void }).emit(ClientEvents.ROOM_JOIN, null, 'not-a-function');
    (c as unknown as { emit: (...a: unknown[]) => void }).emit(ClientEvents.GAME_VOTE);
    await tick();
    expect(c.connected).toBe(true);
  });

  it('reconnects a player more than once with the private token, never the public id', async () => {
    const host = await client();
    const { code } = await createRoom(host);
    const first = await client();
    const joined = await joinRoom(first, code, 'Alice');
    if ('error' in joined) throw new Error(joined.error);
    expect(JSON.stringify(joined.room)).not.toContain(joined.token);

    for (let i = 0; i < 2; i++) {
      const next = await client();
      const res = await new Promise<unknown>((resolve) =>
        next.emit(ClientEvents.ROOM_RECONNECT, { code, token: joined.token }, resolve));
      expect(res).toMatchObject({ player: { id: joined.player.id, connected: true } });
    }

    const attacker = await client();
    const hijack = await new Promise<unknown>((resolve) =>
      attacker.emit(ClientEvents.ROOM_RECONNECT, { code, token: joined.player.id }, resolve));
    expect(hijack).toEqual({ error: expect.any(String) });
    expect(getRoom(code)?.players).toHaveLength(1);
  });

  it('keeps the room through a host refresh and restores the host', async () => {
    const host = await client();
    const { code, hostToken } = await createRoom(host);
    const player = await client();
    await joinRoom(player, code, 'Alice');
    const statuses: boolean[] = [];
    player.on(ServerEvents.ROOM_HOST_STATUS, ({ connected }) => statuses.push(connected));

    host.disconnect();
    await tick();
    expect(getRoom(code)?.hostConnected).toBe(false);

    const host2 = await client();
    const res = await new Promise<unknown>((resolve) =>
      host2.emit(ClientEvents.ROOM_HOST_RECONNECT, { code, hostToken }, resolve));
    expect(res).toMatchObject({ room: { code, hostConnected: true } });
    await tick();
    expect(statuses).toEqual([false, true]);

    host2.emit(ClientEvents.GAME_SET_MODE, { mode: 'teams' });
    await tick();
    expect(getRoom(code)?.mode).toBe('teams');
  });

  it('shares start-game blockers with the whole room', async () => {
    const host = await client();
    const { code } = await createRoom(host);
    const player = await client();
    await joinRoom(player, code, 'Alice');
    const hostErrors: string[] = [];
    const playerErrors: string[] = [];
    host.on(ServerEvents.ROOM_ERROR, ({ message }) => hostErrors.push(message));
    player.on(ServerEvents.ROOM_ERROR, ({ message }) => playerErrors.push(message));
    host.emit(ClientEvents.GAME_START);
    await tick();
    expect(hostErrors).toEqual(['Select at least one category to start.']);
    expect(playerErrors).toEqual(['Select at least one category to start.']);
  });
});
