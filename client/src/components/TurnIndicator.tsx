import { useEffect, useState } from 'react';
import { ClientGameState } from '@rummy/shared';

interface Props { state: ClientGameState; myId: string | null; }

export function TurnIndicator({ state, myId }: Props) {
  const turnPlayer = state.players[state.turnIndex];
  const isMine = turnPlayer?.id === myId;

  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => {
    if (state.phase !== 'rummyWindow' || !state.lastDiscardAt) return;
    const tick = () => {
      const elapsed = Date.now() - state.lastDiscardAt!;
      const remaining = Math.max(0, state.rummyWindowMs - elapsed);
      setSecondsLeft(Math.ceil(remaining / 1000));
    };
    tick();
    const t = setInterval(tick, 100);
    return () => clearInterval(t);
  }, [state.phase, state.lastDiscardAt, state.rummyWindowMs]);

  let label = '';
  switch (state.phase) {
    case 'lobby': label = 'Waiting in lobby'; break;
    case 'draw': label = isMine ? 'Your turn — draw' : `${turnPlayer?.name}'s turn — drawing`; break;
    case 'meld': label = isMine ? 'Your turn — meld or discard' : `${turnPlayer?.name}'s turn`; break;
    case 'discard': label = isMine ? 'Your turn — discard' : `${turnPlayer?.name} discarding`; break;
    case 'rummyWindow': label = `Rummy window… ${secondsLeft}s`; break;
    case 'roundEnd': label = 'Round ended'; break;
    case 'gameEnd': label = 'Game over'; break;
  }
  return (
    <div className={`px-3 py-1 rounded-full text-sm font-medium ${isMine && (state.phase==='draw' || state.phase==='meld') ? 'bg-amber-400 text-black' : 'bg-zinc-700 text-zinc-100'}`}>
      {label}
    </div>
  );
}
