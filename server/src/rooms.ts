import {
  buildDeck,
  cardsPerPlayerFor,
  ClientGameState,
  computeRoundSummary,
  deal,
  determineWinner,
  GameState,
  inferMeldKind,
  insertIntoMeld,
  canLayOff,
  Meld,
  Player,
  pickCardsByIds,
  redactFor,
  removeCardsFromHand,
  RoomOptions,
  shuffle,
} from '@rummy/shared';
import { generateMeldId, generatePlayerId, generateRoomCode } from './lib/ids.js';

const MAX_PLAYERS = 6;
const MIN_PLAYERS = 2;
const DEFAULT_RUMMY_WINDOW_MS = 3000;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours of inactivity
const RECONNECT_TTL_MS = 2 * 60 * 1000; // 2 minutes seat-hold

function clampScore(s: number | undefined): number {
  if (typeof s !== 'number' || !Number.isFinite(s)) return 500;
  return Math.min(2000, Math.max(50, Math.round(s)));
}
function clampWindow(ms: number | undefined): number {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return DEFAULT_RUMMY_WINDOW_MS;
  return Math.min(10000, Math.max(0, Math.round(ms)));
}
function clampDecks(n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 1;
  return Math.min(2, Math.max(1, Math.round(n)));
}
function clampHandSize(n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.min(15, Math.max(0, Math.round(n)));
}

export class RoomError extends Error {
  public readonly humanMessage: string;
  constructor(public code: string, message: string) {
    super(`${code}: ${message}`);
    this.humanMessage = message;
    this.name = 'RoomError';
  }
}

function nowMs(): number { return Date.now(); }

export interface RoomEvents {
  onState(roomCode: string): void;
  onToast(roomCode: string, text: string, kind?: 'info' | 'success' | 'warn' | 'error'): void;
  onClosed(roomCode: string): void;
}

export class RoomManager {
  private rooms = new Map<string, GameState>();
  /** Disconnect timers per player so we can reclaim seats after timeout. */
  private disconnectTimers = new Map<string, NodeJS.Timeout>();
  private events: RoomEvents;

  constructor(events: RoomEvents) {
    this.events = events;
    setInterval(() => this.expireIdleRooms(), 5 * 60 * 1000).unref?.();
  }

  // ----- room lifecycle -----

  createRoom(
    hostName: string,
    options: Partial<RoomOptions> = {},
  ): { roomCode: string; playerId: string; state: GameState } {
    let code = '';
    for (let attempt = 0; attempt < 10; attempt++) {
      code = generateRoomCode(4);
      if (!this.rooms.has(code)) break;
    }
    if (!code || this.rooms.has(code)) throw new RoomError('NO_CODE', 'Could not allocate room code');

    const hostId = generatePlayerId();
    const host: Player = {
      id: hostId, name: hostName.slice(0, 20) || 'Player', connected: true,
      hand: [], totalScore: 0, roundMeldScore: 0,
    };
    const state: GameState = {
      roomCode: code,
      hostId,
      players: [host],
      turnIndex: 0,
      phase: 'lobby',
      stock: [],
      discard: [],
      melds: [],
      roundNumber: 0,
      winningScore: clampScore(options.winningScore),
      aceHigh: !!options.aceHigh,
      contextualAceScoring: !!options.contextualAceScoring,
      numDecks: clampDecks(options.numDecks),
      startingHandSize: clampHandSize(options.startingHandSize),
      rummyWindowMs: clampWindow(options.rummyWindowMs),
      createdAt: nowMs(),
      updatedAt: nowMs(),
    };
    this.rooms.set(code, state);
    return { roomCode: code, playerId: hostId, state };
  }

  private ruleOpts(state: GameState) {
    return { aceHigh: state.aceHigh, numDecks: state.numDecks };
  }

  joinRoom(roomCode: string, name: string): { playerId: string; state: GameState } {
    const state = this.requireRoom(roomCode);
    if (state.phase !== 'lobby') throw new RoomError('IN_PROGRESS', 'Game already started');
    if (state.players.length >= MAX_PLAYERS) throw new RoomError('FULL', 'Room is full');
    const playerId = generatePlayerId();
    state.players.push({
      id: playerId, name: name.slice(0, 20) || 'Player', connected: true,
      hand: [], totalScore: 0, roundMeldScore: 0,
    });
    this.touch(state);
    return { playerId, state };
  }

