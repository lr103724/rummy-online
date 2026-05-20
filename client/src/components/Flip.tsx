import { createContext, ReactNode, useContext, useLayoutEffect, useMemo, useRef } from 'react';

interface LayoutCtx {
  pos: Map<string, DOMRect>;
}

const Ctx = createContext<LayoutCtx | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const pos = useRef(new Map<string, DOMRect>()).current;
  const value = useMemo(() => ({ pos }), [pos]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

interface Props {
  id: string;
  fallbackId?: string;
  durationMs?: number;
  /** When true, the FLIP runs in two stages: travel to a raised "preview" position above the
   *  destination, pause so the player can see the card, then settle into the final slot. */
  preview?: boolean;
  /** When true, the card pops into its destination (scale-up + fade-in) instead of FLIPping
   *  from a source. Used for cards added to an existing meld so the surrounding cards
   *  don't briefly show a gap. */
  popIn?: boolean;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Disable the FLIP animation for this card. It still registers its position. */
  disabled?: boolean;
}

const PREVIEW_STAGE1_MS = 480;
const PREVIEW_PAUSE_MS  = 520;
const PREVIEW_STAGE2_MS = 320;
const PREVIEW_LIFT_PX   = 96;
const PREVIEW_SCALE     = 1.15;

export function FlipCard({
  id, fallbackId, children, className = '', style, durationMs = 420, disabled, preview, popIn,
}: Props) {
  const ctx = useContext(Ctx);
  const ref = useRef<HTMLDivElement>(null);
  const animating = useRef(false);
  const stageTimerRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !ctx) return;
    if (animating.current) return;

    const newRect = el.getBoundingClientRect();
    if (!disabled) {
      // pop-in mode: only fires on the first effect run for this instance (no source needed).
      if (popIn && !ctx.pos.has(id)) {
        animating.current = true;
        const prevZ = el.style.zIndex;
        el.style.transition = 'none';
        el.style.transform = 'scale(0.4)';
        el.style.opacity = '0';
        el.style.zIndex = '50';
        void el.offsetHeight;
        el.style.transition = 'transform 340ms cubic-bezier(.34,1.56,.64,1), opacity 240ms ease-out';
        el.style.transform = 'scale(1)';
        el.style.opacity = '1';
        const onEnd = (e: TransitionEvent) => {
          if (e.propertyName !== 'transform') return;
          el.removeEventListener('transitionend', onEnd);
          animating.current = false;
          el.style.transition = '';
          el.style.transform = '';
          el.style.opacity = '';
          el.style.zIndex = prevZ;
          if (ctx) ctx.pos.set(id, el.getBoundingClientRect());
        };
        el.addEventListener('transitionend', onEnd);
        ctx.pos.set(id, newRect);
        return;
      }
      const src = ctx.pos.get(id) ?? (fallbackId ? ctx.pos.get(fallbackId) : null);
      if (src) {
        const dx = src.left - newRect.left;
        const dy = src.top - newRect.top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          animating.current = true;
          const prevZ = el.style.zIndex;
          el.style.transition = 'none';
          el.style.transform = `translate(${dx}px, ${dy}px) scale(0.96)`;
          el.style.zIndex = '50';
          void el.offsetHeight;

          const finish = () => {
            animating.current = false;
            el.style.transition = '';
            el.style.transform = '';
            el.style.zIndex = prevZ;
            if (ctx) ctx.pos.set(id, el.getBoundingClientRect());
          };

          if (preview) {
            // Stage 1: travel to a raised preview spot above the destination.
            el.style.transition = `transform ${PREVIEW_STAGE1_MS}ms cubic-bezier(.22,.61,.36,1)`;
            el.style.transform = `translate(0, -${PREVIEW_LIFT_PX}px) scale(${PREVIEW_SCALE})`;
            // Stage 2 fires after the pause. Cancel any prior stage timer first.
            if (stageTimerRef.current !== null) clearTimeout(stageTimerRef.current);
            stageTimerRef.current = window.setTimeout(() => {
              stageTimerRef.current = null;
              if (!el.isConnected) { animating.current = false; return; }
              el.style.transition = `transform ${PREVIEW_STAGE2_MS}ms cubic-bezier(.4,0,.2,1)`;
              el.style.transform = 'translate(0,0) scale(1)';
              const onEnd = (e: TransitionEvent) => {
                if (e.propertyName !== 'transform') return;
                el.removeEventListener('transitionend', onEnd);
                finish();
              };
              el.addEventListener('transitionend', onEnd);
            }, PREVIEW_STAGE1_MS + PREVIEW_PAUSE_MS);
          } else {
            el.style.transition = `transform ${durationMs}ms cubic-bezier(.22,.61,.36,1)`;
            el.style.transform = 'translate(0,0) scale(1)';
            const onEnd = (e: TransitionEvent) => {
              if (e.propertyName !== 'transform') return;
              el.removeEventListener('transitionend', onEnd);
              finish();
            };
            el.addEventListener('transitionend', onEnd);
          }
        }
      }
    }
    ctx.pos.set(id, newRect);
  });

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
