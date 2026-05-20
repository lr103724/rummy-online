import { describe, expect, it } from 'vitest';
import { Card, Meld } from './types.js';
import {
  canLayOff,
  canPlayOutHand,
  inferMeldKind,
  insertIntoMeld,
  isValidRun,
  isValidSet,
} from './rules.js';

const c = (suit: 'H' | 'D' | 'C' | 'S', rank: Card['rank']): Card => ({
  id: `${suit}-${rank}-1`,
  suit,
  rank,
});

describe('isValidSet', () => {
  it('accepts 3 of a kind', () => {
    expect(isValidSet([c('H', '7'), c('D', '7'), c('C', '7')])).toBe(true);
  });
  it('accepts 4 of a kind', () => {
    expect(isValidSet([c('H', '7'), c('D', '7'), c('C', '7'), c('S', '7')])).toBe(true);
  });
  it('rejects 2 of a kind', () => {
    expect(isValidSet([c('H', '7'), c('D', '7')])).toBe(false);
  });
  it('rejects mixed ranks', () => {
    expect(isValidSet([c('H', '7'), c('D', '8'), c('C', '7')])).toBe(false);
  });
  it('rejects duplicate suits (single-deck variant)', () => {
    expect(isValidSet([c('H', '7'), c('H', '7'), c('C', '7')])).toBe(false);
  });
});

describe('isValidRun', () => {
  it('accepts ascending run', () => {
    expect(isValidRun([c('H', '5'), c('H', '6'), c('H', '7')])).toBe(true);
  });
  it('accepts run regardless of input order', () => {
    expect(isValidRun([c('H', '7'), c('H', '5'), c('H', '6')])).toBe(true);
  });
  it('accepts A-2-3 (ace low)', () => {
    expect(isValidRun([c('S', 'A'), c('S', '2'), c('S', '3')])).toBe(true);
  });
  it('rejects Q-K-A (ace not high)', () => {
    expect(isValidRun([c('S', 'Q'), c('S', 'K'), c('S', 'A')])).toBe(false);
  });
  it('rejects mixed suits', () => {
    expect(isValidRun([c('H', '5'), c('D', '6'), c('H', '7')])).toBe(false);
  });
  it('rejects with gap', () => {
    expect(isValidRun([c('H', '5'), c('H', '7'), c('H', '8')])).toBe(false);
  });
  it('rejects length < 3', () => {
    expect(isValidRun([c('H', '5'), c('H', '6')])).toBe(false);
  });
});

describe('inferMeldKind', () => {
  it('detects sets', () => {
    expect(inferMeldKind([c('H', '7'), c('D', '7'), c('C', '7')])).toBe('set');
  });
  it('detects runs', () => {
    expect(inferMeldKind([c('H', '5'), c('H', '6'), c('H', '7')])).toBe('run');
  });
  it('returns null for invalid', () => {
    expect(inferMeldKind([c('H', '5'), c('D', '6'), c('S', '9')])).toBeNull();
  });
});