  /** Re-attach an existing playerId to a room (for refresh/reconnect). */
  rejoinRoom(roomCode: string, playerId: string): { state: GameState } {
    const state = this.requireRoom(roomCode);
    const p = state.players.find((x) => x.id === playerId);
    if (!p) throw new RoomError('NOT_SEATED', 'No such player in this room');
    p.connected = true;
    this.clearDisconnectTimer(playerId);
    this.touch(state);
    return { state };
  }

  /** Called when a socket disconnects. Marks player disconnected and arms a timer. */
  markDisconnected(roomCode: string, playerId: string) {
    const state = this.rooms.get(roomCode);
    if (!state) return;
    const p = state.players.find((x) => x.id === playerId);
    if (!p) return;
    p.connected = false;
    this.touch(state);

    // If still in lobby, remove them entirely after a short hold.
    const timer = setTimeout(() => {
      const cur = this.rooms.get(roomCode);
      if (!cur) return;
      const cp = cur.players.find((x) => x.id === playerId);
      if (!cp || cp.connected) return;
      if (cur.phase === 'lobby') {
        cur.players = cur.players.filter((x) => x.id !== playerId);
        if (cur.players.length === 0) {
          this.rooms.delete(roomCode);
          this.events.onClosed(roomCode);
          return;
        }
        if (cur.hostId === playerId) cur.hostId = cur.players[0]!.id;
        this.touch(cur);
        this.events.onState(roomCode);
      } else {
        // Mid-game: leave them seated but disconnected; future rejoin can restore.
        // If everyone in the room is disconnected, close the room.
        const anyConnected = cur.players.some((x) => x.connected);
        if (!anyConnected) {
          this.rooms.delete(roomCode);
          this.events.onClosed(roomCode);
        }
      }
    }, RECONNECT_TTL_MS);
    timer.unref?.();
    this.clearDisconnectTimer(playerId);
    this.disconnectTimers.set(playerId, timer);
  }

  leaveRoom(roomCode: string, playerId: string) {
    const state = this.rooms.get(roomCode);
    if (!state) return;
    if (state.phase === 'lobby') {
      state.players = state.players.filter((p) => p.id !== playerId);
      if (state.players.length === 0) {
        this.rooms.delete(roomCode);
        this.events.onClosed(roomCode);
        return;
      }
      if (state.hostId === playerId) state.hostId = state.players[0]!.id;
      this.touch(state);
      this.events.onState(roomCode);
    } else {
      this.markDisconnected(roomCode, playerId);
    }
  }

  // ----- game actions -----

  startGame(roomCode: string, byPlayerId: string) {
    const state = this.requireRoom(roomCode);
    if (state.hostId !== byPlayerId) throw new RoomError('NOT_HOST', 'Only the host can start');
    if (state.phase !== 'lobby' && state.phase !== 'gameEnd' && state.phase !== 'roundEnd') {
      throw new RoomError('BAD_PHASE', 'Cannot start: a round is already in progress');
    }
    if (state.players.length < MIN_PLAYERS) throw new RoomError('TOO_FEW', 'Need at least 2 players');
    this.startRound(state, /*resetTotals*/ true);
    this.touch(state);
  }

  startNextRound(roomCode: string, byPlayerId: string) {
    const state = this.requireRoom(roomCode);
    if (state.hostId !== byPlayerId) throw new RoomError('NOT_HOST', 'Only the host can advance');
    if (state.phase !== 'roundEnd') throw new RoomError('BAD_PHASE', 'Not at end of round');
    if (state.winnerId) throw new RoomError('GAME_OVER', 'Game already ended');
    this.startRound(state, /*resetTotals*/ false);
    this.touch(state);
  }

