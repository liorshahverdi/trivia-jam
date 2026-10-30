import type {
  Category,
  DifficultySetting,
  GameMode,
  GameOverData,
  GamePhase,
  LeaderboardPayload,
  Player,
  QuestionPayload,
  RevealData,
  RoomState,
} from './types.js';

export const ClientEvents = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_RECONNECT: 'room:reconnect',
  ROOM_HOST_RECONNECT: 'room:hostReconnect',
  GAME_SET_MODE: 'game:setMode',
  GAME_SET_DIFFICULTY: 'game:setDifficulty',
  GAME_START: 'game:start',
  GAME_SELECT_CATEGORIES: 'game:selectCategories',
  GAME_ANSWER: 'game:answer',
  GAME_VOTE: 'game:vote',
  GAME_PLAY_AGAIN: 'game:playAgain',
  QUESTION_FLAG: 'question:flag',
} as const;

export const ServerEvents = {
  ROOM_PLAYER_JOINED: 'room:playerJoined',
  ROOM_PLAYER_STATUS: 'room:playerStatus',
  ROOM_PLAYER_LEFT: 'room:playerLeft',
  ROOM_HOST_STATUS: 'room:hostStatus',
  ROOM_STATE: 'room:state',
  ROOM_ERROR: 'room:error',
  ROOM_CLOSED: 'room:closed',
  GAME_PHASE: 'game:phase',
  GAME_MODE_SET: 'game:modeSet',
  GAME_DIFFICULTY_SET: 'game:difficultySet',
  GAME_COUNTDOWN: 'game:countdown',
  GAME_QUESTION: 'game:question',
  GAME_VOTE_UPDATE: 'game:voteUpdate',
  GAME_REVEAL: 'game:reveal',
  GAME_LEADERBOARD: 'game:leaderboard',
  GAME_OVER: 'game:over',
  GAME_CATEGORIES_SET: 'game:categoriesSet',
} as const;

export type ErrorResponse = { error: string };

export type CreateRoomResponse = { code: string; hostToken: string };

/** `token` is a private reconnect secret; never broadcast it to other clients. */
export type JoinRoomResponse = ErrorResponse | { player: Player; room: RoomState; token: string };

export type ReconnectResponse = ErrorResponse | { player: Player; room: RoomState };

export type HostReconnectResponse = ErrorResponse | { room: RoomState };

export interface ClientToServerEvents {
  [ClientEvents.ROOM_CREATE]: (callback: (res: CreateRoomResponse) => void) => void;
  [ClientEvents.ROOM_JOIN]: (data: { code: string; name: string }, callback: (res: JoinRoomResponse) => void) => void;
  [ClientEvents.ROOM_RECONNECT]: (data: { code: string; token: string }, callback: (res: ReconnectResponse) => void) => void;
  [ClientEvents.ROOM_HOST_RECONNECT]: (
    data: { code: string; hostToken: string },
    callback: (res: HostReconnectResponse) => void,
  ) => void;
  [ClientEvents.GAME_SET_MODE]: (data: { mode: GameMode }) => void;
  [ClientEvents.GAME_SET_DIFFICULTY]: (data: { difficulty: DifficultySetting }) => void;
  [ClientEvents.GAME_SELECT_CATEGORIES]: (data: { categories: Category[] }) => void;
  [ClientEvents.GAME_START]: () => void;
  [ClientEvents.GAME_ANSWER]: (data: { answerIndex: number }) => void;
  [ClientEvents.GAME_VOTE]: (data: { answerIndex: number }) => void;
  [ClientEvents.GAME_PLAY_AGAIN]: () => void;
  [ClientEvents.QUESTION_FLAG]: (data: { questionId: string; reason?: string }) => void;
}

export interface ServerToClientEvents {
  [ServerEvents.ROOM_PLAYER_JOINED]: (player: Player) => void;
  [ServerEvents.ROOM_PLAYER_STATUS]: (data: { playerId: string; connected: boolean }) => void;
  [ServerEvents.ROOM_PLAYER_LEFT]: (data: { playerId: string; name: string }) => void;
  [ServerEvents.ROOM_HOST_STATUS]: (data: { connected: boolean }) => void;
  [ServerEvents.ROOM_STATE]: (state: RoomState) => void;
  [ServerEvents.ROOM_ERROR]: (data: { message: string }) => void;
  [ServerEvents.ROOM_CLOSED]: (data: { message: string }) => void;
  [ServerEvents.GAME_PHASE]: (phase: GamePhase) => void;
  [ServerEvents.GAME_MODE_SET]: (data: { mode: GameMode }) => void;
  [ServerEvents.GAME_DIFFICULTY_SET]: (data: { difficulty: DifficultySetting }) => void;
  [ServerEvents.GAME_CATEGORIES_SET]: (data: { categories: Category[] }) => void;
  [ServerEvents.GAME_COUNTDOWN]: (value: number) => void;
  [ServerEvents.GAME_QUESTION]: (data: QuestionPayload) => void;
  [ServerEvents.GAME_VOTE_UPDATE]: (data: { voteCounts: number[] }) => void;
  [ServerEvents.GAME_REVEAL]: (data: RevealData) => void;
  [ServerEvents.GAME_LEADERBOARD]: (data: LeaderboardPayload) => void;
  [ServerEvents.GAME_OVER]: (data: GameOverData) => void;
}
