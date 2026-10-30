import type { Socket } from 'socket.io';
import type { ClientToServerEvents, Room, ServerToClientEvents } from '@trivia-jam/shared';
import { ClientEvents, ServerEvents } from '@trivia-jam/shared';
import {
  createRoom,
  joinRoom,
  reconnectPlayer,
  reconnectHost,
  disconnectPlayer,
  disconnectHost,
  deleteRoom,
  getRoom,
  isCurrentSocket,
  isHostSocket,
  setMode,
  setCategories,
  setDifficulty,
  resetGame,
  canStartGame,
} from './roomManager.js';
import { notifyAnswersChanged, startGameLoop, stopGame, type GameLoopDeps, type TypedServer } from './gameLoop.js';
import { toRoomState } from './roomState.js';
import { isValidAnswerIndex, recordTeamAnswer, recordVote, tallyVotes } from '../game/answers.js';
import { assignLateTeam } from '../game/TeamManager.js';
import { flagQuestion } from '../game/questionFlags.js';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type Session = { role: 'host'; code: string } | { role: 'player'; code: string; playerId: string } | null;

/** Clients are untrusted: ignore non-function acks instead of throwing. */
function ack<T>(callback: unknown): (res: T) => void {
  return typeof callback === 'function' ? (callback as (res: T) => void) : () => {};
}

function payload(data: unknown): Record<string, unknown> {
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
}

