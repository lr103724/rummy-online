import { Suit } from '@rummy/shared';

interface Props {
  suit: Suit;
  size?: number | string;
  className?: string;
}

/** Inline-SVG suit glyphs. Chosen so spades and clubs read very differently
 *  at small sizes — spades are a single pointed leaf, clubs are three rounded
 *  lobes. Color follows `currentColor`. */
export function SuitIcon({ suit, size = '1em', className = '' }: Props) {
  const d = PATHS[suit];
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      className={className}
      style={{ display: 'inline-block', verticalAlign: '-0.12em', flexShrink: 0 }}
    >
      {d.kind === 'paths' ? (
        d.paths.map((p, i) => <path key={i} d={p} />)
      ) : (
        d.elements
      )}
    </svg>
  );
}

type SuitDef =
  | { kind: 'paths'; paths: string[] }
  | { kind: 'jsx'; elements: React.ReactNode };

const PATHS: Record<Suit, SuitDef> = {
  H: {
    kind: 'paths',
    paths: [
      // Classic heart: two arcs meet at a point at the bottom.
      'M16 28 C16 28 4 19 4 11 C4 7 7 4 11 4 C13.5 4 15.5 5.5 16 8 C16.5 5.5 18.5 4 21 4 C25 4 28 7 28 11 C28 19 16 28 16 28 Z',
    ],
  },
  D: {
    kind: 'paths',
    paths: [
      // Diamond: tall slim rhombus.
      'M16 3 L27 16 L16 29 L5 16 Z',
    ],
  },
  S: {
    kind: 'paths',
    paths: [
      // Spade body (inverted heart) + stem.
      'M16 3 C16 3 28 13 28 20 C28 23.5 25.3 26 22 26 C20.3 26 18.8 25.2 18 24 L19 28.5 L13 28.5 L14 24 C13.2 25.2 11.7 26 10 26 C6.7 26 4 23.5 4 20 C4 13 16 3 16 3 Z',
    ],
  },
  C: {
    kind: 'jsx',
    elements: (
      <>
        {/* Three lobes */}
        <circle cx="16" cy="9" r="5.2" />
        <circle cx="9" cy="18" r="5.2" />
        <circle cx="23" cy="18" r="5.2" />
        {/* Stem */}
        <path d="M14 18 L18 18 L19.5 29 L12.5 29 Z" />
      </>
    ),
  },
};
