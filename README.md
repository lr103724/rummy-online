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

### Server → Render
This repo includes a [`render.yaml`](render.yaml) blueprint, so the server is one-click via Render's dashboard.

1. Push this repo to GitHub (already done if you're reading this on GitHub).
2. Sign in at <https://dashboard.render.com> → **New +** → **Blueprint** → connect this repo.
3. Render reads `render.yaml` and creates the `rummy-online-server` web service on the **Free** plan, using [`server/Dockerfile`](server/Dockerfile).
4. After the first deploy succeeds, open the service in the dashboard → **Environment** → add:
   - `ALLOWED_ORIGINS` = your Vercel URL (set this after the client is deployed; comma-separate if you have multiple).
5. Trigger a manual redeploy so the new env var is picked up.
6. Confirm `https://<your-service>.onrender.com/health` returns `{"ok":true,...}`.

**Note on the Free plan:** Render spins the service down after 15 minutes of no HTTP traffic. The first player to connect at the start of a session will wait ~30 seconds for the cold start; everyone else joining within 15 minutes of the last activity is fast. Upgrade to the **Starter** plan ($7/mo) if you want always-on.

### Client → Vercel
1. Sign in at <https://vercel.com/new> → import this GitHub repo.
2. **Root directory:** `client`
3. **Framework preset:** Vite (Vercel usually auto-detects)
4. **Build command:** `cd .. && pnpm install --frozen-lockfile=false && pnpm --filter @rummy/client build`
5. **Output directory:** `dist`
6. **Environment variable:** `VITE_SERVER_URL` = your Render URL (e.g. `https://rummy-online-server.onrender.com`).
7. Deploy. SPA rewrites are configured in [client/vercel.json](client/vercel.json) so `/r/ABCD` resolves correctly.

After both are live, set `ALLOWED_ORIGINS` on Render to the Vercel URL and redeploy. Share `https://<your-app>.vercel.app` with friends.

## Known limits / not yet built
- No jokers, no high-ace runs, no opener point requirement.
- No chat UI (event wired, no input box yet).
- No spectator mode, no replay/history.
- In-memory rooms only — a server restart drops all games.

These are intentionally out of scope for the friends-only MVP; see the build plan in `BUILD_PLAN.md` for the optional Phase 7 list.
