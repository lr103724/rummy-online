import { io, Socket } from 'socket.io-client';

/** Resolve the game-server URL:
 *  1. Explicit override via VITE_SERVER_URL (set on Vercel for production).
 *  2. Otherwise, if the page is being served from localhost, talk to a local
 *     dev server. If served from anywhere else (any deployed origin), default
 *     to the production server on Render. This makes the deployed client work
 *     even if VITE_SERVER_URL didn't make it into the build. */
function resolveServerUrl(): string {
  const fromEnv = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1' && host !== '0.0.0.0') {
      return 'https://rummy-online-server.onrender.com';
    }
  }
  return 'http://localhost:3001';
}

const URL = resolveServerUrl();

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (_socket) return _socket;
  _socket = io(URL, {
    autoConnect: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 8,
  });
  return _socket;
}
