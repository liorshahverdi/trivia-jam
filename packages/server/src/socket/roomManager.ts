import { randomBytes, randomUUID } from 'node:crypto';
import type { Room, Player, GameMode, DifficultySetting } from '@trivia-jam/shared';
import {
  ROOM_CODE_LENGTH,
  MAX_PLAYERS,
  MAX_NAME_LENGTH,
  AVATARS,
  QUESTIONS_PER_GAME,
  RECONNECT_GRACE_SECONDS,
  HOST_RECONNECT_GRACE_SECONDS,
  isCategory,
  isDifficultySetting,
} from '@trivia-jam/shared';

const rooms = new Map<string, Room>();
/** playerId -> room code */
const playerToRoom = new Map<string, string>();
/** playerId -> socket id of the connection currently allowed to act as that player */
const playerSockets = new Map<string, string>();
/** secret reconnect token -> playerId (tokens are never broadcast) */
const playerTokens = new Map<string, string>();
const tokenByPlayer = new Map<string, string>();
/** room code -> secret host reconnect token */
const hostTokens = new Map<string, string>();
const disconnectTimers = new Map<string, NodeJS.Timeout>();
const hostTimers = new Map<string, NodeJS.Timeout>();

function newToken(): string {
  return randomBytes(24).toString('base64url');
}

