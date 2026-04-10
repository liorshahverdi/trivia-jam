import type { Room, Player, GameMode, Category, TeamColor } from '@trivia-jam/shared';
import {
  ROOM_CODE_LENGTH,
  MAX_PLAYERS,
  AVATARS,
  QUESTIONS_PER_GAME,
  RECONNECT_GRACE_SECONDS,
} from '@trivia-jam/shared';

const rooms = new Map<string, Room>();
const playerToRoom = new Map<string, string>();
const disconnectTimers = new Map<string, NodeJS.Timeout>();

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

export function createRoom(hostId: string): Room {
  const code = generateCode();
  const room: Room = {
    code,
    hostId,
    players: [],
    phase: 'lobby',
    mode: 'coop',
    selectedCategories: [],
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
  return room;
}

export function joinRoom(code: string, playerName: string, playerId: string): { room: Room; player: Player } | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;
  if (room.players.length >= MAX_PLAYERS) return null;
  if (room.phase !== 'lobby') return null;

  const player: Player = {
    id: playerId,
    name: playerName,
    avatar: pickAvatar(room),
    connected: true,
    score: 0,
    streak: 0,
  };
  room.players.push(player);
  playerToRoom.set(playerId, room.code);
  return { room, player };
}

export function reconnectPlayer(code: string, playerId: string): { room: Room; player: Player } | null {
  const room = rooms.get(code.toUpperCase());
  if (!room) return null;

  const player = room.players.find(p => p.id === playerId);
  if (!player) return null;

  player.connected = true;
  const timer = disconnectTimers.get(playerId);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(playerId);
  }
  playerToRoom.set(playerId, room.code);
  return { room, player };
}

export function disconnectPlayer(playerId: string): { room: Room; player: Player } | null {
  const code = playerToRoom.get(playerId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) return null;

  const player = room.players.find(p => p.id === playerId);
  if (!player) return null;

  player.connected = false;

  const timer = setTimeout(() => {
    room.players = room.players.filter(p => p.id !== playerId);
    playerToRoom.delete(playerId);
    disconnectTimers.delete(playerId);
    if (room.players.length === 0 && room.hostId !== playerId) {
      rooms.delete(room.code);
    }
  }, RECONNECT_GRACE_SECONDS * 1000);

  disconnectTimers.set(playerId, timer);
  return { room, player };
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function getRoomByPlayer(playerId: string): Room | undefined {
  const code = playerToRoom.get(playerId);
  return code ? rooms.get(code) : undefined;
}

export function setMode(code: string, mode: GameMode): Room | undefined {
  const room = rooms.get(code);
  if (room) room.mode = mode;
  return room;
}

export function setCategories(code: string, categories: Category[]): Room | undefined {
  const room = rooms.get(code);
  if (room) room.selectedCategories = categories;
  return room;
}

export function assignTeams(room: Room): void {
  const shuffled = [...room.players].sort(() => Math.random() - 0.5);
  shuffled.forEach((p, i) => {
    p.team = i % 2 === 0 ? 'red' : 'blue';
  });
}

export function resetGame(room: Room): void {
  room.phase = 'lobby';
  room.currentQuestion = null;
  room.questionIndex = 0;
  room.answers = {};
  room.votes = {};
  room.coopScore = 0;
  room.teamScores = { red: 0, blue: 0 };
  room.players.forEach(p => {
    p.score = 0;
    p.streak = 0;
    p.team = undefined;
  });
}

export function removeHost(hostId: string): void {
  for (const [code, room] of rooms) {
    if (room.hostId === hostId) {
      rooms.delete(code);
      room.players.forEach(p => {
        playerToRoom.delete(p.id);
        const t = disconnectTimers.get(p.id);
        if (t) clearTimeout(t);
      });
      break;
    }
  }
}