  private startRound(state: GameState, resetTotals: boolean) {
    const n = state.players.length;
    const deck = shuffle(buildDeck(state.numDecks));
    const handSize = state.startingHandSize > 0 ? state.startingHandSize : cardsPerPlayerFor(n);
    const { hands, stock } = deal(deck, n, handSize);
    state.players.forEach((p, i) => {
      p.hand = hands[i]!;
      p.roundMeldScore = 0;
      if (resetTotals) p.totalScore = 0;
    });
    state.stock = stock.slice(1);
    state.discard = [stock[0]!];
    state.melds = [];
    state.roundNumber += 1;
    state.phase = 'draw';
    // Rotate dealer/first turn each round (round 1 starts with index 0).
    state.turnIndex = (state.roundNumber - 1) % n;
    state.lastDiscardAt = undefined;
    state.lastRoundSummary = undefined;
    if (resetTotals) state.winnerId = undefined;
  }

  drawStock(roomCode: string, playerId: string) {
    const state = this.requireRoom(roomCode);
    this.assertTurn(state, playerId);
    if (state.phase !== 'draw') throw new RoomError('BAD_PHASE', 'Not in draw phase');
    if (state.stock.length === 0) {
      // Stock exhausted - round ends with no one going out
      this.endRound(state, null);
      this.touch(state);
      return;
    }
    const card = state.stock.shift()!;
    this.currentPlayer(state).hand.push(card);
    state.phase = 'meld';
    this.touch(state);
  }

  drawDiscard(roomCode: string, playerId: string, depth: number, meldCardIds: string[], targetMeldId?: string) {
    const state = this.requireRoom(roomCode);
    this.assertTurn(state, playerId);
    if (state.phase !== 'draw') throw new RoomError('BAD_PHASE', 'Not in draw phase');
    if (depth < 1 || depth > state.discard.length) {
      throw new RoomError('BAD_DEPTH', 'Invalid discard depth');
    }
    if (!meldCardIds || meldCardIds.length === 0) {
      throw new RoomError('NEED_MELD', 'Must immediately meld with the targeted card');
    }
    // The "targeted card" is the bottommost (deepest) card taken — index = discard.length - depth.
    const takeStart = state.discard.length - depth;
    const taken = state.discard.slice(takeStart);
    const targetedCard = taken[0]!;
    if (!meldCardIds.includes(targetedCard.id)) {
      throw new RoomError('TARGET_NOT_USED', 'The bottommost taken card must be part of the meld');
    }
    const player = this.currentPlayer(state);

    // Construct a "virtual hand" of player's hand + all taken discard cards, validate the meld from it.
    const virtual = [...player.hand, ...taken];
    const meldCards = pickCardsByIds(virtual, meldCardIds);
    if (!meldCards) throw new RoomError('BAD_CARDS', 'Some meld cards not in hand or discard');

    const opts = this.ruleOpts(state);
    if (targetMeldId) {
      const meld = state.melds.find((m) => m.id === targetMeldId);
      if (!meld) throw new RoomError('NO_MELD', 'Target meld not found');
      const meldCopy: Meld = { ...meld, cards: [...meld.cards] };
      let working: Meld = meldCopy;
      for (const c of meldCards) {
        if (!canLayOff(c, working, opts)) throw new RoomError('CANT_LAYOFF', 'Cards do not extend meld');
        working = insertIntoMeld(working, { card: c, placedBy: playerId });
      }
      const idx = state.melds.findIndex((m) => m.id === meld.id);
      state.melds[idx] = working;
    } else {
      const kind = inferMeldKind(meldCards, opts);
      if (!kind) throw new RoomError('NOT_A_MELD', 'Selected cards are not a valid set or run');
      state.melds.push({
        id: generateMeldId(),
        ownerId: playerId,
        kind,
        cards: meldCards.map((c) => ({ card: c, placedBy: playerId })),
      });
    }

    // Commit hand/discard mutations
    state.discard = state.discard.slice(0, takeStart);
    // Add untaken-but-not-melded taken cards back into hand
    const meldIdSet = new Set(meldCardIds);
    const survivors = virtual.filter((c) => !meldIdSet.has(c.id));
    player.hand = survivors;

    state.phase = 'meld';
    this.touch(state);
  }

