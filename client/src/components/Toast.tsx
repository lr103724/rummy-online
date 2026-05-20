import { useGame } from '../store/gameStore';

export function ToastStack() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  return (
    <div className="fixed top-3 right-3 z-50 flex flex-col gap-2 max-w-xs">
      {toasts.map((t) => {
        const colors = {
          info: 'bg-zinc-700 text-zinc-50',
          success: 'bg-emerald-700 text-white',
          warn: 'bg-amber-600 text-white',
          error: 'bg-rose-700 text-white',
        }[t.kind];
        return (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`toast-enter ${colors} rounded shadow px-3 py-2 cursor-pointer text-sm`}
          >
            {t.text}
          </div>
        );
      })}
    </div>
  );
}
