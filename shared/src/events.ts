import { ClientGameState, ErrorPayload } from './types.js';

export const EVT = {
  // client -> server
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_REJOIN: 'room:rejoin',
  GAME_START: 'game:start',
  TURN_DRAW_STOCK: 'turn:drawStock',
  TURN_DRAW_DISCARD: 'turn:drawDiscard',
  TURN_MELD: 'turn:meld',
  TURN_LAYOFF: 'turn:layOff',
  TURN_DISCARD: 'turn:discard',
  TURN_CALL_RUMMY: 'turn:callRummy',
  NEXT_ROUND: 'game:nextRound',
  CHAT: 'chat:message',

  // server -> client
  STATE_UPDATE: 'state:update',
  ROOM_JOINED: 'room:joined',
  ERROR: 'error',
  ROOM_CLOSED: 'room:closed',
  TOAST: 'toast',
} as const;

export interface RoomCreatePayload {
  name: string;
  winningScore?: number;
  rummyWindowMs?: number;
  aceHigh?: boolean;
  simplifiedScoring?: boolean;
  numDecks?: number;
  startingHandSize?: number;
  boathouseRule?: boolean;
}
export interface RoomJoinPayload { roomCode: string; name: string; }
export interface RoomRejoinPayload { roomCode: string; playerId: string; }
export interface RoomJoinedPayload { roomCode: string; playerId: string; }

export interface DrawDiscardPayload {
  /** How many cards to take from the top of the discard. 1 = just the top card. */
  depth: number;
  /** The card ids (from hand + the taken top discard card) that will form the meld
   *  using the bottommost (deepest) taken card. */
  meldCardIds: string[];
  /** Optional existing meld to attach to (lay-off); otherwise a new meld is started. */
  targetMeldId?: string;
}
export interface MeldPayload {
  cardIds: string[];
  /** If provided, lay off onto an existing meld (cardIds must form a valid extension). */
  targetMeldId?: string;
}
export interface LayOffPayload { cardId: string; meldId: string; }
export interface DiscardPayload { cardId: string; }
export interface CallRummyPayload { meldId: string; cardId?: string; }
export interface ChatPayload { text: string; }
export interface ToastPayload { kind: 'info' | 'success' | 'warn' | 'error'; text: string; }

export type StateUpdatePayload = ClientGameState;
export type ErrorEvent = ErrorPayload;
