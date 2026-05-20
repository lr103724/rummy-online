import { ClientGameState, ErrorPayload, EVT, ToastPayload } from '@rummy/shared';
import { create } from 'zustand';
import { getSocket } from '../socket';

interface Toast {
  id: number;
  kind: 'info' | 'success' | 'warn' | 'error';
  text: string;
}

interface State {
  state: ClientGameState | null;
  roomCode: string | null;
  playerId: string | null;
  myName: string;
  toasts: Toast[];
  lastError: ErrorPayload | null;
  connected: boolean;
  setName(name: string): void;
  pushToast(t: Omit<Toast, 'id'>): void;
  dismissToast(id: number): void;
  attachListeners(): void;
  createRoom(name: string, opts?: { winningScore?: number; rummyWindowMs?: number; aceHigh?: boolean; contextualAceScoring?: boolean; numDecks?: number; startingHandSize?: number }): Promise<{ roomCode: string; playerId: string }>;
  joinRoom(roomCode: string, name: string): Promise<{ roomCode: string; playerId: string }>;
  rejoinRoom(roomCode: string, playerId: string): Promise<void>;
  startGame(): void;
  nextRound(): void;
  drawStock(): void;
  drawDiscard(depth: number, meldCardIds: string[], targetMeldId?: string): void;
  meld(cardIds: string[], targetMeldId?: string): void;
  layOff(cardId: string, meldId: string): void;
  discard(cardId: string): void;
  callRummy(meldId: string): void;
}

const STORAGE_KEY = 'rummy.session.v1';
type Session = { roomCode: string; playerId: string; name: string };

function loadSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'); }
  catch { return null; }
}
function saveSession(s: Session | null) {
  if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  else localStorage.removeItem(STORAGE_KEY);
}

let toastSeq = 1;
let listenersAttached = false;

export const useGame = create<State>((set, get) => ({
  state: null,
  roomCode: null,
  playerId: null,
  myName: loadSession()?.name ?? '',
  toasts: [],
  lastError: null,
  connected: false,

  setName(name) { set({ myName: name }); },

  pushToast(t) {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { id, ...t }] }));
    setTimeout(() => get().dismissToast(id), 3500);
  },
  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
  },

  attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    const sock = getSocket();
    sock.on('connect', () => set({ connected: true }));
    sock.on('disconnect', () => set({ connected: false }));
    sock.on(EVT.STATE_UPDATE, (state: ClientGameState) => set({ state }));
    sock.on(EVT.ERROR, (err: ErrorPayload) => {
      set({ lastError: err });
      get().pushToast({ kind: 'error', text: err.message });
    });
    sock.on(EVT.TOAST, (t: ToastPayload) => {
      get().pushToast({ kind: t.kind ?? 'info', text: t.text });
    });
    sock.on(EVT.ROOM_CLOSED, () => {
      get().pushToast({ kind: 'warn', text: 'Room closed' });
      saveSession(null);
      set({ state: null, roomCode: null, playerId: null });
    });
  },

  async createRoom(name, opts) {
    const sock = getSocket();
    return new Promise((resolve, reject) => {
      sock.emit(EVT.ROOM_CREATE, { name, ...(opts ?? {}) }, (resp: any) => {
        if (resp?.roomCode) {
          saveSession({ roomCode: resp.roomCode, playerId: resp.playerId, name });
          set({ roomCode: resp.roomCode, playerId: resp.playerId, myName: name });
          resolve(resp);
        } else reject(new Error('Failed to create room'));
      });
    });
  },

  async joinRoom(roomCode, name) {
    const sock = getSocket();
    return new Promise((resolve, reject) => {
      sock.emit(EVT.ROOM_JOIN, { roomCode, name }, (resp: any) => {
        if (resp?.playerId) {
          saveSession({ roomCode, playerId: resp.playerId, name });
          set({ roomCode, playerId: resp.playerId, myName: name });
          resolve(resp);
        } else reject(new Error('Failed to join'));
      });
    });
  },

  async rejoinRoom(roomCode, playerId) {
    const sock = getSocket();
    return new Promise((resolve, reject) => {
      sock.emit(EVT.ROOM_REJOIN, { roomCode, playerId }, (resp: any) => {
        if (resp?.playerId) {
          set({ roomCode, playerId });
          resolve();
        } else reject(new Error('Rejoin failed'));
      });
    });
  },

  startGame() { getSocket().emit(EVT.GAME_START); },
  nextRound() { getSocket().emit(EVT.NEXT_ROUND); },
  drawStock() { getSocket().emit(EVT.TURN_DRAW_STOCK); },
  drawDiscard(depth, meldCardIds, targetMeldId) {
    getSocket().emit(EVT.TURN_DRAW_DISCARD, { depth, meldCardIds, targetMeldId });
  },
  meld(cardIds, targetMeldId) {
    getSocket().emit(EVT.TURN_MELD, { cardIds, targetMeldId });
  },
  layOff(cardId, meldId) { getSocket().emit(EVT.TURN_LAYOFF, { cardId, meldId }); },
  discard(cardId) { getSocket().emit(EVT.TURN_DISCARD, { cardId }); },
  callRummy(meldId) { getSocket().emit(EVT.TURN_CALL_RUMMY, { meldId }); },
}));

export function loadSavedSession(): Session | null { return loadSession(); }
export function clearSavedSession() { saveSession(null); }
