export type Suit = 'H' | 'D' | 'C' | 'S';
export type Rank =
  | 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export const SUITS: Suit[] = ['H', 'D', 'C', 'S'];
export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export interface Card {
  /** Stable identity: `${suit}-${rank}-${deckCopy}`. Single-deck variant always uses copy=1. */
  id: string;
  suit: Suit;
  rank: Rank;
}

export type MeldKind = 'set' | 'run';

export interface MeldCard {
  card: Card;
  placedBy: string;
}

export interface Meld {
  id: string;
  ownerId: string;
  kind: MeldKind;
  cards: MeldCard[];
}

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  hand: Card[];
  totalScore: number;
  /** Score earned in current round (positive from melded cards). Reset each round. */
  roundMeldScore: number;
}

export type Phase =
  | 'lobby'
  | 'draw'
  | 'meld'
  | 'discard'
  | 'rummyWindow'
  | 'roundEnd'
  | 'gameEnd';

export interface RoomOptions {
  winningScore: number;
  rummyWindowMs: number;
  /** If true, ace can be high in runs (e.g. Q-K-A). Default false. */
  aceHigh: boolean;
  /** Simplified vs face-value scoring:
   *    false (default, "regular"): 2-9 = face value (2, 3, ..., 9), 10/J/Q/K = 10, Ace = 1 in low run / 15 elsewhere.
   *    true ("simplified"):        2-9 = flat 5,                10/J/Q/K = 10, Ace = 5 in low run / 15 elsewhere. */
  simplifiedScoring: boolean;
  /** How many full 52-card decks to shuffle together. 1 or 2. Default 1. */
  numDecks: number;
  /** Cards dealt per player at the start of each round. 0 = automatic (13 for 2 players, 7 for 3+). */
  startingHandSize: number;
}

export const DEFAULT_OPTIONS: RoomOptions = {
  winningScore: 500,
  rummyWindowMs: 3000,
  aceHigh: false,
  simplifiedScoring: false,
  numDecks: 1,
  startingHandSize: 0,
};

export interface GameState {
  roomCode: string;
  hostId: string;
  players: Player[];
  turnIndex: number;
  phase: Phase;
  /** Full deck of remaining stock. Hidden from clients. */
  stock: Card[];
  /** Discard pile. Top = last index. */
  discard: Card[];
  melds: Meld[];
  roundNumber: number;
  winningScore: number;
  aceHigh: boolean;
  simplifiedScoring: boolean;
  numDecks: number;
  startingHandSize: number;
  /** Timestamp (ms) of the most recent discard, used for the rummy-call window. */
  lastDiscardAt?: number;
  /** Length (ms) of the rummy call window after each discard. */
  rummyWindowMs: number;
  /** End-of-round / end-of-game summary, present when phase === 'roundEnd' or 'gameEnd'. */
  lastRoundSummary?: RoundSummary;
  /** Set once a winner is determined. */
  winnerId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RoundSummary {
  roundNumber: number;
  wentOut: string | null; // playerId, or null if stock ran out
  perPlayer: {
    playerId: string;
    name: string;
    meldPoints: number;
    handPenalty: number;
    delta: number; // meldPoints - handPenalty (0 penalty if stock ran out)
    totalScore: number;
  }[];
}

/** Redacted view sent to a single client. */
export interface ClientGameState {
  roomCode: string;
  hostId: string;
  you: { id: string; hand: Card[] };
  players: Array<{
    id: string;
    name: string;
    connected: boolean;
    handCount: number;
    totalScore: number;
    roundMeldScore: number;
  }>;
  turnIndex: number;
  phase: Phase;
  stockCount: number;
  discard: Card[];
  melds: Meld[];
  roundNumber: number;
  winningScore: number;
  aceHigh: boolean;
  simplifiedScoring: boolean;
  numDecks: number;
  startingHandSize: number;
  lastDiscardAt?: number;
  rummyWindowMs: number;
  lastRoundSummary?: RoundSummary;
  winnerId?: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
}
