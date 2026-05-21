import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame, loadSavedSession } from '../store/gameStore';
import { ToastStack } from '../components/Toast';
import { BackgroundPicker } from '../components/BackgroundPicker';

export function Home() {
  const navigate = useNavigate();
  const attach = useGame((s) => s.attachListeners);
  const create = useGame((s) => s.createRoom);
  const join = useGame((s) => s.joinRoom);
  const rejoin = useGame((s) => s.rejoinRoom);
  const myName = useGame((s) => s.myName);
  const setName = useGame((s) => s.setName);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const [winningScore, setWinningScore] = useState(500);
  const [rummyWindowMs, setRummyWindowMs] = useState(3000);
  const [aceHigh, setAceHigh] = useState(false);
  const [simplifiedScoring, setSimplifiedScoring] = useState(false);
  const [numDecks, setNumDecks] = useState(1);
  const [startingHandSize, setStartingHandSize] = useState(0); // 0 = auto

  useEffect(() => {
    attach();
    const saved = loadSavedSession();
    if (saved) setCode(saved.roomCode);
  }, [attach]);

  const onCreate = async () => {
    setError(null);
    if (!myName.trim()) { setError('Enter your name'); return; }
    try {
      setBusy(true);
      const { roomCode } = await create(myName.trim(), {
        winningScore, rummyWindowMs, aceHigh, simplifiedScoring, numDecks, startingHandSize,
      });
      navigate(`/r/${roomCode}`);
    } catch (e: any) { setError(e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  const onJoin = async () => {
    setError(null);
    const c = code.trim().toUpperCase();
    if (!myName.trim()) { setError('Enter your name'); return; }
    if (c.length !== 4) { setError('Room code is 4 letters'); return; }
    try {
      setBusy(true);
      await join(c, myName.trim());
      navigate(`/r/${c}`);
    } catch (e: any) { setError(e?.message ?? 'Failed'); }
    finally { setBusy(false); }
  };

  const onResume = async () => {
    const saved = loadSavedSession();
    if (!saved) return;
    try {
      setBusy(true);
      await rejoin(saved.roomCode, saved.playerId);
      navigate(`/r/${saved.roomCode}`);
    } catch (e: any) { setError(e?.message ?? 'Could not resume'); }
    finally { setBusy(false); }
  };

  const saved = loadSavedSession();
  const scoreChoices = [250, 500, 750, 1000];
  const windowChoices: Array<{ label: string; v: number }> = [
    { label: 'Off', v: 0 },
    { label: '2s', v: 2000 },
    { label: '3s', v: 3000 },
    { label: '5s', v: 5000 },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6 relative">
      <ToastStack />
      <div className="absolute top-3 right-3"><BackgroundPicker /></div>
      <div className="bg-feltDark/80 border border-zinc-700 rounded-lg p-6 w-full max-w-md space-y-4 shadow-xl">
        <h1 className="text-3xl font-bold text-amber-300">500 Rummy</h1>
        <p className="text-sm text-zinc-300">Create a room or join one with a 4-letter code.</p>

        <label className="block">
          <span className="text-xs uppercase text-zinc-400">Your name</span>
          <input
            className="w-full mt-1 rounded px-3 py-2 bg-zinc-800 border border-zinc-600 text-zinc-100"
            value={myName}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alice"
          />
        </label>

        <div>
          <button
            type="button"
            className="text-xs text-amber-300 underline"
            onClick={() => setShowOptions((s) => !s)}
          >
            {showOptions ? '▾ Hide rule options' : '▸ Show rule options'}
          </button>
          {showOptions && (
            <div className="mt-3 space-y-3 bg-zinc-900/60 border border-zinc-700 rounded p-3">
              <div>
                <div className="text-xs uppercase text-zinc-400 mb-1">Winning score</div>
                <div className="flex gap-1">
                  {scoreChoices.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setWinningScore(s)}
                      className={`flex-1 rounded px-2 py-1 text-sm border ${
                        winningScore === s
                          ? 'bg-amber-500 text-black border-amber-400 font-semibold'
                          : 'bg-zinc-800 border-zinc-600 hover:border-zinc-400'
                      }`}
                    >{s}</button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase text-zinc-400 mb-1">Rummy call window</div>
                <div className="flex gap-1">
                  {windowChoices.map((c) => (
                    <button
                      key={c.v}
                      type="button"
                      onClick={() => setRummyWindowMs(c.v)}
                      className={`flex-1 rounded px-2 py-1 text-sm border ${
                        rummyWindowMs === c.v
                          ? 'bg-amber-500 text-black border-amber-400 font-semibold'
                          : 'bg-zinc-800 border-zinc-600 hover:border-zinc-400'
                      }`}
                    >{c.label}</button>
                  ))}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  How long others have to call "Rummy" after a discard. Off = next turn instantly.
                </div>
              </div>

              <div>
                <div className="text-xs uppercase text-zinc-400 mb-1">Number of decks</div>
                <div className="flex gap-1">
                  {[1, 2].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNumDecks(n)}
                      className={`flex-1 rounded px-2 py-1 text-sm border ${
                        numDecks === n
                          ? 'bg-amber-500 text-black border-amber-400 font-semibold'
                          : 'bg-zinc-800 border-zinc-600 hover:border-zinc-400'
                      }`}
                    >{n === 1 ? '1 deck (52)' : '2 decks (104)'}</button>
                  ))}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Two decks allow larger sets (up to 8 of a rank) and longer rounds.
                </div>
              </div>

              <div>
                <div className="text-xs uppercase text-zinc-400 mb-1">Starting hand size</div>
                <div className="flex gap-1 flex-wrap">
                  {[
                    { v: 0, label: 'Auto' },
                    { v: 7, label: '7' },
                    { v: 10, label: '10' },
                    { v: 13, label: '13' },
                  ].map((c) => (
                    <button
                      key={c.v}
                      type="button"
                      onClick={() => setStartingHandSize(c.v)}
                      className={`flex-1 rounded px-2 py-1 text-sm border ${
                        startingHandSize === c.v
                          ? 'bg-amber-500 text-black border-amber-400 font-semibold'
                          : 'bg-zinc-800 border-zinc-600 hover:border-zinc-400'
                      }`}
                    >{c.label}</button>
                  ))}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Auto = 13 for 2 players, 7 for 3+. Override if you want a different pace.
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 accent-amber-400"
                  checked={aceHigh}
                  onChange={(e) => setAceHigh(e.target.checked)}
                />
                <div>
                  <div className="text-sm">Ace can be high in runs</div>
                  <div className="text-[11px] text-zinc-400">Allows Q-K-A. Default is ace-low only (A-2-3).</div>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 accent-amber-400"
                  checked={simplifiedScoring}
                  onChange={(e) => setSimplifiedScoring(e.target.checked)}
                />
                <div>
                  <div className="text-sm">Simplified scoring</div>
                  <div className="text-[11px] text-zinc-400">
                    <span className="font-semibold">On:</span> 2–9 each = 5, 10/J/Q/K = 10, Ace = 5 in low run / 15 elsewhere.<br />
                    <span className="font-semibold">Off (default):</span> 2–9 = face value, 10/J/Q/K = 10, Ace = 1 in low run / 15 elsewhere.
                  </div>
                </div>
              </label>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            className="flex-1 rounded bg-emerald-600 hover:bg-emerald-500 px-4 py-2 font-semibold disabled:opacity-50"
            disabled={busy}
            onClick={onCreate}
          >
            Create room
          </button>
        </div>

        <div className="border-t border-zinc-700 pt-4">
          <label className="block">
            <span className="text-xs uppercase text-zinc-400">Room code</span>
            <input
              className="w-full mt-1 rounded px-3 py-2 bg-zinc-800 border border-zinc-600 text-zinc-100 uppercase tracking-widest font-mono text-lg"
              value={code}
              maxLength={4}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD"
            />
          </label>
          <button
            className="w-full mt-2 rounded bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 font-semibold disabled:opacity-50"
            disabled={busy}
            onClick={onJoin}
          >
            Join room
          </button>
        </div>

        {saved && (
          <button
            className="w-full text-sm text-zinc-300 underline"
            onClick={onResume}
          >
            Resume previous session ({saved.roomCode})
          </button>
        )}

        {error && <div className="text-rose-400 text-sm">{error}</div>}
      </div>
    </div>
  );
}
