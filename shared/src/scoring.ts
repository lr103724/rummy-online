import { Card, Meld, Player, Rank, RoundSummary } from './types.js';

export interface ScoringOpts {
  /** If true, an Ace at the LOW end of a run (A-2-3 …) scores 5 instead of 15.
   *  Aces in sets and high-end runs always score 15. Default false (ace = 15 everywhere). */
  contextualAceScoring?: boolean;
}

/** Per-card value for hand penalty (no meld context). Ace always 15. */
export function scoreCard(rank: Rank): number {
  if (rank === 'A') return 15;
  if (rank === 'K' || rank === 'Q' || rank === 'J' || rank === '10') return 10;
  return 5;
}

export function scoreCards(cards: Card[]): number {
  return cards.reduce((s, c) => s + scoreCard(c.rank), 0);
}

/** Score a card given the meld it sits in.
 *  When `contextualAceScoring` is on, an Ace at the low end of a run is worth 5. */
export function scoreCardInMeld(card: Card, meld: Meld, opts?: ScoringOpts): number {
  if (card.rank !== 'A') return scoreCard(card.rank);
  if (!opts?.contextualAceScoring) return 15;
  if (meld.kind === 'set') return 15;
  const ranks = meld.cards.map((mc) => mc.card.rank);
  const aceIdx = ranks.indexOf('A');
  if (aceIdx === 0 && ranks[1] === '2') return 5;
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
    const handPenalty = wentOutPlayerId === null ? 0 : scoreCards(p.hand);
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
