import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame, loadSavedSession } from '../store/gameStore';
import { Table } from '../components/Table';
import { ToastStack } from '../components/Toast';
import { LayoutProvider } from '../components/Flip';
import { Confetti } from '../components/Confetti';

export function Room() {
  const { roomCode = '' } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const state = useGame((s) => s.state);
  const myId = useGame((s) => s.playerId);
  const myName = useGame((s) => s.myName);
  const attach = useGame((s) => s.attachListeners);
  const join = useGame((s) => s.joinRoom);
  const rejoin = useGame((s) => s.rejoinRoom);
  const startGame = useGame((s) => s.startGame);
  const nextRound = useGame((s) => s.nextRound);
  const drawStock = useGame((s) => s.drawStock);
  const drawDiscard = useGame((s) => s.drawDiscard);
  const meld = useGame((s) => s.meld);
  const layOff = useGame((s) => s.layOff);
  const discard = useGame((s) => s.discard);
  const callRummy = useGame((s) => s.callRummy);

  useEffect(() => {
    attach();
    // Decide how to attach to this room.
    const saved = loadSavedSession();
    if (saved && saved.roomCode === roomCode) {
      rejoin(saved.roomCode, saved.playerId).catch(() => {
        // Stale session — clear and ask for name.
        if (myName) join(roomCode, myName).catch(() => navigate('/'));
        else navigate('/');
      });
    } else if (myName) {
      join(roomCode, myName).catch(() => navigate('/'));
    } else {
      navigate('/');
    }
  }, [roomCode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ToastStack />
        <div className="text-zinc-300">Joining room {roomCode}…</div>
      </div>
    );
  }

  const isHost = state.hostId === myId;

  if (state.phase === 'lobby') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <ToastStack />
        <div className="bg-feltDark/80 border border-zinc-700 rounded-lg p-6 max-w-md w-full space-y-4">
          <h2 className="text-2xl font-bold text-amber-300">Lobby · {state.roomCode}</h2>
          <p className="text-sm text-zinc-300">
            Share this link: <span className="font-mono">{window.location.origin}/r/{state.roomCode}</span>
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-600">First to {state.winningScore}</span>
            <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-600">
              Rummy: {state.rummyWindowMs === 0 ? 'off' : `${state.rummyWindowMs / 1000}s`}
            </span>
            <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-600">
              Ace: {state.aceHigh ? 'high or low' : 'low only'}
            </span>
            <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-600">
              Scoring: {state.simplifiedScoring ? 'simplified (flat 5/10/15)' : 'standard (face value)'}
            </span>
            <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-600">
              Decks: {state.numDecks}
            </span>
            <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-600">
              Hand: {state.startingHandSize === 0 ? 'auto' : state.startingHandSize}
            </span>
            <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-600">
              Boathouse: {state.boathouseRule ? 'on' : 'off'}
            </span>
          </div>
          <div>
            <div className="text-xs uppercase text-zinc-400 mb-1">Players ({state.players.length}/6)</div>
            <ul className="space-y-1">
              {state.players.map((p) => (
                <li key={p.id} className="flex justify-between bg-zinc-800/60 px-3 py-1 rounded">
                  <span>
                    {p.id === state.hostId && '👑 '}{p.name}{p.id === myId && ' (you)'}
                  </span>
                  {!p.connected && <span className="text-rose-400 text-xs">offline</span>}
                </li>
              ))}
            </ul>
          </div>
          {isHost ? (
            <button
              className="w-full rounded bg-emerald-600 hover:bg-emerald-500 px-4 py-2 font-semibold disabled:opacity-50"
              disabled={state.players.length < 2}
              onClick={() => startGame()}
            >
              Start game ({state.players.length < 2 ? 'need 2+ players' : 'deal'})
            </button>
          ) : (
            <div className="text-sm text-zinc-300 text-center">Waiting for host to start…</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <LayoutProvider>
      <ToastStack />
      <Table
        state={state}
        myId={myId}
        onDrawStock={drawStock}
        onDrawDiscard={drawDiscard}
        onMeld={meld}
        onLayOff={layOff}
        onDiscard={discard}
        onCallRummy={callRummy}
      />
      {(state.phase === 'roundEnd' || state.phase === 'gameEnd') && state.lastRoundSummary && (
        (state.lastRoundSummary.wentOut === myId
          || (state.phase === 'gameEnd' && state.winnerId === myId))
          ? <Confetti
              count={state.phase === 'gameEnd' && state.winnerId === myId ? 140 : 70}
              burstKey={`${state.roundNumber}-${state.phase}`}
            />
          : null
      )}
      {(state.phase === 'roundEnd' || state.phase === 'gameEnd') && state.lastRoundSummary && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-40">
          <div className="bg-feltDark border border-zinc-600 rounded-lg p-6 max-w-md w-full space-y-3">
            <h3 className="text-xl font-bold text-amber-300">
              {state.phase === 'gameEnd'
                ? `🏆 ${state.players.find((p) => p.id === state.winnerId)?.name ?? '???'} wins!`
                : `Round ${state.lastRoundSummary.roundNumber} ended`}
            </h3>
            {state.lastRoundSummary.wentOut && (
              <div className="text-sm text-zinc-300">
                {state.players.find((p) => p.id === state.lastRoundSummary!.wentOut)?.name} went out.
              </div>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-400 text-xs uppercase">
                  <th className="text-left">Player</th>
                  <th>Meld</th>
                  <th>Hand</th>
                  <th>Δ</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {state.lastRoundSummary.perPlayer.map((r) => (
                  <tr key={r.playerId} className="border-t border-zinc-700">
                    <td className="py-1">{r.name}</td>
                    <td className="text-center">+{r.meldPoints}</td>
                    <td className="text-center">−{r.handPenalty}</td>
                    <td className={`text-center ${r.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {r.delta >= 0 ? '+' : ''}{r.delta}
                    </td>
                    <td className="text-center font-semibold">{r.totalScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {state.phase === 'roundEnd' && isHost && (
              <button
                className="w-full rounded bg-emerald-600 hover:bg-emerald-500 px-4 py-2 font-semibold"
                onClick={() => nextRound()}
              >
                Deal next round
              </button>
            )}
            {state.phase === 'roundEnd' && !isHost && (
              <div className="text-center text-sm text-zinc-300">Waiting for host…</div>
            )}
            {state.phase === 'gameEnd' && isHost && (
              <button
                className="w-full rounded bg-amber-500 text-black hover:bg-amber-400 px-4 py-2 font-semibold"
                onClick={() => startGame()}
              >
                New game
              </button>
            )}
          </div>
        </div>
      )}
    </LayoutProvider>
  );
}
