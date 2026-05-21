import { useMemo } from 'react';

interface Props {
  /** Number of confetti pieces to spawn. */
  count?: number;
  /** Bumps the React key so callers can force a fresh burst on re-trigger. */
  burstKey?: string | number;
}

const COLORS = ['#f59e0b', '#ec4899', '#10b981', '#3b82f6', '#a855f7', '#facc15', '#ef4444'];

export function Confetti({ count = 80, burstKey = 0 }: Props) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.2 + Math.random() * 1.8,
        color: COLORS[i % COLORS.length],
        drift: (Math.random() - 0.5) * 240,
        rotateEnd: (Math.random() * 4 + 1) * 360 * (Math.random() < 0.5 ? -1 : 1),
        w: Math.random() < 0.5 ? 8 : 10,
        h: Math.random() < 0.5 ? 12 : 14,
      })),
    [count, burstKey],
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.left}%`,
            top: '-30px',
            width: `${p.w}px`,
            height: `${p.h}px`,
            background: p.color,
            animation: `confetti-fall ${p.duration}s cubic-bezier(.22,.61,.36,1) ${p.delay}s forwards`,
            ['--drift' as any]: `${p.drift}px`,
            ['--rotate-end' as any]: `${p.rotateEnd}deg`,
          }}
        />
      ))}
    </div>
  );
}
