# 500 Rummy Online

Web multiplayer 500 Rummy for a small group. Create a room, share the 4-letter code, play.

## Stack
- **Server:** Node + TypeScript + Fastify + Socket.IO (in-memory state).
- **Client:** React + Vite + Tailwind + Zustand + socket.io-client.
- **Shared:** Pure rule/scoring functions and Socket event types — imported by both.
- **Hosting:** Railway (server) + Vercel (client).

## Repo layout
```
500-rummy/
├── shared/   # types, deck, rules, scoring, events, redaction
├── server/   # Fastify + Socket.IO + RoomManager
└── client/   # React app
```

## Local dev
Requires **Node 20+** and **pnpm 9+**.

```bash
pnpm install
pnpm dev          # starts server on :3001 and client on :5173 in parallel
```

Then open <http://localhost:5173> in two browser tabs / windows — create a room in one, copy the code, join from the other. Hit **Start** when at least 2 players are seated.

Run tests:
```bash
pnpm test                            # all packages
pnpm --filter @rummy/shared test     # rule & scoring tests (40)
pnpm --filter @rummy/server test     # room-manager game-loop tests (13)
```

## Game rules implemented
Single 52-card deck, 2–6 players. 13 cards each for 2 players, 7 cards each for 3+.

**Turn:** draw (stock OR discard pile of any depth, must immediately meld with the deepest taken card) → optional melds / lay-offs → discard one.

- **Sets:** 3 or 4 cards of the same rank (single deck → suits must differ).
- **Runs:** 3+ consecutive cards of the same suit. **Ace is low only** (A-2-3 valid; Q-K-A not).
- **Lay-off:** to your own or others' melds; the placer gets the points.
- **Going out:** must discard on the turn you go out (Boathouse rule on).
- **Stock empty:** round ends, no hand penalties.
- **Scoring:** 2–9 = 5, 10/J/Q/K = 10, A = 15. First to **500** wins. Tiebreaker: whoever went out.
- **Call Rummy:** 3-second window after each discard; if the discarded card could lay off on any meld, an opponent can claim it and place it (caller gets the points).

All rules live in [shared/src/rules.ts](shared/src/rules.ts) and [shared/src/scoring.ts](shared/src/scoring.ts). The server is authoritative — clients only suggest moves; the server re-validates every action.

## Socket events
Defined in [shared/src/events.ts](shared/src/events.ts). Every successful mutation emits a redacted `state:update` to each player in the room (own hand visible, others' as counts; stock as count only).

## Reconnect
Session (`roomCode` + `playerId`) is persisted to `localStorage`. If you refresh, the client emits `room:rejoin` and the server restores you to your seat. Seats are held for **2 minutes** after disconnect; if everyone disconnects, the room is closed.

## Deploy

### Server → Railway (or Render / Fly.io)
1. Push this repo to GitHub.
2. New Railway project → "Deploy from GitHub repo" → pick this repo.
3. Set the **service root** to `/` (root of the monorepo). Railway will use [server/Dockerfile](server/Dockerfile) automatically if you point the service at the `server/` directory, or set the Dockerfile path manually.
4. Set env vars:
   - `PORT` — Railway provides this automatically.
   - `HOST` — `0.0.0.0`
   - `ALLOWED_ORIGINS` — your Vercel URL, e.g. `https://my-rummy.vercel.app`
   - `LOG_LEVEL` — `info`
5. Deploy. Confirm with `https://<your-app>.up.railway.app/health` → `{"ok":true,...}`.

### Client → Vercel
1. New Vercel project → import this repo.
2. **Root directory:** `client`
3. **Build command:** `pnpm install --frozen-lockfile=false && pnpm --filter @rummy/client build`
4. **Output dir:** `dist`
5. Env var: `VITE_SERVER_URL` = your Railway URL (e.g. `https://my-rummy.up.railway.app`).
6. Deploy. SPA rewrites are configured in [client/vercel.json](client/vercel.json) so `/r/ABCD` resolves to the app.

After both are live, share `https://my-rummy.vercel.app` with friends.

## Known limits / not yet built
- No jokers, no high-ace runs, no opener point requirement.
- No chat UI (event wired, no input box yet).
- No spectator mode, no replay/history.
- In-memory rooms only — a server restart drops all games.

These are intentionally out of scope for the friends-only MVP; see the build plan in `BUILD_PLAN.md` for the optional Phase 7 list.
