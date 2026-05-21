import { Card, Meld, Player, Rank, RoundSummary } from './types.js';

export interface ScoringOpts {
  /** When true, all 2-9 cards are worth a flat 5 points. Otherwise they're worth their face value.
   *  In both modes, 10/J/Q/K = 10, aces in sets or high runs = 15.
   *  An ace at the LOW end of a run scores 5 in simplified mode, 1 in regular mode. */
  simplifiedScoring?: boolean;
}

const RANK_FACE_VALUE: Record<Rank, number> = {
  A: 0, // ace is handled by scoreCardInMeld with meld context
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, J: 10, Q: 10, K: 10,
};

/** Per-card value for hand penalty (no meld context).
 *  Aces in hand are always 15 (worst-case penalty since the player didn't get to choose).
 *  2-9 are face value by default, or a flat 5 in simplified mode. 10/J/Q/K = 10. */
export function scoreCard(rank: Rank, opts?: ScoringOpts): number {
  if (rank === 'A') return 15;
  if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return opts?.simplifiedScoring ? 5 : RANK_FACE_VALUE[rank];
}

export function scoreCards(cards: Card[], opts?: ScoringOpts): number {
  return cards.reduce((s, c) => s + scoreCard(c.rank, opts), 0);
}

/** Score a card given the meld it sits in.
 *  Ace in low run (A-2-3 …): 1 in regular mode, 5 in simplified mode.
 *  Ace in sets or high runs: always 15.
 *  Other cards follow `scoreCard`. */
export function scoreCardInMeld(card: Card, meld: Meld, opts?: ScoringOpts): number {
  if (card.rank !== 'A') return scoreCard(card.rank, opts);
  if (meld.kind === 'set') return 15;
  const ranks = meld.cards.map((mc) => mc.card.rank);
  const aceIdx = ranks.indexOf('A');
  // Low ace: appears at the start of the sorted run, with a 2 next to it.
  if (aceIdx === 0 && ranks[1] === '2') {
    return opts?.simplifiedScoring ? 5 : 1;
  }
  return 15;
}

export function scoreMeldsForPlayer(playerId: string, melds: Meld[], opts?: ScoringOpts): number {
  let total = 0;
  for (const m of melds) {
    for (const mc of m.cards) {
      if (mc.placedBy === playerId) total += scoreCardInMeld(mc.card, m, opts);
    }
  }
  return total;
}

/** Score the end of a round. If `wentOutPlayerId` is null (stock ran out),
 *  no hand-penalty is applied per house rule. */
export function computeRoundSummary(
  players: Player[],
  melds: Meld[],
  roundNumber: number,
  wentOutPlayerId: string | null,
  opts?: ScoringOpts,
): RoundSummary {
  const perPlayer = players.map((p) => {
    const meldPoints = scoreMeldsForPlayer(p.id, melds, opts);
    const handPenalty = wentOutPlayerId === null ? 0 : scoreCards(p.hand, opts);
    const delta = meldPoints - handPenalty;
    return {
      playerId: p.id,
      name: p.name,
      meldPoints,
      handPenalty,
      delta,
      totalScore: p.totalScore + delta,
    };
  });
  return { roundNumber, wentOut: wentOutPlayerId, perPlayer };
}

export function determineWinner(
  summary: RoundSummary,
  winningScore: number,
  wentOutPlayerId: string | null,
): string | null {
  const crossed = summary.perPlayer.filter((p) => p.totalScore >= winningScore);
  if (crossed.length === 0) return null;
  if (crossed.length === 1) return crossed[0]!.playerId;
  if (wentOutPlayerId && crossed.some((p) => p.playerId === wentOutPlayerId)) {
    return wentOutPlayerId;
  }
  return crossed.reduce((a, b) => (a.totalScore >= b.totalScore ? a : b)).playerId;
}
