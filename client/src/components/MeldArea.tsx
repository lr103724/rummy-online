import { useEffect, useMemo, useRef } from 'react';
import { canLayOff, ClientGameState, Meld } from '@rummy/shared';
import { Card } from './Card';
import { FlipCard } from './Flip';

interface Props {
  state: ClientGameState;
  selectedCardIds: string[];
  onLayOff(meldId: string): void;
  onMeldClick(meld: Meld): void;
  callableMeldIds?: Set<string>;
  onCallRummy?(meldId: string): void;
}

export function MeldArea({ state, selectedCardIds, onMeldClick, callableMeldIds, onCallRummy }: Props) {
  // Track previous card ids per meld so we can detect cards that were ADDED to an
  // already-existing meld (lay-off or rummy call). Those should pop in at their slot
  // rather than FLIP from a source — otherwise the surrounding cards briefly show a gap.
  const prevMeldCards = useRef<Map<string, Set<string>>>(new Map());
  const hasMounted = useRef(false);

  const popInIds = useMemo(() => {
    const out = new Set<string>();
    if (!hasMounted.current) return out;
    for (const m of state.melds) {
      const prev = prevMeldCards.current.get(m.id);
      if (!prev) continue; // brand-new meld — leave cards to FLIP from hand
      for (const mc of m.cards) if (!prev.has(mc.card.id)) out.add(mc.card.id);
    }
    return out;
  }, [state.melds]);

  useEffect(() => {
    prevMeldCards.current = new Map(
      state.melds.map((m) => [m.id, new Set(m.cards.map((mc) => mc.card.id))]),
    );
    hasMounted.current = true;
  });

  if (state.melds.length === 0) {
    return <div className="text-zinc-300 text-sm italic px-2 py-3">No melds yet.</div>;
  }
  return (
    <div className="flex flex-wrap gap-6 items-start">
      {state.melds.map((m) => {
        const owner = state.players.find((p) => p.id === m.ownerId);
        const isCallable = callableMeldIds?.has(m.id) ?? false;
        const myHand = state.you.hand;
        const layoffable = selectedCardIds.some((id) => {
          const c = myHand.find((x) => x.id === id);
          return c ? canLayOff(c, m, { aceHigh: state.aceHigh }) : false;
        });
        return (
          <div
            key={m.id}
            onClick={() => onMeldClick(m)}
            className="flex flex-col items-start gap-1 cursor-pointer transition-transform hover:-translate-y-1"
          >
            <div className="flex justify-between items-center gap-3 text-[10px] text-zinc-200 px-1 min-w-full">
              <span className="whitespace-nowrap">{m.kind === 'set' ? 'Set' : 'Run'} · {owner?.name ?? '?'}</span>
              {isCallable && onCallRummy && (
                <button
                  className="text-rose-300 underline whitespace-nowrap"
                  onClick={(e) => { e.stopPropagation(); onCallRummy(m.id); }}
                >
                  Call Rummy
                </button>
              )}
            </div>
            <div
              className={`flex stack-small ${
                layoffable ? 'ring-2 ring-amber-300 rounded drop-shadow-[0_0_8px_rgba(252,211,77,0.7)]' : ''
              }`}
            >
              {m.cards.map((mc, ci) => {
                const placedByMe = mc.placedBy === state.you.id;
                return (
                  <FlipCard
                    key={mc.card.id}
                    id={mc.card.id}
                    popIn={popInIds.has(mc.card.id)}
                    style={{ zIndex: ci + 1 }}
                  >
                    <div className="relative" title={placedByMe ? 'You placed this card' : undefined}>
                      <Card card={mc.card} small />
                      {placedByMe && (
                        <div className="absolute -bottom-1.5 left-1 right-1 h-1 bg-amber-400 rounded-full shadow-[0_0_4px_rgba(252,211,77,0.7)]" />
                      )}
                    </div>
                  </FlipCard>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
