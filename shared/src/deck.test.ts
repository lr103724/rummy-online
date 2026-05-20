import { describe, expect, it } from 'vitest';
import { buildDeck, cardsPerPlayerFor, deal, seededRng, shuffle } from './deck.js';

describe('buildDeck', () => {
  it('produces 52 unique cards', () => {
    const d = buildDeck();
    expect(d.length).toBe(52);
    const ids = new Set(d.map((c) => c.id));
    expect(ids.size).toBe(52);
  });
});

describe('shuffle', () => {
  it('returns a permutation', () => {
    const d = buildDeck();
    const s = shuffle(d, seededRng(42));
    expect(s.length).toBe(d.length);
    expect(new Set(s.map((c) => c.id)).size).toBe(52);
  });
  it('is deterministic given a seeded rng', () => {
    const d = buildDeck();
    const a = shuffle(d, seededRng(7));
    const b = shuffle(d, seededRng(7));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });
});

describe('deal', () => {
  it('hands sizes match cardsPerPlayer; remainder is stock', () => {
    const d = buildDeck();
    const { hands, stock } = deal(d, 3, cardsPerPlayerFor(3));
    expect(hands).toHaveLength(3);
    expect(hands.every((h) => h.length === 7)).toBe(true);
    expect(stock.length).toBe(52 - 21);
  });
});
