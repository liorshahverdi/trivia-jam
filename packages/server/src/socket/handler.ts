import type { Server, Socket } from 'socket.io';
import type { GameMode, Category } from '@trivia-jam/shared';
import { ClientEvents, ServerEvents } from '@trivia-jam/shared';
import {
  createRoom,
  joinRoom,
  reconnectPlayer,
  disconnectPlayer,
  getRoom,
  setMode,
  setCategories,
  resetGame,
  removeHost,
} from './roomManager.js';
import { startGameLoop } from './gameLoop.js';

export function setupSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    let currentRoomCode: string | null = null;
    let isHost = false;

    // Host creates room
    socket.on(ClientEvents.ROOM_CREATE, (callback: (data: any) => void) => {
      const room = createRoom(socket.id);
      currentRoomCode = room.code;
      isHost = true;
      socket.join(room.code);
      callback({ code: room.code });
      socket.emit(ServerEvents.ROOM_CREATED, { code: room.code });
    });

    // Player joins room
    socket.on(
      ClientEvents.ROOM_JOIN,
      ({ code, name }: { code: string; name: string }, callback: (data: any) => void) => {
        const result = joinRoom(code, name, socket.id);
        if (!result) {
          callback({ error: 'Room not found, full, or game already started' });
          return;
        }
        currentRoomCode = result.room.code;
        socket.join(result.room.code);
        callback({ player: result.player, room: buildClientState(result.room) });
        socket.emit(ServerEvents.ROOM_JOINED, {
          player: result.player,
          room: buildClientState(result.room),
        });
        socket.to(result.room.code).emit(ServerEvents.ROOM_PLAYER_JOINED, result.player);
      }
    );

    // Player reconnects
    socket.on(
      ClientEvents.ROOM_RECONNECT,
      ({ code, playerId }: { code: string; playerId: string }, callback: (data: any) => void) => {
        const result = reconnectPlayer(code, playerId, socket.id);
        if (!result) {
          callback({ error: 'Could not reconnect' });
          return;
        }
        currentRoomCode = result.room.code;
        socket.join(result.room.code);
        callback({ player: result.player, room: buildClientState(result.room) });
        socket.to(result.room.code).emit(ServerEvents.ROOM_PLAYER_JOINED, result.player);
      }
    );

    // Set game mode
    socket.on(ClientEvents.GAME_SET_MODE, ({ mode }: { mode: GameMode }) => {
      if (!currentRoomCode) return;
      const room = setMode(currentRoomCode, mode);
      if (room) {
        io.to(room.code).emit(ServerEvents.GAME_MODE_SET, { mode });
      }
    });

    // Select categories
    socket.on(ClientEvents.GAME_SELECT_CATEGORIES, ({ categories }: { categories: Category[] }) => {
      if (!currentRoomCode) return;
      const room = setCategories(currentRoomCode, categories);
      if (room) {
        io.to(room.code).emit(ServerEvents.GAME_CATEGORIES_SET, { categories });
      }
    });

    // Start game
    socket.on(ClientEvents.GAME_START, () => {
      if (!currentRoomCode || !isHost) return;
      const room = getRoom(currentRoomCode);
      if (!room || room.phase !== 'lobby') return;
      startGameLoop(io, room);
    });

    // Player submits answer (teams mode)
    socket.on(ClientEvents.GAME_ANSWER, ({ answerIndex }: { answerIndex: number }) => {
      if (!currentRoomCode) return;
      const room = getRoom(currentRoomCode);
      if (!room || room.phase !== 'question') return;
      // Allow changing answer — keep original timestamp if already answered
      const existing = room.answers[socket.id];
      room.answers[socket.id] = {
        playerId: socket.id,
        answerIndex,
        timestamp: existing?.timestamp ?? Date.now(),
      };
    });

    // Player votes (coop mode)
    socket.on(ClientEvents.GAME_VOTE, ({ answerIndex }: { answerIndex: number }) => {
      if (!currentRoomCode) return;
      const room = getRoom(currentRoomCode);
      if (!room || room.phase !== 'question') return;

      room.votes[socket.id] = answerIndex;

      // Broadcast live vote update
      const voteCounts = [0, 0, 0, 0];
      for (const idx of Object.values(room.votes)) {
        if (idx >= 0 && idx <= 3) voteCounts[idx]++;
      }
      io.to(room.code).emit(ServerEvents.GAME_VOTE_UPDATE, { voteCounts });
    });

    // Play again
    socket.on(ClientEvents.GAME_PLAY_AGAIN, () => {
      if (!currentRoomCode || !isHost) return;
      const room = getRoom(currentRoomCode);
      if (!room) return;
      resetGame(room);
      io.to(room.code).emit(ServerEvents.ROOM_STATE, buildClientState(room));
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (isHost && currentRoomCode) {
        removeHost(socket.id);
        io.to(currentRoomCode).emit(ServerEvents.ROOM_ERROR, { message: 'Host disconnected' });
        return;
      }

      const result = disconnectPlayer(socket.id);
      if (result) {
        io.to(result.room.code).emit(ServerEvents.ROOM_PLAYER_LEFT, {
          playerId: socket.id,
          name: result.player.name,
        });
      }
    });
  });
}

function buildClientState(room: any) {
  return {
    code: room.code,
    players: room.players,
    phase: room.phase,
    mode: room.mode,
    selectedCategories: room.selectedCategories,
    currentQuestion: room.currentQuestion
      ? (() => { const { correctIndex, ...rest } = room.currentQuestion; return rest; })()
      : null,
    questionIndex: room.questionIndex,
    questionsPerGame: room.questionsPerGame,
    votes: {},
    coopScore: room.coopScore,
    teamScores: room.teamScores,
    countdownValue: room.countdownValue,
  };
}
