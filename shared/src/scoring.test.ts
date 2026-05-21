import { describe, expect, it } from 'vitest';
import { computeRoundSummary, determineWinner, scoreCard, scoreCardInMeld, scoreCards } from './scoring.js';
import { Card, Meld, Player } from './types.js';

const c = (suit: 'H' | 'D' | 'C' | 'S', rank: Card['rank']): Card => ({
  id: `${suit}-${rank}-1`,
  suit,
  rank,
});

describe('scoreCard (regular / face-value mode)', () => {
  it('2-9 score face value', () => {
    expect(scoreCard('2')).toBe(2);
    expect(scoreCard('5')).toBe(5);
    expect(scoreCard('9')).toBe(9);
  });
  it('10/J/Q/K score 10', () => {
    for (const r of ['10', 'J', 'Q', 'K'] as const) expect(scoreCard(r)).toBe(10);
  });
  it('A scores 15 (in hand)', () => {
    expect(scoreCard('A')).toBe(15);
  });
});

describe('scoreCard (simplified mode)', () => {
  it('2-9 all score 5', () => {
    for (const r of ['2', '3', '4', '5', '6', '7', '8', '9'] as const) {
      expect(scoreCard(r, { simplifiedScoring: true })).toBe(5);
    }
  });
  it('10/J/Q/K still 10', () => {
    for (const r of ['10', 'J', 'Q', 'K'] as const) {
      expect(scoreCard(r, { simplifiedScoring: true })).toBe(10);
    }
  });
  it('A in hand still 15', () => {
    expect(scoreCard('A', { simplifiedScoring: true })).toBe(15);
  });
});

describe('scoreCards', () => {
  it('sums correctly with face-value defaults', () => {
    // 15 + 10 + 5 = 30
    expect(scoreCards([c('H', 'A'), c('D', 'K'), c('S', '5')])).toBe(30);
  });
  it('sums correctly in simplified mode', () => {
    // 15 + 10 + 5 = 30 (same here, but a 2 differs)
    expect(scoreCards([c('H', '2'), c('D', '3')])).toBe(5);
    expect(scoreCards([c('H', '2'), c('D', '3')], { simplifiedScoring: true })).toBe(10);
  });
});

describe('scoreCardInMeld (ace context)', () => {
  const lowRun: Meld = {
    id: 'r1', ownerId: 'p', kind: 'run',
    cards: [
      { card: c('S', 'A'), placedBy: 'p' },
      { card: c('S', '2'), placedBy: 'p' },
      { card: c('S', '3'), placedBy: 'p' },
    ],
  };
  const highRun: Meld = {
    id: 'r2', ownerId: 'p', kind: 'run',
    cards: [
      { card: c('S', 'J'), placedBy: 'p' },
      { card: c('S', 'Q'), placedBy: 'p' },
      { card: c('S', 'K'), placedBy: 'p' },
      { card: c('S', 'A'), placedBy: 'p' },
    ],
  };
  const set: Meld = {
    id: 's1', ownerId: 'p', kind: 'set',
    cards: [
      { card: c('S', 'A'), placedBy: 'p' },
      { card: c('H', 'A'), placedBy: 'p' },
      { card: c('D', 'A'), placedBy: 'p' },
    ],
  };
  it('regular mode: A is 1 in low run, 15 elsewhere', () => {
    expect(scoreCardInMeld(c('S', 'A'), lowRun)).toBe(1);
    expect(scoreCardInMeld(c('S', 'A'), highRun)).toBe(15);
    expect(scoreCardInMeld(c('S', 'A'), set)).toBe(15);
  });
  it('simplified mode: A is 5 in low run, 15 elsewhere', () => {
    expect(scoreCardInMeld(c('S', 'A'), lowRun, { simplifiedScoring: true })).toBe(5);
    expect(scoreCardInMeld(c('S', 'A'), highRun, { simplifiedScoring: true })).toBe(15);
    expect(scoreCardInMeld(c('S', 'A'), set, { simplifiedScoring: true })).toBe(15);
  });
  it('non-ace cards: face value by default, flat 5 in simplified mode', () => {
    expect(scoreCardInMeld(c('S', '2'), lowRun)).toBe(2);
    expect(scoreCardInMeld(c('S', '2'), lowRun, { simplifiedScoring: true })).toBe(5);
    expect(scoreCardInMeld(c('S', 'K'), highRun)).toBe(10);
    expect(scoreCardInMeld(c('S', 'K'), highRun, { simplifiedScoring: true })).toBe(10);
  });
});

