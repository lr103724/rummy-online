import { describe, expect, it, vi } from 'vitest';
import { RoomManager } from './rooms.js';

function makeMgr() {
  const events = {
    onState: vi.fn(),
    onToast: vi.fn(),
    onClosed: vi.fn(),
  };
  return { mgr: new RoomManager(events), events };
}

describe('RoomManager lifecycle', () => {
  it('creates and joins a room', () => {
    const { mgr } = makeMgr();
    const { roomCode, playerId } = mgr.createRoom('Alice');
    expect(roomCode).toMatch(/^[A-Z2-9]{4}$/);
    const j = mgr.joinRoom(roomCode, 'Bob');
    const view = mgr.getStateFor(roomCode, playerId)!;
    expect(view.players).toHaveLength(2);
    expect(view.phase).toBe('lobby');
    expect(view.players.find((p) => p.id === j.playerId)?.name).toBe('Bob');
  });

  it('rejects joining a started game', () => {
    const { mgr } = makeMgr();
    const { roomCode, playerId: hostId } = mgr.createRoom('Alice');
    mgr.joinRoom(roomCode, 'Bob');
    mgr.startGame(roomCode, hostId);
    expect(() => mgr.joinRoom(roomCode, 'Eve')).toThrow(/IN_PROGRESS/);
  });

  it('rejects start without enough players', () => {
    const { mgr } = makeMgr();
    const { roomCode, playerId } = mgr.createRoom('Solo');
    expect(() => mgr.startGame(roomCode, playerId)).toThrow(/TOO_FEW/);
  });

  it('host-only can start', () => {
    const { mgr } = makeMgr();
    const { roomCode, playerId: hostId } = mgr.createRoom('Alice');
    const { playerId: bob } = mgr.joinRoom(roomCode, 'Bob');
    expect(() => mgr.startGame(roomCode, bob)).toThrow(/NOT_HOST/);
    mgr.startGame(roomCode, hostId);
  });
});

