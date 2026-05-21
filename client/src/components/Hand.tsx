import { useEffect, useMemo, useRef, useState } from 'react';
import { Card as CardT } from '@rummy/shared';
import { Card } from './Card';
import { FlipCard } from './Flip';

type SortMode = 'suit' | 'rank';

const SUIT_ORDER: Record<string, number> = { S: 0, H: 1, C: 2, D: 3 };
const RANK_LIST = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

interface Props {
  cards: CardT[];
  selectedIds: string[];
  onToggle(id: string): void;
}

export function Hand({ cards, selectedIds, onToggle }: Props) {
  const sel = new Set(selectedIds);
  const [sortMode, setSortMode] = useState<SortMode>('suit');
  const [hovered, setHovered] = useState<number | null>(null);

  // Track which card ids appear for the first time on a re-render (a draw),
  // so the FlipCard can play its two-stage preview animation. The initial deal
  // (first render) is NOT flagged as a "draw" — those cards just sweep in.
  const prevIds = useRef<Set<string>>(new Set());
  const hasMountedRef = useRef(false);
  const newIds = useMemo(() => {
    if (!hasMountedRef.current) return new Set<string>();
    const out = new Set<string>();
    for (const c of cards) if (!prevIds.current.has(c.id)) out.add(c.id);
    return out;
  }, [cards]);
  useEffect(() => {
    prevIds.current = new Set(cards.map((c) => c.id));
    hasMountedRef.current = true;
  });

  const sorted = [...cards].sort((a, b) => {
    if (sortMode === 'suit') {
      const s = SUIT_ORDER[a.suit]! - SUIT_ORDER[b.suit]!;
      if (s !== 0) return s;
      return RANK_LIST.indexOf(a.rank) - RANK_LIST.indexOf(b.rank);
    }
    const r = RANK_LIST.indexOf(a.rank) - RANK_LIST.indexOf(b.rank);
    if (r !== 0) return r;
    return SUIT_ORDER[a.suit]! - SUIT_ORDER[b.suit]!;
  });

  // Neighbors slide far enough to clear the hovered card's full width (96px cards
  // overlap by 56px; sliding by 60 fully exposes the hovered card on both sides).
  const SHIFT = 60;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-zinc-400">Sort by</span>
        <button
          onClick={() => setSortMode('suit')}
          className={`px-2 py-0.5 rounded border ${
            sortMode === 'suit'
              ? 'bg-amber-500 text-black border-amber-400 font-semibold'
              : 'bg-zinc-800 border-zinc-600 hover:border-zinc-400'
          }`}
        >Suit</button>
        <button
          onClick={() => setSortMode('rank')}
          className={`px-2 py-0.5 rounded border ${
            sortMode === 'rank'
              ? 'bg-amber-500 text-black border-amber-400 font-semibold'
              : 'bg-zinc-800 border-zinc-600 hover:border-zinc-400'
          }`}
        >Rank</button>
      </div>

      <div
        className="flex justify-center pb-6 pt-28 px-4 w-full"
        onMouseLeave={() => setHovered(null)}
      >
        <div className="stack">
          {sorted.map((c, i) => {
            const isHovered = hovered === i;
            let shiftX = 0;
            let lift = 0;
            if (hovered !== null) {
              if (i < hovered) shiftX = -SHIFT;
              else if (i > hovered) shiftX = SHIFT;
            }
            if (isHovered) lift = -22;
            const z = isHovered ? 100 : i + 1;
            return (
              <FlipCard
                key={c.id}
                id={c.id}
                fallbackId="stock"
                preview={newIds.has(c.id)}
                style={{ zIndex: z }}
              >
                <div
                  onMouseEnter={() => setHovered(i)}
                  style={{
                    transform: `translate(${shiftX}px, ${lift}px)`,
                    transition: 'transform 220ms cubic-bezier(.22,.61,.36,1)',
                  }}
                >
                  <Card card={c} selected={sel.has(c.id)} onClick={() => onToggle(c.id)} />
                </div>
              </FlipCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
