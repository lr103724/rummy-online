import { ClientGameState } from '@rummy/shared';

interface Props { state: ClientGameState; }

export function Scoreboard({ state }: Props) {
  const sorted = [...state.players].sort((a, b) => b.totalScore - a.totalScore);
  return (
    <div className="bg-feltDark/60 border border-zinc-600 rounded-md p-2 text-sm">
      <div className="text-xs uppercase tracking-wide text-zinc-300 mb-1">Score · target {state.winningScore}</div>
      <ul className="space-y-0.5">
        {sorted.map((p) => {
          const isTurn = state.players[state.turnIndex]?.id === p.id;
          return (
            <li key={p.id} className={`flex justify-between gap-3 ${isTurn ? 'text-amber-300' : ''}`}>
              <span className="truncate">
                {isTurn ? '▶ ' : ''}{p.name}
                {!p.connected && <span className="ml-1 text-rose-400 text-xs">(offline)</span>}
              </span>
              <span className="tabular-nums">{p.totalScore}{p.roundMeldScore ? ` (+${p.roundMeldScore})` : ''}</span>
            </li>
          );
        })}
      </ul>
      <div className="text-xs text-zinc-400 mt-2">Round {state.roundNumber} · Stock: {state.stockCount}</div>
    </div>
  );
}
