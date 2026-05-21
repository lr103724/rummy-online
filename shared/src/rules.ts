import { Card, Meld, Rank } from './types.js';

export const RANK_ORDER: Record<Rank, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, J: 11, Q: 12, K: 13,
};

export interface RuleOpts {
  /** If true, ace can also be high in runs (e.g. Q-K-A). */
  aceHigh?: boolean;
  /** Number of decks shuffled together (default 1). Affects max set size and suit uniqueness. */
  numDecks?: number;
}

function isConsec(values: number[]): boolean {
  for (let i = 1; i < values.length; i++) if (values[i] !== values[i - 1]! + 1) return false;
  return true;
}

/** Returns the orientation that makes these same-suit cards a consecutive run, or null. */
function runOrientation(cards: Card[]): { aceHigh: boolean } | null {
  const hasAce = cards.some((c) => c.rank === 'A');
  const valsLow = cards.map((c) => RANK_ORDER[c.rank]).slice().sort((a, b) => a - b);
  if (isConsec(valsLow)) return { aceHigh: false };
  if (hasAce) {
    const valsHigh = cards.map((c) => (c.rank === 'A' ? 14 : RANK_ORDER[c.rank])).sort((a, b) => a - b);
    if (isConsec(valsHigh)) return { aceHigh: true };
  }
  return null;
}

/** A valid set: 3+ cards of the same rank. Max size = 4 × numDecks.
 *  In a single-deck game suits must all differ; with multiple decks a suit may repeat
 *  up to `numDecks` times (cards are distinguished by their unique id). */
export function isValidSet(cards: Card[], opts?: RuleOpts): boolean {
  const decks = opts?.numDecks ?? 1;
  const maxSize = decks * 4;
  if (cards.length < 3 || cards.length > maxSize) return false;
  const rank = cards[0]!.rank;
  if (!cards.every((c) => c.rank === rank)) return false;
  // No two cards may share the same physical card id.
  const ids = new Set(cards.map((c) => c.id));
  if (ids.size !== cards.length) return false;
  // A given suit may appear at most `decks` times.
  const perSuit = new Map<string, number>();
  for (const c of cards) perSuit.set(c.suit, (perSuit.get(c.suit) ?? 0) + 1);
  for (const v of perSuit.values()) if (v > decks) return false;
  return true;
}

/** A valid run: 3+ cards, same suit, consecutive ranks.
 *  Ace is low only by default; pass `{ aceHigh: true }` to also allow Q-K-A. */
export function isValidRun(cards: Card[], opts?: RuleOpts): boolean {
  if (cards.length < 3) return false;
  const suit = cards[0]!.suit;
  if (!cards.every((c) => c.suit === suit)) return false;
  const o = runOrientation(cards);
  if (!o) return false;
  if (o.aceHigh && !opts?.aceHigh) return false;
  return true;
}

export function isValidMeld(cards: Card[], kind: 'set' | 'run', opts?: RuleOpts): boolean {
  return kind === 'set' ? isValidSet(cards, opts) : isValidRun(cards, opts);
}

/** Infer the only legal kind for a candidate meld, or null if it's not valid as either. */
export function inferMeldKind(cards: Card[], opts?: RuleOpts): 'set' | 'run' | null {
  if (isValidSet(cards, opts)) return 'set';
  if (isValidRun(cards, opts)) return 'run';
  return null;
}