export function setupSocketHandlers(io: TypedServer, gameDeps?: GameLoopDeps): void {
  const closeRoom = (room: Room, message: string) => {
    stopGame(room.code);
    io.to(room.code).emit(ServerEvents.ROOM_CLOSED, { message });
    io.in(room.code).socketsLeave(room.code);
    deleteRoom(room.code);
  };

  io.on('connection', (socket: TypedSocket) => {
    let session: Session = null;

    /** Room this socket currently hosts, or undefined (also rejects stale host tabs). */
    const hostedRoom = (): Room | undefined => {
      if (session?.role !== 'host') return undefined;
      const room = getRoom(session.code);
      return room && isHostSocket(room, socket.id) ? room : undefined;
    };

    /** Room + player id for the live player connection, or undefined. */
    const playerContext = (): { room: Room; playerId: string } | undefined => {
      if (session?.role !== 'player') return undefined;
      const room = getRoom(session.code);
      if (!room || !isCurrentSocket(session.playerId, socket.id)) return undefined;
      return { room, playerId: session.playerId };
    };

    const leaveCurrentSession = () => {
      if (!session) return;
      const previous = session;
      session = null;
      socket.leave(previous.code);
      if (previous.role === 'host') {
        const room = getRoom(previous.code);
        if (room && room.hostId === socket.id) closeRoom(room, 'The host closed the room.');
      } else {
        handlePlayerDisconnect(previous.playerId);
      }
    };

    const handlePlayerDisconnect = (playerId: string) => {
      const result = disconnectPlayer(playerId, socket.id, (room, player) => {
        io.to(room.code).emit(ServerEvents.ROOM_PLAYER_LEFT, { playerId: player.id, name: player.name });
        notifyAnswersChanged(room.code);
      });
      if (!result) return;
      io.to(result.room.code).emit(ServerEvents.ROOM_PLAYER_STATUS, { playerId, connected: false });
      notifyAnswersChanged(result.room.code);
    };

    socket.on(ClientEvents.ROOM_CREATE, (callback) => {
      leaveCurrentSession();
      const { room, hostToken } = createRoom(socket.id);
      session = { role: 'host', code: room.code };
      socket.join(room.code);
      ack(callback)({ code: room.code, hostToken });
      socket.emit(ServerEvents.ROOM_STATE, toRoomState(room));
    });

    socket.on(ClientEvents.ROOM_JOIN, (data, callback) => {
      const { code, name } = payload(data);
      const respond = ack(callback);
      const result = joinRoom(code, name, socket.id);
      if (!result.ok) {
        respond({ error: result.error });
        return;
      }
      leaveCurrentSession();
      session = { role: 'player', code: result.room.code, playerId: result.player.id };
      socket.join(result.room.code);
      respond({ player: result.player, room: toRoomState(result.room), token: result.token });
      socket.to(result.room.code).emit(ServerEvents.ROOM_PLAYER_JOINED, result.player);
    });

    socket.on(ClientEvents.ROOM_RECONNECT, (data, callback) => {
      const { code, token } = payload(data);
      const respond = ack(callback);
      const result = reconnectPlayer(code, token, socket.id);
      if (!result) {
        respond({ error: 'Could not reconnect to that game.' });
        return;
      }
      const { room, player } = result;
      if (!(session?.role === 'player' && session.playerId === player.id)) leaveCurrentSession();
      session = { role: 'player', code: room.code, playerId: player.id };
      socket.join(room.code);
      assignLateTeam(room, player);
      respond({ player, room: toRoomState(room) });
      io.to(room.code).emit(ServerEvents.ROOM_PLAYER_JOINED, player);
      notifyAnswersChanged(room.code);
    });

    socket.on(ClientEvents.ROOM_HOST_RECONNECT, (data, callback) => {
      const { code, hostToken } = payload(data);
      const respond = ack(callback);
      const room = reconnectHost(code, hostToken, socket.id);
      if (!room) {
        respond({ error: 'That room is no longer available.' });
        return;
      }
      if (!(session?.role === 'host' && session.code === room.code)) leaveCurrentSession();
      session = { role: 'host', code: room.code };
      socket.join(room.code);
      respond({ room: toRoomState(room) });
      socket.to(room.code).emit(ServerEvents.ROOM_HOST_STATUS, { connected: true });
    });

    socket.on(ClientEvents.GAME_SET_MODE, (data) => {
      const room = hostedRoom();
      if (!room || room.phase !== 'lobby') return;
      if (setMode(room, payload(data).mode)) {
        io.to(room.code).emit(ServerEvents.GAME_MODE_SET, { mode: room.mode });
      }
    });

    socket.on(ClientEvents.GAME_SET_DIFFICULTY, (data) => {
      const room = hostedRoom();
      if (!room || room.phase !== 'lobby') return;
      if (setDifficulty(room, payload(data).difficulty)) {
        io.to(room.code).emit(ServerEvents.GAME_DIFFICULTY_SET, { difficulty: room.difficulty });
      }
    });

    socket.on(ClientEvents.GAME_SELECT_CATEGORIES, (data) => {
      const room = hostedRoom();
      if (!room || room.phase !== 'lobby') return;
      if (setCategories(room, payload(data).categories)) {
        io.to(room.code).emit(ServerEvents.GAME_CATEGORIES_SET, { categories: room.selectedCategories });
      }
    });

    socket.on(ClientEvents.GAME_START, () => {
      const room = hostedRoom();
      if (!room) return;
      // Blockers go to the whole room so waiting players can see why nothing is happening.
      const validation = canStartGame(room);
      if (!validation.ok) {
        io.to(room.code).emit(ServerEvents.ROOM_ERROR, { message: validation.message });
        return;
      }
      const started = startGameLoop(io, room, gameDeps);
      if (!started.ok) io.to(room.code).emit(ServerEvents.ROOM_ERROR, { message: started.message });
    });

    socket.on(ClientEvents.GAME_ANSWER, (data) => {
      const ctx = playerContext();
      const { answerIndex } = payload(data);
      if (!ctx || ctx.room.phase !== 'question' || ctx.room.mode !== 'teams') return;
      if (!isValidAnswerIndex(answerIndex)) return;
      recordTeamAnswer(ctx.room, ctx.playerId, answerIndex, Date.now());
      notifyAnswersChanged(ctx.room.code);
    });

    socket.on(ClientEvents.GAME_VOTE, (data) => {
      const ctx = playerContext();
      const { answerIndex } = payload(data);
      if (!ctx || ctx.room.phase !== 'question' || ctx.room.mode !== 'coop') return;
      if (!isValidAnswerIndex(answerIndex)) return;
      recordVote(ctx.room, ctx.playerId, answerIndex);
      io.to(ctx.room.code).emit(ServerEvents.GAME_VOTE_UPDATE, { voteCounts: tallyVotes(ctx.room.votes) });
      notifyAnswersChanged(ctx.room.code);
    });

    socket.on(ClientEvents.GAME_PLAY_AGAIN, () => {
      const room = hostedRoom();
      if (!room || room.phase !== 'game_over') return;
      stopGame(room.code);
      resetGame(room);
      io.to(room.code).emit(ServerEvents.ROOM_STATE, toRoomState(room));
    });

    socket.on(ClientEvents.QUESTION_FLAG, (data) => {
      const { questionId, reason } = payload(data);
      if (typeof questionId !== 'string') return;
      const host = hostedRoom();
      const player = playerContext();
      const room = host ?? player?.room;
      // Only questions actually served in this room can be reported.
      if (!room || !room.seenQuestionIds.includes(questionId)) return;
      const reporterId = player ? player.playerId : `host:${room.code}`;
      flagQuestion(questionId, reporterId, typeof reason === 'string' ? reason : undefined);
    });

    socket.on('disconnect', () => {
      if (!session) return;
      if (session.role === 'host') {
        const room = disconnectHost(session.code, socket.id, (expired) => {
          closeRoom(expired, 'The host left the game.');
        });
        if (room) io.to(room.code).emit(ServerEvents.ROOM_HOST_STATUS, { connected: false });
        return;
      }
      handlePlayerDisconnect(session.playerId);
    });
  });
}
