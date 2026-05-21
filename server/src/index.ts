import cors from '@fastify/cors';
import Fastify from 'fastify';
import { Server as IOServer } from 'socket.io';
import {
  CallRummyPayload, ChatPayload, DiscardPayload, DrawDiscardPayload, EVT,
  LayOffPayload, MeldPayload, RoomCreatePayload, RoomJoinPayload, RoomRejoinPayload,
} from '@rummy/shared';
import { RoomError, RoomManager } from './rooms.js';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);

async function main() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(null, false);
    },
  });

  app.get('/health', async () => ({ ok: true, ts: Date.now() }));
  app.get('/', async () => ({ name: '500-rummy server', status: 'ok' }));

  await app.listen({ port: PORT, host: HOST });
  app.log.info({ port: PORT, allowedOrigins: ALLOWED_ORIGINS }, 'server listening');

  const io = new IOServer(app.server, {
    cors: {
      origin: ALLOWED_ORIGINS.includes('*') ? '*' : ALLOWED_ORIGINS,
      methods: ['GET', 'POST'],
    },
  });

  const rooms = new RoomManager({
    onState: (roomCode) => broadcastState(roomCode),
    onToast: (roomCode, text, kind = 'info') => {
      io.to(roomCode).emit(EVT.TOAST, { kind, text });
    },
    onClosed: (roomCode) => {
      io.to(roomCode).emit(EVT.ROOM_CLOSED, { roomCode });
    },
  });

  function broadcastState(roomCode: string) {
    const room = io.sockets.adapter.rooms.get(roomCode);
    if (!room) return;
    for (const sid of room) {
      const sock = io.sockets.sockets.get(sid);
      const playerId = (sock?.data?.playerId as string | undefined);
      if (!sock || !playerId) continue;
      const view = rooms.getStateFor(roomCode, playerId);
      if (view) sock.emit(EVT.STATE_UPDATE, view);
    }
  }

  function sendErrorTo(sock: any, e: unknown) {
    if (e instanceof RoomError) {
      sock.emit(EVT.ERROR, { code: e.code, message: e.humanMessage });
    } else {
      app.log.error({ err: e }, 'unexpected handler error');
      sock.emit(EVT.ERROR, { code: 'INTERNAL', message: 'Internal error' });
    }
  }

  io.on('connection', (sock) => {
    sock.on(EVT.ROOM_CREATE, (payload: RoomCreatePayload, ack?: (r: any) => void) => {
      try {
        const { roomCode, playerId } = rooms.createRoom(payload?.name ?? 'Player', {
          winningScore: payload?.winningScore,
          rummyWindowMs: payload?.rummyWindowMs,
          aceHigh: payload?.aceHigh,
          simplifiedScoring: payload?.simplifiedScoring,
          numDecks: payload?.numDecks,
          startingHandSize: payload?.startingHandSize,
          boathouseRule: payload?.boathouseRule,
        });
        sock.data.roomCode = roomCode;
        sock.data.playerId = playerId;
        sock.join(roomCode);
        const resp = { roomCode, playerId };
        sock.emit(EVT.ROOM_JOINED, resp);
        ack?.(resp);
        broadcastState(roomCode);
      } catch (e) { sendErrorTo(sock, e); }
    });

    sock.on(EVT.ROOM_JOIN, (payload: RoomJoinPayload, ack?: (r: any) => void) => {
      try {
        const { playerId } = rooms.joinRoom(payload.roomCode, payload.name);
        sock.data.roomCode = payload.roomCode;
        sock.data.playerId = playerId;
        sock.join(payload.roomCode);
        const resp = { roomCode: payload.roomCode, playerId };
        sock.emit(EVT.ROOM_JOINED, resp);
        ack?.(resp);
        broadcastState(payload.roomCode);
      } catch (e) { sendErrorTo(sock, e); }
    });

    sock.on(EVT.ROOM_REJOIN, (payload: RoomRejoinPayload, ack?: (r: any) => void) => {
      try {
        rooms.rejoinRoom(payload.roomCode, payload.playerId);
        sock.data.roomCode = payload.roomCode;
        sock.data.playerId = payload.playerId;
        sock.join(payload.roomCode);
        const resp = { roomCode: payload.roomCode, playerId: payload.playerId };
        sock.emit(EVT.ROOM_JOINED, resp);
        ack?.(resp);
        broadcastState(payload.roomCode);
      } catch (e) { sendErrorTo(sock, e); }
    });

    sock.on(EVT.ROOM_LEAVE, () => {
      const { roomCode, playerId } = sock.data as { roomCode?: string; playerId?: string };
      if (roomCode && playerId) {
        rooms.leaveRoom(roomCode, playerId);
        sock.leave(roomCode);
      }
    });

    sock.on(EVT.GAME_START, () => {
      const { roomCode, playerId } = sock.data as { roomCode?: string; playerId?: string };
      if (!roomCode || !playerId) return;
      try { rooms.startGame(roomCode, playerId); broadcastState(roomCode); }
      catch (e) { sendErrorTo(sock, e); }
    });

    sock.on(EVT.NEXT_ROUND, () => {
      const { roomCode, playerId } = sock.data as { roomCode?: string; playerId?: string };
      if (!roomCode || !playerId) return;
      try { rooms.startNextRound(roomCode, playerId); broadcastState(roomCode); }
      catch (e) { sendErrorTo(sock, e); }
    });

    sock.on(EVT.TURN_DRAW_STOCK, () => {
      const { roomCode, playerId } = sock.data;
      if (!roomCode || !playerId) return;
      try { rooms.drawStock(roomCode, playerId); broadcastState(roomCode); }
      catch (e) { sendErrorTo(sock, e); }
    });

    sock.on(EVT.TURN_DRAW_DISCARD, (p: DrawDiscardPayload) => {
      const { roomCode, playerId } = sock.data;
      if (!roomCode || !playerId) return;
      try {
        rooms.drawDiscard(roomCode, playerId, p.depth, p.meldCardIds, p.targetMeldId);
        broadcastState(roomCode);
      } catch (e) { sendErrorTo(sock, e); }
    });

    sock.on(EVT.TURN_MELD, (p: MeldPayload) => {
      const { roomCode, playerId } = sock.data;
      if (!roomCode || !playerId) return;
      try { rooms.meld(roomCode, playerId, p.cardIds, p.targetMeldId); broadcastState(roomCode); }
      catch (e) { sendErrorTo(sock, e); }
    });

    sock.on(EVT.TURN_LAYOFF, (p: LayOffPayload) => {
      const { roomCode, playerId } = sock.data;
      if (!roomCode || !playerId) return;
      try { rooms.layOff(roomCode, playerId, p.cardId, p.meldId); broadcastState(roomCode); }
      catch (e) { sendErrorTo(sock, e); }
    });

    sock.on(EVT.TURN_DISCARD, (p: DiscardPayload) => {
      const { roomCode, playerId } = sock.data;
      if (!roomCode || !playerId) return;
      try { rooms.discard(roomCode, playerId, p.cardId); broadcastState(roomCode); }
      catch (e) { sendErrorTo(sock, e); }
    });

    sock.on(EVT.TURN_CALL_RUMMY, (p: CallRummyPayload) => {
      const { roomCode, playerId } = sock.data;
      if (!roomCode || !playerId) return;
      try { rooms.callRummy(roomCode, playerId, p.meldId); broadcastState(roomCode); }
      catch (e) { sendErrorTo(sock, e); }
    });

    sock.on(EVT.CHAT, (p: ChatPayload) => {
      const { roomCode, playerId } = sock.data;
      if (!roomCode || !playerId) return;
      const state = rooms.getRawState(roomCode);
      const player = state?.players.find((pp) => pp.id === playerId);
      if (!player) return;
      const text = (p?.text ?? '').toString().slice(0, 280);
      if (!text.trim()) return;
      io.to(roomCode).emit(EVT.CHAT, { from: player.name, text, ts: Date.now() });
    });

    sock.on('disconnect', () => {
      const { roomCode, playerId } = sock.data as { roomCode?: string; playerId?: string };
      if (roomCode && playerId) {
        rooms.markDisconnected(roomCode, playerId);
        broadcastState(roomCode);
      }
    });
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