describe('RoomManager game flow', () => {
  function setupTwoPlayer() {
    const { mgr, events } = makeMgr();
    const a = mgr.createRoom('A');
    const b = mgr.joinRoom(a.roomCode, 'B');
    mgr.startGame(a.roomCode, a.playerId);
    return { mgr, events, roomCode: a.roomCode, aId: a.playerId, bId: b.playerId };
  }

  it('initial deal: 13 cards each for 2 players, draw phase, turn=0', () => {
    const { mgr, roomCode, aId } = setupTwoPlayer();
    const v = mgr.getStateFor(roomCode, aId)!;
    expect(v.phase).toBe('draw');
    expect(v.players[0]!.handCount).toBe(13);
    expect(v.players[1]!.handCount).toBe(13);
    expect(v.stockCount).toBe(52 - 26 - 1); // 1 in initial discard
    expect(v.discard).toHaveLength(1);
  });

  it('non-turn player cannot draw', () => {
    const { mgr, roomCode, bId } = setupTwoPlayer();
    expect(() => mgr.drawStock(roomCode, bId)).toThrow(/NOT_YOUR_TURN/);
  });

  it('drawStock → meld phase, hand grows by 1', () => {
    const { mgr, roomCode, aId } = setupTwoPlayer();
    const before = mgr.getStateFor(roomCode, aId)!.you.hand.length;
    mgr.drawStock(roomCode, aId);
    const v = mgr.getStateFor(roomCode, aId)!;
    expect(v.phase).toBe('meld');
    expect(v.you.hand.length).toBe(before + 1);
  });

  it('discard must come from meld phase (cannot skip draw)', () => {
    const { mgr, roomCode, aId } = setupTwoPlayer();
    const hand = mgr.getStateFor(roomCode, aId)!.you.hand;
    expect(() => mgr.discard(roomCode, aId, hand[0]!.id)).toThrow(/BAD_PHASE/);
  });

  it('discard advances rummy window then turn moves to next player', async () => {
    const { mgr, roomCode, aId, bId } = setupTwoPlayer();
    mgr.drawStock(roomCode, aId);
    const hand = mgr.getStateFor(roomCode, aId)!.you.hand;
    mgr.discard(roomCode, aId, hand[0]!.id);
    // rummyWindow ms is short; wait it out
    const v1 = mgr.getStateFor(roomCode, aId)!;
    expect(v1.phase).toBe('rummyWindow');
    await new Promise((r) => setTimeout(r, v1.rummyWindowMs + 200));
    const v2 = mgr.getStateFor(roomCode, bId)!;
    expect(v2.phase).toBe('draw');
    expect(v2.turnIndex).toBe(1);
  });

  it('boathouse: cannot meld all remaining cards (must keep one to discard)', () => {
    // Hand-craft a player with exactly 3 cards forming a valid set; melding should fail.
    const { mgr } = makeMgr();
    const a = mgr.createRoom('A');
    mgr.joinRoom(a.roomCode, 'B');
    mgr.startGame(a.roomCode, a.playerId);
    const raw = mgr.getRawState(a.roomCode)!;
    raw.players[0]!.hand = [
      { id: 'H-7-1', suit: 'H', rank: '7' },
      { id: 'D-7-1', suit: 'D', rank: '7' },
      { id: 'C-7-1', suit: 'C', rank: '7' },
    ];
    raw.phase = 'meld';
    expect(() => mgr.meld(a.roomCode, a.playerId, ['H-7-1', 'D-7-1', 'C-7-1'])).toThrow(/BOATHOUSE/);
  });

  it('going out via discard ends the round and records summary', () => {
    const { mgr } = makeMgr();
    const a = mgr.createRoom('A');
    const b = mgr.joinRoom(a.roomCode, 'B');
    mgr.startGame(a.roomCode, a.playerId);
    const raw = mgr.getRawState(a.roomCode)!;
    // Force a winning end-of-turn state for player A: melded a set already, has 1 card to discard.
    raw.players[0]!.hand = [{ id: 'H-2-1', suit: 'H', rank: '2' }];
    raw.players[1]!.hand = [
      { id: 'D-K-1', suit: 'D', rank: 'K' },
      { id: 'S-A-1', suit: 'S', rank: 'A' },
    ];
    raw.phase = 'meld';
    raw.turnIndex = 0;
    raw.melds = [{
      id: 'm1', ownerId: a.playerId, kind: 'set',
      cards: [
        { card: { id: 'H-9-1', suit: 'H', rank: '9' }, placedBy: a.playerId },
        { card: { id: 'D-9-1', suit: 'D', rank: '9' }, placedBy: a.playerId },
        { card: { id: 'C-9-1', suit: 'C', rank: '9' }, placedBy: a.playerId },
      ],
    }];
    mgr.discard(a.roomCode, a.playerId, 'H-2-1');
    const v = mgr.getStateFor(a.roomCode, a.playerId)!;
    expect(['roundEnd', 'gameEnd']).toContain(v.phase);
    expect(v.lastRoundSummary).toBeDefined();
    const aSum = v.lastRoundSummary!.perPlayer.find((p) => p.playerId === a.playerId)!;
    const bSum = v.lastRoundSummary!.perPlayer.find((p) => p.playerId === b.playerId)!;
    expect(aSum.meldPoints).toBe(15); // three 9s = 5*3
    expect(aSum.handPenalty).toBe(0);
    expect(aSum.delta).toBe(15);
    expect(bSum.handPenalty).toBe(10 + 15); // K + A
    expect(bSum.delta).toBe(-25);
  });

  it('rummy call: takes top discard onto a valid meld', () => {
    const { mgr } = makeMgr();
    const a = mgr.createRoom('A');
    const b = mgr.joinRoom(a.roomCode, 'B');
    mgr.startGame(a.roomCode, a.playerId);
    const raw = mgr.getRawState(a.roomCode)!;
    raw.players[0]!.hand = [
      { id: 'H-2-1', suit: 'H', rank: '2' },
      { id: 'H-3-1', suit: 'H', rank: '3' },
    ];
    raw.players[1]!.hand = [{ id: 'D-5-1', suit: 'D', rank: '5' }];
    raw.melds = [{
      id: 'r1', ownerId: b.playerId, kind: 'run',
      cards: [
        { card: { id: 'H-5-1', suit: 'H', rank: '5' }, placedBy: b.playerId },
        { card: { id: 'H-6-1', suit: 'H', rank: '6' }, placedBy: b.playerId },
        { card: { id: 'H-7-1', suit: 'H', rank: '7' }, placedBy: b.playerId },
      ],
    }];
    raw.turnIndex = 0;
    raw.phase = 'meld';
    // A discards H-2 which can NOT lay off; then discards H-4 which... we'll set up H-4 differently:
    raw.players[0]!.hand = [
      { id: 'H-4-1', suit: 'H', rank: '4' }, // can lay off on the run
      { id: 'C-2-1', suit: 'C', rank: '2' },
    ];
    mgr.discard(a.roomCode, a.playerId, 'H-4-1');
    // B calls rummy on r1
    mgr.callRummy(a.roomCode, b.playerId, 'r1');
    const meld = mgr.getRawState(a.roomCode)!.melds[0]!;
    expect(meld.cards.some((mc) => mc.card.id === 'H-4-1' && mc.placedBy === b.playerId)).toBe(true);
    // Turn advanced from A to B (next player).
    expect(mgr.getRawState(a.roomCode)!.phase).toBe('draw');
  });

  it('reconnect restores connected flag without re-dealing', () => {
    const { mgr } = makeMgr();
    const a = mgr.createRoom('A');
    const b = mgr.joinRoom(a.roomCode, 'B');
    mgr.startGame(a.roomCode, a.playerId);
    const handBefore = mgr.getStateFor(a.roomCode, b.playerId)!.you.hand.map((c) => c.id);
    mgr.markDisconnected(a.roomCode, b.playerId);
    expect(mgr.getStateFor(a.roomCode, b.playerId)!.players.find((p) => p.id === b.playerId)!.connected).toBe(false);
    mgr.rejoinRoom(a.roomCode, b.playerId);
    const after = mgr.getStateFor(a.roomCode, b.playerId)!;
    expect(after.players.find((p) => p.id === b.playerId)!.connected).toBe(true);
    expect(after.you.hand.map((c) => c.id)).toEqual(handBefore);
  });
});
