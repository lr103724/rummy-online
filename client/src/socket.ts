import { io, Socket } from 'socket.io-client';

const URL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:3001';

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