function normalizeCode(code: unknown): string {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code: string;
  do {
    code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

function pickAvatar(room: Room): string {
  const used = new Set(room.players.map(p => p.avatar));
  return AVATARS.find(a => !used.has(a)) || AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

function clearTimer(map: Map<string, NodeJS.Timeout>, key: string): void {
  const timer = map.get(key);
  if (timer) clearTimeout(timer);
  map.delete(key);
}

function forgetPlayer(playerId: string): void {
  clearTimer(disconnectTimers, playerId);
  playerToRoom.delete(playerId);
  playerSockets.delete(playerId);
  const token = tokenByPlayer.get(playerId);
  if (token) playerTokens.delete(token);
  tokenByPlayer.delete(playerId);
}

export function createRoom(hostSocketId: string): { room: Room; hostToken: string } {
  const code = generateCode();
  const room: Room = {
    code,
    hostId: hostSocketId,
    hostConnected: true,
    players: [],
    phase: 'lobby',
    mode: 'coop',
    selectedCategories: [],
    difficulty: 'mixed',
    seenQuestionIds: [],
    currentQuestion: null,
    questionIndex: 0,
    questionsPerGame: QUESTIONS_PER_GAME,
    answers: {},
    votes: {},
    coopScore: 0,
    teamScores: { red: 0, blue: 0 },
    countdownValue: 0,
  };
  rooms.set(code, room);
  const hostToken = newToken();
  hostTokens.set(code, hostToken);
  return { room, hostToken };
}

export type JoinResult =
  | { ok: true; room: Room; player: Player; token: string }
  | { ok: false; error: string };

export function joinRoom(code: unknown, playerName: unknown, socketId: string): JoinResult {
  const room = rooms.get(normalizeCode(code));
  if (!room) return { ok: false, error: 'Room not found. Check the code and try again.' };
  if (room.phase !== 'lobby') return { ok: false, error: 'That game has already started.' };
  if (room.players.length >= MAX_PLAYERS) return { ok: false, error: 'That room is full.' };

  const trimmedName = typeof playerName === 'string' ? playerName.trim() : '';
  if (!trimmedName) return { ok: false, error: 'Enter a name to join.' };
  if (trimmedName.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Names are limited to ${MAX_NAME_LENGTH} characters.` };
  }
  const normalizedName = trimmedName.toLocaleLowerCase();
  if (room.players.some(p => p.name.trim().toLocaleLowerCase() === normalizedName)) {
    return { ok: false, error: 'That name is already taken in this room.' };
  }

  const player: Player = {
    id: randomUUID(),
    name: trimmedName,
    avatar: pickAvatar(room),
    connected: true,
    score: 0,
    streak: 0,
  };
  const token = newToken();
  room.players.push(player);
  playerToRoom.set(player.id, room.code);
  playerSockets.set(player.id, socketId);
  playerTokens.set(token, player.id);
  tokenByPlayer.set(player.id, token);
  return { ok: true, room, player, token };
}

/** Resume a player seat. Requires the private token issued at join, not the public player id. */
export function reconnectPlayer(code: unknown, token: unknown, socketId: string): { room: Room; player: Player } | null {
  if (typeof token !== 'string') return null;
  const playerId = playerTokens.get(token);
  if (!playerId) return null;
  const room = rooms.get(normalizeCode(code));
  if (!room || playerToRoom.get(playerId) !== room.code) return null;
  const player = room.players.find(p => p.id === playerId);
  if (!player) return null;

  clearTimer(disconnectTimers, playerId);
  player.connected = true;
  playerSockets.set(playerId, socketId);
  return { room, player };
}

/** True when this socket is the live connection for the player (guards stale tabs). */
export function isCurrentSocket(playerId: string, socketId: string): boolean {
  return playerSockets.get(playerId) === socketId;
}

/**
 * Mark a player disconnected and remove them after the grace period.
 * Ignored when the socket is stale (the player already reconnected elsewhere).
 */
export function disconnectPlayer(
  playerId: string,
  socketId: string,
  onRemoved: (room: Room, player: Player) => void = () => {},
): { room: Room; player: Player } | null {
  if (!isCurrentSocket(playerId, socketId)) return null;
  const room = getRoomByPlayer(playerId);
  const player = room?.players.find(p => p.id === playerId);
  if (!room || !player) return null;

  player.connected = false;
  playerSockets.delete(playerId);
  clearTimer(disconnectTimers, playerId);
  disconnectTimers.set(playerId, setTimeout(() => {
    room.players = room.players.filter(p => p.id !== playerId);
    forgetPlayer(playerId);
    onRemoved(room, player);
  }, RECONNECT_GRACE_SECONDS * 1000));

  return { room, player };
}

export function reconnectHost(code: unknown, hostToken: unknown, socketId: string): Room | null {
  const room = rooms.get(normalizeCode(code));
  if (!room || typeof hostToken !== 'string' || hostTokens.get(room.code) !== hostToken) return null;
  clearTimer(hostTimers, room.code);
  room.hostId = socketId;
  room.hostConnected = true;
  return room;
}

/** Start the host grace period. Returns null for stale host sockets. */
export function disconnectHost(code: string, socketId: string, onExpired: (room: Room) => void): Room | null {
  const room = rooms.get(code);
  if (!room || room.hostId !== socketId) return null;
  room.hostConnected = false;
  clearTimer(hostTimers, code);
  hostTimers.set(code, setTimeout(() => {
    hostTimers.delete(code);
    onExpired(room);
  }, HOST_RECONNECT_GRACE_SECONDS * 1000));
  return room;
}

export function isHostSocket(room: Room, socketId: string): boolean {
  return room.hostConnected && room.hostId === socketId;
}

export function deleteRoom(code: string): void {
  const room = rooms.get(code);
  if (!room) return;
  rooms.delete(code);
  hostTokens.delete(code);
  clearTimer(hostTimers, code);
  room.players.forEach(p => forgetPlayer(p.id));
}

export function getRoom(code: unknown): Room | undefined {
  return rooms.get(normalizeCode(code));
}

export function getRoomByPlayer(playerId: string): Room | undefined {
  const code = playerToRoom.get(playerId);
  return code ? rooms.get(code) : undefined;
}

export function setMode(room: Room, mode: unknown): boolean {
  if (mode !== 'coop' && mode !== 'teams') return false;
  room.mode = mode as GameMode;
  return true;
}

export function setDifficulty(room: Room, difficulty: unknown): boolean {
  if (!isDifficultySetting(difficulty)) return false;
  room.difficulty = difficulty as DifficultySetting;
  return true;
}

export function setCategories(room: Room, categories: unknown): boolean {
  if (!Array.isArray(categories)) return false;
  room.selectedCategories = [...new Set(categories.filter(isCategory))];
  return true;
}

export function canStartGame(room: Room): { ok: true } | { ok: false; message: string } {
  if (room.phase !== 'lobby') {
    return { ok: false, message: 'Game has already started.' };
  }
  const connected = room.players.filter(p => p.connected).length;
  if (connected === 0) {
    return { ok: false, message: 'At least one player must join before starting.' };
  }
  if (room.selectedCategories.length === 0) {
    return { ok: false, message: 'Select at least one category to start.' };
  }
  if (room.mode === 'teams' && connected % 2 !== 0) {
    return {
      ok: false,
      message: 'Teams mode needs an even number of players. Add or remove one player before starting.',
    };
  }
  return { ok: true };
}

/** Back to the lobby. Keeps seenQuestionIds so the next game avoids repeats. */
export function resetGame(room: Room): void {
  room.phase = 'lobby';
  room.currentQuestion = null;
  room.questionIndex = 0;
  room.answers = {};
  room.votes = {};
  room.coopScore = 0;
  room.teamScores = { red: 0, blue: 0 };
  room.countdownValue = 0;
  room.questionsPerGame = QUESTIONS_PER_GAME;
  room.players.forEach(p => {
    p.score = 0;
    p.streak = 0;
    p.team = undefined;
  });
}

/** Test helper: drop all rooms and timers. */
export function clearAllRooms(): void {
  for (const code of [...rooms.keys()]) deleteRoom(code);
}