/** Can `card` legally lay off onto an existing meld? */
export function canLayOff(card: Card, meld: Meld, opts?: RuleOpts): boolean {
  const meldCards = meld.cards.map((mc) => mc.card);
  if (meld.kind === 'set') {
    const decks = opts?.numDecks ?? 1;
    if (meldCards.length >= decks * 4) return false;
    if (meldCards[0]!.rank !== card.rank) return false;
    if (meldCards.some((c) => c.id === card.id)) return false; // no duplicate id
    const sameSuit = meldCards.filter((c) => c.suit === card.suit).length;
    return sameSuit < decks;
  }
  // run
  if (meldCards[0]!.suit !== card.suit) return false;
  const orient = runOrientation(meldCards) ?? { aceHigh: false };
  const values = meldCards
    .map((c) => (c.rank === 'A' && orient.aceHigh ? 14 : RANK_ORDER[c.rank]))
    .sort((a, b) => a - b);
  const lowVal = values[0]!;
  const highVal = values[values.length - 1]!;

  // The card to add: aces can be 1, or 14 if option allows.
  const cardVals: number[] = [];
  if (card.rank === 'A') {
    cardVals.push(1);
    if (opts?.aceHigh) cardVals.push(14);
  } else {
    cardVals.push(RANK_ORDER[card.rank]);
  }
  const maxRank = opts?.aceHigh ? 14 : 13;
  for (const cv of cardVals) {
    if (cv === lowVal - 1 && lowVal > 1) return true;
    if (cv === highVal + 1 && highVal < maxRank) return true;
  }
  return false;
}

/** Find any meld in the list that `card` could lay off on. */
export function findLayOffTarget(card: Card, melds: Meld[], opts?: RuleOpts): Meld | null {
  for (const m of melds) {
    if (canLayOff(card, m, opts)) return m;
  }
  return null;
}

/** Sort an array of meld-card entries into run order, respecting ace orientation
 *  (ace is high if the cards form a high-ace consecutive run, low otherwise). */
export function sortRunCards<T extends { card: Card }>(cards: T[]): T[] {
  const orient = runOrientation(cards.map((c) => c.card)) ?? { aceHigh: false };
  const out = [...cards];
  out.sort((a, b) => {
    const av = a.card.rank === 'A' && orient.aceHigh ? 14 : RANK_ORDER[a.card.rank];
    const bv = b.card.rank === 'A' && orient.aceHigh ? 14 : RANK_ORDER[b.card.rank];
    return av - bv;
  });
  return out;
}

/** Insertion helper: keeps runs sorted, respecting current ace orientation. */
export function insertIntoMeld(
  meld: Meld,
  mc: { card: Card; placedBy: string },
): Meld {
  if (meld.kind === 'set') {
    return { ...meld, cards: [...meld.cards, mc] };
  }
  return { ...meld, cards: sortRunCards([...meld.cards, mc]) };
}

export function pickCardsByIds(hand: Card[], ids: string[]): Card[] | null {
  const out: Card[] = [];
  const remaining = new Map(hand.map((c) => [c.id, c] as const));
  for (const id of ids) {
    const c = remaining.get(id);
    if (!c) return null;
    out.push(c);
    remaining.delete(id);
  }
  return out;
}

export function removeCardsFromHand(hand: Card[], ids: string[]): Card[] {
  const idSet = new Set(ids);
  return hand.filter((c) => !idSet.has(c.id));
}

export function canPlayOutHand(hand: Card[], melds: Meld[], opts?: RuleOpts): boolean {
  if (hand.length === 0) return true;
  const workMelds = melds.map((m) => ({ ...m, cards: [...m.cards] }));
  function tryFrom(remaining: Card[], currentMelds: Meld[]): boolean {
    if (remaining.length === 0) return true;
    for (let i = 0; i < remaining.length; i++) {
      const card = remaining[i]!;
      for (let j = 0; j < currentMelds.length; j++) {
        const meld = currentMelds[j]!;
        if (canLayOff(card, meld, opts)) {
          const nextMelds = currentMelds.slice();
          nextMelds[j] = insertIntoMeld(meld, { card, placedBy: 'tmp' });
          const nextRemaining = remaining.slice();
          nextRemaining.splice(i, 1);
          if (tryFrom(nextRemaining, nextMelds)) return true;
        }
      }
    }
    return false;
  }
  return tryFrom(hand, workMelds);
}