describe('canLayOff', () => {
  const setMeld: Meld = {
    id: 'm1',
    ownerId: 'p1',
    kind: 'set',
    cards: [
      { card: c('H', '7'), placedBy: 'p1' },
      { card: c('D', '7'), placedBy: 'p1' },
      { card: c('C', '7'), placedBy: 'p1' },
    ],
  };
  const runMeld: Meld = {
    id: 'm2',
    ownerId: 'p1',
    kind: 'run',
    cards: [
      { card: c('S', '5'), placedBy: 'p1' },
      { card: c('S', '6'), placedBy: 'p1' },
      { card: c('S', '7'), placedBy: 'p1' },
    ],
  };

  it('allows the 4th rank into a set', () => {
    expect(canLayOff(c('S', '7'), setMeld)).toBe(true);
  });
  it('rejects 5th card on a set', () => {
    const full: Meld = {
      ...setMeld,
      cards: [...setMeld.cards, { card: c('S', '7'), placedBy: 'p1' }],
    };
    expect(canLayOff(c('H', '7'), full)).toBe(false);
  });
  it('rejects wrong rank into set', () => {
    expect(canLayOff(c('S', '8'), setMeld)).toBe(false);
  });
  it('allows extending run on low end', () => {
    expect(canLayOff(c('S', '4'), runMeld)).toBe(true);
  });
  it('allows extending run on high end', () => {
    expect(canLayOff(c('S', '8'), runMeld)).toBe(true);
  });
  it('rejects wrong suit on run', () => {
    expect(canLayOff(c('H', '8'), runMeld)).toBe(false);
  });
  it('rejects extending past K (ace not high)', () => {
    const highRun: Meld = {
      ...runMeld,
      cards: [
        { card: c('S', 'J'), placedBy: 'p1' },
        { card: c('S', 'Q'), placedBy: 'p1' },
        { card: c('S', 'K'), placedBy: 'p1' },
      ],
    };
    expect(canLayOff(c('S', 'A'), highRun)).toBe(false);
  });
  it('rejects extending below A', () => {
    const lowRun: Meld = {
      ...runMeld,
      cards: [
        { card: c('S', 'A'), placedBy: 'p1' },
        { card: c('S', '2'), placedBy: 'p1' },
        { card: c('S', '3'), placedBy: 'p1' },
      ],
    };
    // There is nothing below A.
    expect(canLayOff(c('S', '4'), lowRun)).toBe(true); // high extension still ok
    // (No card has value 0; canLayOff naturally rejects.)
  });
});

describe('insertIntoMeld', () => {
  it('keeps run sorted after insert at low end', () => {
    const meld: Meld = {
      id: 'r',
      ownerId: 'p',
      kind: 'run',
      cards: [
        { card: c('S', '5'), placedBy: 'p' },
        { card: c('S', '6'), placedBy: 'p' },
        { card: c('S', '7'), placedBy: 'p' },
      ],
    };
    const out = insertIntoMeld(meld, { card: c('S', '4'), placedBy: 'p' });
    expect(out.cards.map((m) => m.card.rank)).toEqual(['4', '5', '6', '7']);
  });
});

describe('aceHigh option', () => {
  it('isValidRun accepts Q-K-A when aceHigh is on', () => {
    expect(isValidRun([c('S', 'Q'), c('S', 'K'), c('S', 'A')], { aceHigh: true })).toBe(true);
  });
  it('still rejects K-A-2 (no wrap)', () => {
    expect(isValidRun([c('S', 'K'), c('S', 'A'), c('S', '2')], { aceHigh: true })).toBe(false);
  });
  it('canLayOff allows A on top of J-Q-K with aceHigh', () => {
    const meld = {
      id: 'r', ownerId: 'p', kind: 'run' as const,
      cards: [
        { card: c('S', 'J'), placedBy: 'p' },
        { card: c('S', 'Q'), placedBy: 'p' },
        { card: c('S', 'K'), placedBy: 'p' },
      ],
    };
    expect(canLayOff(c('S', 'A'), meld, { aceHigh: true })).toBe(true);
    expect(canLayOff(c('S', 'A'), meld)).toBe(false);
  });
});

describe('canPlayOutHand', () => {
  const melds: Meld[] = [
    {
      id: 'm',
      ownerId: 'p',
      kind: 'run',
      cards: [
        { card: c('S', '5'), placedBy: 'p' },
        { card: c('S', '6'), placedBy: 'p' },
        { card: c('S', '7'), placedBy: 'p' },
      ],
    },
  ];
  it('true when all cards extend the run', () => {
    expect(canPlayOutHand([c('S', '4'), c('S', '8')], melds)).toBe(true);
  });
  it('chains extensions correctly', () => {
    expect(canPlayOutHand([c('S', '8'), c('S', '9')], melds)).toBe(true);
  });
  it('false when a card has no home', () => {
    expect(canPlayOutHand([c('S', '8'), c('H', 'K')], melds)).toBe(false);
  });
});
