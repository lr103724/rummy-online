import { useEffect, useState } from 'react';

const COLORS = [
  { name: 'felt',     hex: '#0a4f2a' },
  { name: 'navy',     hex: '#1e3a8a' },
  { name: 'burgundy', hex: '#7c2d12' },
  { name: 'purple',   hex: '#4c1d95' },
  { name: 'slate',    hex: '#1f2937' },
  { name: 'charcoal', hex: '#18181b' },
];

const PATTERNS = ['solid', 'felt', 'dots', 'grid', 'diamonds'] as const;
type Pattern = typeof PATTERNS[number];

const COLOR_KEY = 'rummy.bg.color';
const PATTERN_KEY = 'rummy.bg.pattern';

export function useBackground() {
  const [color, setColor] = useState<string>(() => localStorage.getItem(COLOR_KEY) ?? '#0a4f2a');
  const [pattern, setPattern] = useState<Pattern>(() => {
    const v = localStorage.getItem(PATTERN_KEY) as Pattern | null;
    return v && PATTERNS.includes(v) ? v : 'felt';
  });

  useEffect(() => {
    localStorage.setItem(COLOR_KEY, color);
    localStorage.setItem(PATTERN_KEY, pattern);
    document.body.style.backgroundColor = color;
    document.body.classList.remove(...PATTERNS.map((p) => `bg-pat-${p}`));
    document.body.classList.add(`bg-pat-${pattern}`);
  }, [color, pattern]);

  return { color, pattern, setColor, setPattern };
}

export function BackgroundPicker({ align = 'right' }: { align?: 'left' | 'right' }) {
  const { color, pattern, setColor, setPattern } = useBackground();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-600 hover:border-zinc-400"
      >
        🎨 Background
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full mt-1 bg-zinc-900 border border-zinc-700 rounded p-3 z-30 w-56 shadow-xl`}
          >
            <div className="text-xs uppercase text-zinc-400 mb-1">Color</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  style={{ background: c.hex }}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    color === c.hex ? 'border-amber-400 ring-2 ring-amber-200/40' : 'border-zinc-600'
                  }`}
                  title={c.name}
                />
              ))}
              <label
                className="w-7 h-7 rounded-full border-2 border-zinc-600 hover:border-amber-400 cursor-pointer flex items-center justify-center text-[10px]"
                style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
                title="custom"
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="opacity-0 w-0 h-0"
                />
              </label>
            </div>
            <div className="text-xs uppercase text-zinc-400 mb-1">Pattern</div>
            <div className="grid grid-cols-3 gap-1">
              {PATTERNS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPattern(p)}
                  className={`text-xs px-2 py-1 rounded border capitalize ${
                    pattern === p
                      ? 'bg-amber-500 text-black border-amber-400 font-semibold'
                      : 'bg-zinc-800 border-zinc-600 hover:border-zinc-400'
                  }`}
                >{p}</button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
