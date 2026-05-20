import { Card, Rank, RANKS, Suit, SUITS } from './types.js';

export function cardId(suit: Suit, rank: Rank, copy = 1): string {
  return `${suit}-${rank}-${copy}`;
}

export function buildDeck(copies = 1): Card[] {
  const deck: Card[] = [];
  for (let c = 1; c <= copies; c++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ id: cardId(suit, rank, c), suit, rank });
      }
    }
  }
  return deck;
}

/** Fisher–Yates shuffle. Returns a new array; does not mutate input. */
export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** Seeded RNG (mulberry32) — useful for deterministic tests. */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deal `cardsPerPlayer` cards to each player. Returns hands + remaining stock. */
export function deal(
  deck: Card[],
  numPlayers: number,
  cardsPerPlayer: number,
): { hands: Card[][]; stock: Card[] } {
  if (deck.length < numPlayers * cardsPerPlayer + 1) {
    throw new Error('Not enough cards to deal');
  }
  const hands: Card[][] = Array.from({ length: numPlayers }, () => []);
  let idx = 0;
  for (let c = 0; c < cardsPerPlayer; c++) {
    for (let p = 0; p < numPlayers; p++) {
      hands[p]!.push(deck[idx]!);
      idx++;
    }
  }
  return { hands, stock: deck.slice(idx) };
}

export function cardsPerPlayerFor(numPlayers: number): number {
  return numPlayers === 2 ? 13 : 7;
}
