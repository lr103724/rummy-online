import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { canLayOff, ClientGameState, inferMeldKind } from '@rummy/shared';
import { Card } from './Card';
import { Hand } from './Hand';
import { DiscardPile } from './DiscardPile';
import { MeldArea } from './MeldArea';
import { Scoreboard } from './Scoreboard';
import { TurnIndicator } from './TurnIndicator';
import { FlipCard } from './Flip';
import { BackgroundPicker } from './BackgroundPicker';

interface Props {
  state: ClientGameState;
  myId: string | null;
  onDrawStock(): void;
  onDrawDiscard(depth: number, meldCardIds: string[], targetMeldId?: string): void;
  onMeld(cardIds: string[], targetMeldId?: string): void;
  onLayOff(cardId: string, meldId: string): void;
  onDiscard(cardId: string): void;
  onCallRummy(meldId: string): void;
}

export function Table(props: Props) {
  const { state, myId } = props;
  const myTurn = state.players[state.turnIndex]?.id === myId;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingDiscardDepth, setPendingDiscardDepth] = useState<number | null>(null);
  /** Which cards from the taken-discard slice should go INTO the meld
   *  (the rest go to the hand). Deepest is always included and locked. */
  const [selectedTakenIds, setSelectedTakenIds] = useState<Set<string>>(new Set());

  // Auto-fit the melds panel: if the natural meld grid is taller than its container,
  // scale it down (and widen the logical layout) so it fills the available space
  // without scrolling. Bounded below by 0.55× — beyond that, scrolling kicks in.
  const meldsScaleRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const inner = meldsScaleRef.current;
    const outer = inner?.parentElement;
    if (!inner || !outer) return;
    const update = () => {
      inner.style.transform = '';
      inner.style.width = '';
      const outerH = outer.clientHeight;
      const naturalH = inner.scrollHeight;
      if (naturalH > outerH && outerH > 0) {
        const scale = Math.max(0.55, outerH / naturalH);
        inner.style.transform = `scale(${scale})`;
        inner.style.transformOrigin = 'top left';
        inner.style.width = `${100 / scale}%`;
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [state.melds]);

  const toggleSelect = (id: string) => {
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };
  const clearSelection = () => setSelectedIds([]);

  const hand = state.you.hand;
  const ruleOpts = { aceHigh: state.aceHigh, numDecks: state.numDecks };
  const selectionKind = useMemo(() => {
    const cards = selectedIds.map((id) => hand.find((c) => c.id === id)).filter(Boolean) as any[];
    return cards.length >= 3 ? inferMeldKind(cards, ruleOpts) : null;
  }, [selectedIds, hand, state.aceHigh, state.numDecks]);

  const callableMeldIds = useMemo(() => {
    const out = new Set<string>();
    if (state.phase !== 'rummyWindow') return out;
    if (myTurn) return out;
    const top = state.discard[state.discard.length - 1];
    if (!top) return out;
    for (const m of state.melds) if (canLayOff(top, m, ruleOpts)) out.add(m.id);
    return out;
  }, [state, myTurn]);

  // --- action handlers ---
  const tryMeldNew = () => {
    if (selectedIds.length < 3) return;
    props.onMeld(selectedIds);
    clearSelection();
  };
  const tryLayOff = (meldId: string) => {
    if (selectedIds.length === 0) return;
    if (selectedIds.length === 1) {
      props.onLayOff(selectedIds[0]!, meldId);
    } else {
      props.onMeld(selectedIds, meldId);
    }
    clearSelection();
  };
  const tryDiscard = () => {
    if (selectedIds.length !== 1) return;
    props.onDiscard(selectedIds[0]!);
    clearSelection();
  };
  const tryDrawDiscard = (depth: number) => {
    // Default: include ALL taken cards in the meld (so picking depth-2 to grab
    // two matching ranks "just works"). User can deselect any non-deepest card
    // in the prompt below to send it to the hand instead.
    setPendingDiscardDepth(depth);
    const startIdx = state.discard.length - depth;
    setSelectedTakenIds(new Set(state.discard.slice(startIdx).map((c) => c.id)));
  };
  const toggleTaken = (id: string, lockedId: string) => {
    if (id === lockedId) return; // deepest is required
    setSelectedTakenIds((s) => {
      const ns = new Set(s);
      if (ns.has(id)) ns.delete(id);
      else ns.add(id);
      return ns;
    });
  };
  const cancelDrawDiscard = () => {
    setPendingDiscardDepth(null);
    setSelectedTakenIds(new Set());
  };
  const confirmDrawDiscardMeld = () => {
    if (pendingDiscardDepth === null) return;
    const idx = state.discard.length - pendingDiscardDepth;
    const deepCard = state.discard[idx];
    if (!deepCard) { cancelDrawDiscard(); return; }
    // Combine taken cards going to meld + hand cards going to meld, ensuring deepest is in.
    const fromTaken = [...selectedTakenIds];
    if (!fromTaken.includes(deepCard.id)) fromTaken.push(deepCard.id);
    const fromHand = selectedIds.filter((id) => !fromTaken.includes(id));
    const meldIds = [...fromTaken, ...fromHand];
    props.onDrawDiscard(pendingDiscardDepth, meldIds);
    setPendingDiscardDepth(null);
    setSelectedTakenIds(new Set());
    clearSelection();
  };

  // Derived for prompt
  const promptTakenCards = pendingDiscardDepth !== null
    ? state.discard.slice(state.discard.length - pendingDiscardDepth)
    : [];
  const promptDeepCard = promptTakenCards[0];

  return (
    <div className="min-h-screen md:h-screen flex flex-col md:flex-row md:overflow-hidden">
      {/* Main play area */}
      <div className="flex-1 flex flex-col p-3 md:p-4 gap-3 md:min-h-0">
        {/* Header — fixed */}
        <div className="shrink-0 flex justify-between items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <h2 className="text-amber-300 font-bold text-xl">Room {state.roomCode}</h2>
            <button
              className="text-xs text-zinc-300 underline"
              onClick={() => navigator.clipboard?.writeText(
                `${window.location.origin}/r/${state.roomCode}`,
              )}
            >
              copy link
            </button>
          </div>
          <TurnIndicator state={state} myId={myId} />
        </div>

        {/* Other players — fixed */}
        <div className="shrink-0 flex gap-3 flex-wrap">
          {state.players.filter((p) => p.id !== myId).map((p) => (
            <div key={p.id} className={`rounded border border-zinc-600 px-3 py-1.5 bg-feltDark/70 ${state.players[state.turnIndex]?.id === p.id ? 'ring-2 ring-amber-300' : ''}`}>
              <div className="text-sm font-medium">{p.name}{!p.connected && <span className="text-rose-400 ml-1">(off)</span>}</div>
              <div className="text-xs text-zinc-400">{p.handCount} cards · {p.totalScore} pts</div>
            </div>
          ))}
        </div>

        {/* Melds — flex-grow, auto-fits via transform: scale() if it would otherwise wrap too much */}
        <div className="md:flex-1 md:min-h-0 flex flex-col gap-1">
          <div className="shrink-0 text-xs uppercase text-zinc-400">
            Melds (click a meld to lay off selected cards)
          </div>
          <div className="md:flex-1 md:min-h-0 md:overflow-hidden">
            <div ref={meldsScaleRef}>
              <MeldArea
                state={state}
                selectedCardIds={selectedIds}
                onMeldClick={(m) => tryLayOff(m.id)}
                onLayOff={(id) => tryLayOff(id)}
                callableMeldIds={callableMeldIds}
                onCallRummy={(id) => props.onCallRummy(id)}
              />
            </div>
          </div>
        </div>

        {/* Stock + Discard center — fixed */}
        <div className="shrink-0 flex items-start gap-6 justify-center bg-felt/40 py-3 rounded-md border border-zinc-700">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`${myTurn && state.phase === 'draw' ? 'cursor-pointer hover:scale-105' : 'opacity-80'} transition-transform`}
              onClick={() => myTurn && state.phase === 'draw' && props.onDrawStock()}
            >
              {state.stockCount > 0 ? (
                <FlipCard id="stock" disabled>
                  <Card card={{ id: 'stock', suit: 'S', rank: 'A' }} faceDown title="Stock" />
                </FlipCard>
              ) : (
                <div className="w-20 h-28 rounded-md border-2 border-dashed border-zinc-500 flex items-center justify-center text-xs text-zinc-400">
                  empty
                </div>
              )}
            </div>
            <div className="text-xs text-zinc-300">Stock · {state.stockCount}</div>
            {myTurn && state.phase === 'draw' && state.stockCount > 0 && (
              <button className="text-xs text-amber-300 underline" onClick={() => props.onDrawStock()}>
                Draw
              </button>
            )}
          </div>
          <DiscardPile
            discard={state.discard}
            canDraw={myTurn && state.phase === 'draw'}
            onDrawAtDepth={tryDrawDiscard}
          />
        </div>

        {/* Pending-draw-discard prompt */}
        {pendingDiscardDepth !== null && promptDeepCard && (
          <div className="shrink-0 bg-amber-950/80 border border-amber-400 p-3 rounded-md text-sm">
            <div className="mb-2">
              Picking up {pendingDiscardDepth} card{pendingDiscardDepth > 1 ? 's' : ''}. The deepest
              ({promptDeepCard.rank}{promptDeepCard.suit}) is required in the meld. Click any other
              taken card to include it (highlighted) or exclude it (sent to your hand). Then add
              hand cards by clicking them below and confirm.
            </div>
            <div className="flex gap-1.5 mb-3">
              {promptTakenCards.map((c) => {
                const inMeld = selectedTakenIds.has(c.id) || c.id === promptDeepCard.id;
                const locked = c.id === promptDeepCard.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleTaken(c.id, promptDeepCard.id)}
                    className={`relative ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    title={locked ? 'Required (deepest)' : inMeld ? 'In meld — click to send to hand' : 'In hand — click to add to meld'}
                  >
                    <Card card={c} small selected={inMeld} />
                    {locked && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] bg-amber-400 text-black rounded-full px-1.5 py-0.5 font-semibold whitespace-nowrap">
                        required
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button className="rounded bg-amber-500 px-3 py-1 text-black font-semibold" onClick={confirmDrawDiscardMeld}>
                Confirm
              </button>
              <button className="rounded bg-zinc-700 px-3 py-1" onClick={cancelDrawDiscard}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* My hand — fixed at bottom */}
        <div className="shrink-0">
          <div className="flex justify-between items-center mb-1">
            <div className="text-xs uppercase text-zinc-300">Your hand · {hand.length} cards</div>
            <div className="flex gap-2">
              {selectionKind && (
                <button
                  className="rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-sm font-semibold"
                  disabled={!myTurn || state.phase !== 'meld'}
                  onClick={tryMeldNew}
                >
                  Meld {selectionKind === 'set' ? 'set' : 'run'} ({selectedIds.length})
                </button>
              )}
              <button
                className="rounded bg-rose-600 hover:bg-rose-500 px-3 py-1 text-sm font-semibold disabled:opacity-50"
                disabled={!myTurn || state.phase !== 'meld' || selectedIds.length !== 1}
                onClick={tryDiscard}
                title="Discard 1 selected card"
              >
                Discard
              </button>
              {selectedIds.length > 0 && (
                <button className="text-xs text-zinc-300 underline" onClick={clearSelection}>
                  clear
                </button>
              )}
            </div>
          </div>
          <Hand cards={hand} selectedIds={selectedIds} onToggle={toggleSelect} />
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-full md:w-72 p-3 md:p-4 md:border-l md:border-zinc-700 space-y-3 md:overflow-y-auto">
        <Scoreboard state={state} />
        <div><BackgroundPicker align="left" /></div>
        <div className="text-xs text-zinc-400 leading-snug">
          <div className="font-semibold text-zinc-200 mb-1">Turn flow</div>
          1. Draw from stock or take discard.<br />
          2. Meld sets/runs or lay off (optional).<br />
          3. Discard one card.<br />
          <br />
          Sets = 3+ same rank. Runs = 3+ same suit, consecutive. Score: {state.simplifiedScoring ? '2-9 → 5, 10-K → 10, A → 5/15' : '2-9 → face value, 10-K → 10, A → 1/15'}. First to {state.winningScore} wins.
        </div>
      </div>
    </div>
  );
}
