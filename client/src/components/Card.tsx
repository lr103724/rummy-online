import { Card as CardT } from '@rummy/shared';

const SUIT_GLYPH: Record<string, string> = { H: '♥', D: '♦', C: '♣', S: '♠' };

interface Props {
  card: CardT;
  selected?: boolean;
  onClick?: () => void;
  /** Compact size used for meld piles and the discard fan. */
  small?: boolean;
  faceDown?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export function Card({ card, selected, onClick, small, faceDown, className = '', style, title }: Props) {
  const dim = small
    ? { w: 'w-20', h: 'h-28', rank: 'text-xl', cornerSuit: '13px', suit: 'text-4xl', topPad: 'top-1.5 left-2' }
    : { w: 'w-24', h: 'h-32', rank: 'text-3xl', cornerSuit: '17px', suit: 'text-5xl', topPad: 'top-1.5 left-2.5' };

  if (faceDown) {
    return (
      <div className={`bicycle-back ${dim.w} ${dim.h} ${className}`} style={style} title={title}>
        <div className="bicycle-back-inner" />
      </div>
    );
  }

  const isRed = card.suit === 'H' || card.suit === 'D';
  const colorClass = isRed ? 'card-red' : 'card-black';
  const glyph = SUIT_GLYPH[card.suit];

  return (
    <button
      type="button"
      title={title ?? `${card.rank}${glyph}`}
      onClick={onClick}
      style={style}
      className={`bicycle-card relative ${dim.w} ${dim.h} ${className} ${colorClass} selectable ${
        selected ? 'selected' : ''
      }`}
    >
      <div className={`absolute ${dim.topPad} leading-none flex flex-col items-center`}>
        <span className={`font-extrabold ${dim.rank}`}>{card.rank}</span>
        <span className="font-bold leading-none" style={{ fontSize: dim.cornerSuit, marginTop: '1px' }}>
          {glyph}
        </span>
      </div>
      <div className={`absolute inset-0 flex items-center justify-center leading-none ${dim.suit}`}>
        <span className="font-bold drop-shadow-sm">{glyph}</span>
      </div>
    </button>
  );
}
