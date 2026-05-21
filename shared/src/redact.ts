import { ClientGameState, GameState } from './types.js';

/** Build the per-client view of a game state, hiding stock contents and opponents' hands. */
export function redactFor(state: GameState, playerId: string): ClientGameState {
  const me = state.players.find((p) => p.id === playerId);
  return {
    roomCode: state.roomCode,
    hostId: state.hostId,
    you: { id: playerId, hand: me ? me.hand : [] },
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      handCount: p.hand.length,
      totalScore: p.totalScore,
      roundMeldScore: p.roundMeldScore,
    })),
    turnIndex: state.turnIndex,
    phase: state.phase,
    stockCount: state.stock.length,
    discard: state.discard,
    melds: state.melds,
    roundNumber: state.roundNumber,
    winningScore: state.winningScore,
    aceHigh: state.aceHigh,
    simplifiedScoring: state.simplifiedScoring,
    numDecks: state.numDecks,
    startingHandSize: state.startingHandSize,
    boathouseRule: state.boathouseRule,
    lastDiscardAt: state.lastDiscardAt,
    rummyWindowMs: state.rummyWindowMs,
    lastRoundSummary: state.lastRoundSummary,
    winnerId: state.winnerId,
  };
}