describe('computeRoundSummary', () => {
  const players: Player[] = [
    { id: 'p1', name: 'A', connected: true, hand: [c('H', '4')], totalScore: 100, roundMeldScore: 0 },
    { id: 'p2', name: 'B', connected: true, hand: [], totalScore: 90, roundMeldScore: 0 },
  ];
  const melds: Meld[] = [
    {
      id: 'm1',
      ownerId: 'p2',
      kind: 'set',
      cards: [
        { card: c('H', '7'), placedBy: 'p2' },
        { card: c('D', '7'), placedBy: 'p2' },
        { card: c('C', '7'), placedBy: 'p1' },
      ],
    },
  ];
  it('regular (face-value) scoring credits melds and penalizes hand', () => {
    const s = computeRoundSummary(players, melds, 1, 'p2');
    const p1 = s.perPlayer.find((p) => p.playerId === 'p1')!;
    const p2 = s.perPlayer.find((p) => p.playerId === 'p2')!;
    expect(p1.meldPoints).toBe(7);    // one 7 at face value
    expect(p1.handPenalty).toBe(4);   // H-4 in hand
    expect(p1.delta).toBe(3);
    expect(p1.totalScore).toBe(103);
    expect(p2.meldPoints).toBe(14);   // two 7s
    expect(p2.handPenalty).toBe(0);
    expect(p2.delta).toBe(14);
    expect(p2.totalScore).toBe(104);
  });
  it('simplified scoring uses flat 5s', () => {
    const s = computeRoundSummary(players, melds, 1, 'p2', { simplifiedScoring: true });
    const p1 = s.perPlayer.find((p) => p.playerId === 'p1')!;
    const p2 = s.perPlayer.find((p) => p.playerId === 'p2')!;
    expect(p1.meldPoints).toBe(5);
    expect(p1.handPenalty).toBe(5);
    expect(p1.delta).toBe(0);
    expect(p2.meldPoints).toBe(10);
    expect(p2.handPenalty).toBe(0);
    expect(p2.delta).toBe(10);
  });
  it('skips hand penalty when stock ran out', () => {
    const s = computeRoundSummary(players, melds, 1, null);
    const p1 = s.perPlayer.find((p) => p.playerId === 'p1')!;
    expect(p1.handPenalty).toBe(0);
    expect(p1.delta).toBe(7); // meld only, face value
  });
});

describe('determineWinner', () => {
  it('null if nobody crossed', () => {
    const s = {
      roundNumber: 1,
      wentOut: null,
      perPlayer: [
        { playerId: 'p1', name: 'A', meldPoints: 0, handPenalty: 0, delta: 0, totalScore: 100 },
        { playerId: 'p2', name: 'B', meldPoints: 0, handPenalty: 0, delta: 0, totalScore: 200 },
      ],
    };
    expect(determineWinner(s, 500, null)).toBeNull();
  });
  it('single winner', () => {
    const s = {
      roundNumber: 1,
      wentOut: 'p1' as string | null,
      perPlayer: [
        { playerId: 'p1', name: 'A', meldPoints: 0, handPenalty: 0, delta: 0, totalScore: 510 },
        { playerId: 'p2', name: 'B', meldPoints: 0, handPenalty: 0, delta: 0, totalScore: 200 },
      ],
    };
    expect(determineWinner(s, 500, 'p1')).toBe('p1');
  });
  it('tiebreaker: the one who went out wins', () => {
    const s = {
      roundNumber: 1,
      wentOut: 'p2' as string | null,
      perPlayer: [
        { playerId: 'p1', name: 'A', meldPoints: 0, handPenalty: 0, delta: 0, totalScore: 550 },
        { playerId: 'p2', name: 'B', meldPoints: 0, handPenalty: 0, delta: 0, totalScore: 520 },
      ],
    };
    expect(determineWinner(s, 500, 'p2')).toBe('p2');
  });
});