  meld(roomCode: string, playerId: string, cardIds: string[], targetMeldId?: string) {
    const state = this.requireRoom(roomCode);
    this.assertTurn(state, playerId);
    if (state.phase !== 'meld') throw new RoomError('BAD_PHASE', 'Cannot meld now');
    const player = this.currentPlayer(state);
    const cards = pickCardsByIds(player.hand, cardIds);
    if (!cards) throw new RoomError('BAD_CARDS', 'Cards not in hand');
    if (cards.length === 0) throw new RoomError('EMPTY', 'No cards selected');
    // Boathouse: must keep at least one card to discard.
    if (cards.length >= player.hand.length) {
      throw new RoomError('BOATHOUSE', 'Must keep at least one card to discard');
    }

    const opts = this.ruleOpts(state);
    if (targetMeldId) {
      const meld = state.melds.find((m) => m.id === targetMeldId);
      if (!meld) throw new RoomError('NO_MELD', 'Target meld not found');
      let working: Meld = { ...meld, cards: [...meld.cards] };
      for (const c of cards) {
        if (!canLayOff(c, working, opts)) throw new RoomError('CANT_LAYOFF', 'Cards do not extend meld');
        working = insertIntoMeld(working, { card: c, placedBy: playerId });
      }
      const idx = state.melds.findIndex((m) => m.id === meld.id);
      state.melds[idx] = working;
    } else {
      const kind = inferMeldKind(cards, opts);
      if (!kind) throw new RoomError('NOT_A_MELD', 'Selected cards are not a valid set or run');
      state.melds.push({
        id: generateMeldId(),
        ownerId: playerId,
        kind,
        cards: cards.map((c) => ({ card: c, placedBy: playerId })),
      });
    }

    player.hand = removeCardsFromHand(player.hand, cardIds);
    this.touch(state);
  }

  layOff(roomCode: string, playerId: string, cardId: string, meldId: string) {
    const state = this.requireRoom(roomCode);
    this.assertTurn(state, playerId);
    if (state.phase !== 'meld') throw new RoomError('BAD_PHASE', 'Cannot lay off now');
    const player = this.currentPlayer(state);
    const card = player.hand.find((c) => c.id === cardId);
    if (!card) throw new RoomError('BAD_CARDS', 'Card not in hand');
    if (player.hand.length <= 1) throw new RoomError('BOATHOUSE', 'Must keep at least one card to discard');
    const meld = state.melds.find((m) => m.id === meldId);
    if (!meld) throw new RoomError('NO_MELD', 'Meld not found');
    if (!canLayOff(card, meld, this.ruleOpts(state))) throw new RoomError('CANT_LAYOFF', 'Card does not extend this meld');

    const newMeld = insertIntoMeld(meld, { card, placedBy: playerId });
    const idx = state.melds.findIndex((m) => m.id === meld.id);
    state.melds[idx] = newMeld;
    player.hand = removeCardsFromHand(player.hand, [cardId]);
    this.touch(state);
  }

  discard(roomCode: string, playerId: string, cardId: string) {
    const state = this.requireRoom(roomCode);
    this.assertTurn(state, playerId);
    if (state.phase !== 'meld') throw new RoomError('BAD_PHASE', 'Must draw before discarding');
    const player = this.currentPlayer(state);
    const card = player.hand.find((c) => c.id === cardId);
    if (!card) throw new RoomError('BAD_CARDS', 'Card not in hand');

    player.hand = removeCardsFromHand(player.hand, [cardId]);
    state.discard.push(card);
    state.lastDiscardAt = nowMs();

    if (player.hand.length === 0) {
      // Player went out. Round ends after the rummy window? No — going out closes the round.
      this.endRound(state, playerId);
      this.touch(state);
      return;
    }

    if (state.rummyWindowMs <= 0) {
      // No rummy window — advance immediately.
      this.advanceTurn(state);
      state.phase = 'draw';
      this.touch(state);
      return;
    }
    // Open rummy window: only call-rummy is accepted briefly.
    state.phase = 'rummyWindow';
    this.touch(state);
    setTimeout(() => {
      const cur = this.rooms.get(roomCode);
      if (!cur || cur.phase !== 'rummyWindow') return;
      this.advanceTurn(cur);
      cur.phase = 'draw';
      this.touch(cur);
      this.events.onState(roomCode);
    }, state.rummyWindowMs).unref?.();
  }

