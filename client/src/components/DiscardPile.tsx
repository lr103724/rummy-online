import { Card as CardT } from '@rummy/shared';
import { Card } from './Card';
import { FlipCard } from './Flip';

interface Props {
  discard: CardT[];
  canDraw: boolean;
  onDrawAtDepth(depth: number): void;
}

export function DiscardPile({ discard, canDraw, onDrawAtDepth }: Props) {
  if (discard.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="w-16 h-24 border-2 border-dashed border-zinc-400 rounded-md flex items-center justify-center text-zinc-400 text-xs">
          empty
        </div>
        <div className="text-xs text-zinc-300">Discard</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-xs text-zinc-300">
        Discard · {discard.length}
        {canDraw && discard.length > 1 && (
          <span className="ml-2 text-amber-300">(click a card to take from there)</span>
        )}
      </div>
      <div className="flex stack-discard flex-wrap justify-center max-w-[520px]">
        {discard.map((c, i) => {
          const depth = discard.length - i;
          return (
            <FlipCard key={c.id} id={c.id} style={{ zIndex: i + 1 }}>
              <div
                className={canDraw ? 'cursor-pointer hover:-translate-y-1 transition-transform' : ''}
                title={canDraw ? `Take ${depth} card${depth > 1 ? 's' : ''}` : `${c.rank}${c.suit}`}
              >
                <Card card={c} small onClick={canDraw ? () => onDrawAtDepth(depth) : undefined} />
              </div>
            </FlipCard>
          );
        })}
      </div>
      {canDraw && (
        <button
          className="text-xs text-amber-300 underline"
          onClick={() => onDrawAtDepth(1)}
        >
          Take top card
        </button>
      )}
    </div>
  );
}
