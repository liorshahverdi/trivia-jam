import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ServerEvents, ClientEvents } from '@trivia-jam/shared';
import { useGameStore } from '../stores/gameStore';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_SERVER_URL || window.location.origin, {
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function useSocket() {
  const store = useGameStore();
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    const s = getSocket();

    s.on('connect', () => {
      storeRef.current.setConnected(true);

      // Auto-reconnect
      const saved = localStorage.getItem('trivia-jam-session');
      if (saved) {
        try {
          const { code, playerId } = JSON.parse(saved);
          if (code && playerId) {
            s.emit(ClientEvents.ROOM_RECONNECT, { code, playerId }, (data: any) => {
              if (!data.error) {
                storeRef.current.setRole('player');
                storeRef.current.setRoomCode(code);
                storeRef.current.setPlayerId(s.id!);
                storeRef.current.setMyPlayer(data.player);
                storeRef.current.restoreState(data.room);
              }
            });
          }
        } catch {}
      }
    });

    s.on('disconnect', () => storeRef.current.setConnected(false));

    s.on(ServerEvents.ROOM_PLAYER_JOINED, (player) => storeRef.current.addPlayer(player));
    s.on(ServerEvents.ROOM_PLAYER_LEFT, ({ playerId }) => storeRef.current.removePlayer(playerId));
    s.on(ServerEvents.ROOM_STATE, (state) => storeRef.current.restoreState(state));
    s.on(ServerEvents.ROOM_ERROR, ({ message }) => console.error('Room error:', message));

    s.on(ServerEvents.GAME_PHASE, (phase) => storeRef.current.setPhase(phase));
    s.on(ServerEvents.GAME_MODE_SET, ({ mode }) => storeRef.current.setMode(mode));
    s.on(ServerEvents.GAME_CATEGORIES_SET, ({ categories }) => storeRef.current.setCategories(categories));
    s.on(ServerEvents.GAME_COUNTDOWN, (value) => storeRef.current.setCountdown(value));

    s.on(ServerEvents.GAME_QUESTION, ({ question, index, total, timeSeconds }) =>
      storeRef.current.setQuestion(question, index, total, timeSeconds)
    );

    s.on(ServerEvents.GAME_VOTE_UPDATE, ({ voteCounts }) => storeRef.current.setVoteCounts(voteCounts));
    s.on(ServerEvents.GAME_REVEAL, (data) => storeRef.current.setRevealData(data));

    s.on(ServerEvents.GAME_LEADERBOARD, ({ players, teamScores, coopScore }) =>
      storeRef.current.setLeaderboard(players, teamScores, coopScore)
    );

    s.on(ServerEvents.GAME_OVER, (data) => storeRef.current.setGameOver(data));

    return () => {
      s.removeAllListeners();
    };
  }, []);

  const createRoom = useCallback(() => {
    const s = getSocket();
    s.emit(ClientEvents.ROOM_CREATE, (data: any) => {
      store.setRole('host');
      store.setRoomCode(data.code);
    });
  }, [store]);

  const joinRoom = useCallback(
    (code: string, name: string) => {
      const s = getSocket();
      s.emit(ClientEvents.ROOM_JOIN, { code, name }, (data: any) => {
        if (data.error) {
          alert(data.error);
          return;
        }
        store.setRole('player');
        store.setRoomCode(data.room.code);
        store.setPlayerId(s.id!);
        store.setMyPlayer(data.player);
        store.restoreState(data.room);

        localStorage.setItem(
          'trivia-jam-session',
          JSON.stringify({ code: data.room.code, playerId: s.id })
        );
      });
    },
    [store]
  );

  const setMode = useCallback((mode: string) => {
    getSocket().emit(ClientEvents.GAME_SET_MODE, { mode });
  }, []);

  const selectCategories = useCallback((categories: string[]) => {
    getSocket().emit(ClientEvents.GAME_SELECT_CATEGORIES, { categories });
  }, []);

  const startGame = useCallback(() => {
    getSocket().emit(ClientEvents.GAME_START);
  }, []);

  const submitAnswer = useCallback(
    (answerIndex: number) => {
      const s = getSocket();
      const mode = useGameStore.getState().mode;
      if (mode === 'coop') {
        s.emit(ClientEvents.GAME_VOTE, { answerIndex });
      } else {
        s.emit(ClientEvents.GAME_ANSWER, { answerIndex });
      }
      store.setMyAnswer(answerIndex);
    },
    [store]
  );

  const playAgain = useCallback(() => {
    getSocket().emit(ClientEvents.GAME_PLAY_AGAIN);
  }, []);

  return { createRoom, joinRoom, setMode, selectCategories, startGame, submitAnswer, playAgain };
}