  callRummy(roomCode: string, callerId: string, meldId: string) {
    const state = this.requireRoom(roomCode);
    if (state.phase !== 'rummyWindow') throw new RoomError('BAD_PHASE', 'No rummy window open');
    const caller = state.players.find((p) => p.id === callerId);
    if (!caller) throw new RoomError('NOT_IN_ROOM', 'Caller not in room');
    if (state.discard.length === 0) throw new RoomError('NO_DISCARD', 'No discard to call on');
    const topCard = state.discard[state.discard.length - 1]!;
    const meld = state.melds.find((m) => m.id === meldId);
    if (!meld) throw new RoomError('NO_MELD', 'Meld not found');
    if (!canLayOff(topCard, meld, this.ruleOpts(state))) throw new RoomError('CANT_LAYOFF', 'Top discard cannot lay off here');

    // Caller takes the card and lays it off; credit goes to caller.
    state.discard.pop();
    const newMeld = insertIntoMeld(meld, { card: topCard, placedBy: callerId });
    const idx = state.melds.findIndex((m) => m.id === meld.id);
    state.melds[idx] = newMeld;

    // After rummy, turn flow continues as normal (next player after the original discarder).
    this.advanceTurn(state);
    state.phase = 'draw';
    this.events.onToast(roomCode, `${caller.name} called Rummy!`, 'success');
    this.touch(state);
  }

  // ----- internal helpers -----

  private endRound(state: GameState, wentOutPlayerId: string | null) {
    const summary = computeRoundSummary(
      state.players, state.melds, state.roundNumber, wentOutPlayerId,
      { contextualAceScoring: state.contextualAceScoring },
    );
    summary.perPlayer.forEach((row) => {
      const p = state.players.find((pp) => pp.id === row.playerId)!;
      p.totalScore = row.totalScore;
      p.roundMeldScore = row.meldPoints;
    });
    state.lastRoundSummary = summary;
    const winner = determineWinner(summary, state.winningScore, wentOutPlayerId);
    if (winner) {
      state.winnerId = winner;
      state.phase = 'gameEnd';
    } else {
      state.phase = 'roundEnd';
    }
    if (wentOutPlayerId) {
      const p = state.players.find((pp) => pp.id === wentOutPlayerId);
      if (p) this.events.onToast(state.roomCode, `${p.name} went out!`, 'success');
    } else {
      this.events.onToast(state.roomCode, 'Stock ran out — round ends', 'info');
    }
  }

  private advanceTurn(state: GameState) {
    state.turnIndex = (state.turnIndex + 1) % state.players.length;
  }

  private currentPlayer(state: GameState): Player {
    return state.players[state.turnIndex]!;
  }

  private assertTurn(state: GameState, playerId: string) {
    if (state.players[state.turnIndex]?.id !== playerId) {
      throw new RoomError('NOT_YOUR_TURN', 'Not your turn');
    }
  }

  private requireRoom(code: string): GameState {
    const r = this.rooms.get(code);
    if (!r) throw new RoomError('NO_ROOM', 'Room not found');
    return r;
  }

  private touch(state: GameState) {
    state.updatedAt = nowMs();
  }

  private clearDisconnectTimer(playerId: string) {
    const t = this.disconnectTimers.get(playerId);
    if (t) clearTimeout(t);
    this.disconnectTimers.delete(playerId);
  }

  private expireIdleRooms() {
    const cutoff = nowMs() - ROOM_TTL_MS;
    for (const [code, st] of this.rooms) {
      if (st.updatedAt < cutoff) {
        this.rooms.delete(code);
        this.events.onClosed(code);
      }
    }
  }

  // ----- public read helpers -----

  getStateFor(roomCode: string, playerId: string): ClientGameState | null {
    const s = this.rooms.get(roomCode);
    if (!s) return null;
    return redactFor(s, playerId);
  }

  getRawState(roomCode: string): GameState | undefined {
    return this.rooms.get(roomCode);
  }

  listPlayerIds(roomCode: string): string[] {
    return this.rooms.get(roomCode)?.players.map((p) => p.id) ?? [];
  }
}
