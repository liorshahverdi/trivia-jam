import { useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ServerEvents,
  ClientEvents,
  type Category,
  type ClientToServerEvents,
  type DifficultySetting,
  type GameMode,
  type ServerToClientEvents,
} from '@trivia-jam/shared';
import { useGameStore } from '../stores/gameStore';
import { clearSession, loadSession, saveSession } from './session';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

export function getSocket(): GameSocket {
  if (!socket) {
    socket = io(import.meta.env.VITE_SERVER_URL || window.location.origin, {
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

const store = () => useGameStore.getState();

/** Re-attach to a saved host or player seat after a refresh or network blip. */
function resumeSession(s: GameSocket): void {
  const saved = loadSession();
  if (!saved) return;

  const fail = () => {
    clearSession();
    // Only surface the failure if the user was mid-game in this tab.
    if (store().role !== 'none') store().leaveRoom('That game has ended or is no longer available.');
  };

  if (saved.role === 'host') {
    s.emit(ClientEvents.ROOM_HOST_RECONNECT, { code: saved.code, hostToken: saved.hostToken }, (res) => {
      if ('error' in res) return fail();
      store().setRole('host');
      store().setRoomCode(res.room.code);
      store().restoreState(res.room);
    });
    return;
  }

  s.emit(ClientEvents.ROOM_RECONNECT, { code: saved.code, token: saved.token }, (res) => {
    if ('error' in res) return fail();
    store().setRole('player');
    store().setRoomCode(res.room.code);
    store().setPlayerId(res.player.id);
    store().setMyPlayer(res.player);
    store().restoreState(res.room);
  });
}

export function useSocket() {
  useEffect(() => {
    const s = getSocket();

    s.on('connect', () => {
      store().setConnected(true);
      resumeSession(s);
    });
    s.on('disconnect', () => store().setConnected(false));
    if (s.connected) store().setConnected(true);

    s.on(ServerEvents.ROOM_PLAYER_JOINED, (player) => store().addPlayer(player));
    s.on(ServerEvents.ROOM_PLAYER_STATUS, ({ playerId, connected }) => store().setPlayerConnected(playerId, connected));
    s.on(ServerEvents.ROOM_PLAYER_LEFT, ({ playerId }) => store().removePlayer(playerId));
    s.on(ServerEvents.ROOM_HOST_STATUS, ({ connected }) => store().setHostConnected(connected));
    s.on(ServerEvents.ROOM_STATE, (state) => store().restoreState(state));
    s.on(ServerEvents.ROOM_ERROR, ({ message }) => store().setRoomError(message));
    s.on(ServerEvents.ROOM_CLOSED, ({ message }) => {
      clearSession();
      store().leaveRoom(message);
    });

    s.on(ServerEvents.GAME_PHASE, (phase) => store().setPhase(phase));
    s.on(ServerEvents.GAME_MODE_SET, ({ mode }) => store().setMode(mode));
    s.on(ServerEvents.GAME_DIFFICULTY_SET, ({ difficulty }) => store().setDifficulty(difficulty));
    s.on(ServerEvents.GAME_CATEGORIES_SET, ({ categories }) => store().setCategories(categories));
    s.on(ServerEvents.GAME_COUNTDOWN, (value) => store().setCountdown(value));
    s.on(ServerEvents.GAME_QUESTION, ({ question, index, total, timeSeconds }) =>
      store().setQuestion(question, index, total, timeSeconds),
    );
    s.on(ServerEvents.GAME_VOTE_UPDATE, ({ voteCounts }) => store().setVoteCounts(voteCounts));
    s.on(ServerEvents.GAME_REVEAL, (data) => store().setRevealData(data));
    s.on(ServerEvents.GAME_LEADERBOARD, ({ players, teamScores, coopScore }) =>
      store().setLeaderboard(players, teamScores, coopScore),
    );
    s.on(ServerEvents.GAME_OVER, (data) => store().setGameOver(data));

    return () => {
      s.removeAllListeners();
    };
  }, []);

  const createRoom = useCallback(() => {
    getSocket().emit(ClientEvents.ROOM_CREATE, ({ code, hostToken }) => {
      store().setRoomError(null);
      store().setRole('host');
      store().setRoomCode(code);
      saveSession({ role: 'host', code, hostToken });
    });
  }, []);

  const joinRoom = useCallback((code: string, name: string) => {
    getSocket().emit(ClientEvents.ROOM_JOIN, { code, name }, (res) => {
      if ('error' in res) {
        store().setRoomError(res.error);
        return;
      }
      store().setRoomError(null);
      store().setRole('player');
      store().setRoomCode(res.room.code);
      store().setPlayerId(res.player.id);
      store().setMyPlayer(res.player);
      store().restoreState(res.room);
      saveSession({ role: 'player', code: res.room.code, token: res.token });
    });
  }, []);

  const setMode = useCallback((mode: GameMode) => {
    getSocket().emit(ClientEvents.GAME_SET_MODE, { mode });
  }, []);

  const setDifficulty = useCallback((difficulty: DifficultySetting) => {
    getSocket().emit(ClientEvents.GAME_SET_DIFFICULTY, { difficulty });
  }, []);

  const selectCategories = useCallback((categories: Category[]) => {
    getSocket().emit(ClientEvents.GAME_SELECT_CATEGORIES, { categories });
  }, []);

  const startGame = useCallback(() => {
    getSocket().emit(ClientEvents.GAME_START);
  }, []);

  const submitAnswer = useCallback((answerIndex: number) => {
    const s = getSocket();
    if (store().mode === 'coop') {
      s.emit(ClientEvents.GAME_VOTE, { answerIndex });
    } else {
      s.emit(ClientEvents.GAME_ANSWER, { answerIndex });
    }
    store().setMyAnswer(answerIndex);
  }, []);

  const playAgain = useCallback(() => {
    getSocket().emit(ClientEvents.GAME_PLAY_AGAIN);
  }, []);

  const flagQuestion = useCallback((questionId: string, reason?: string) => {
    getSocket().emit(ClientEvents.QUESTION_FLAG, { questionId, reason });
  }, []);

  return {
    createRoom,
    joinRoom,
    setMode,
    setDifficulty,
    selectCategories,
    startGame,
    submitAnswer,
    playAgain,
    flagQuestion,
  };
}
