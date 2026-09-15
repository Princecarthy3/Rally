# Rally — social games for 2–4 players

Rally is a responsive online party arcade built with Next.js, TypeScript, Supabase Auth/Postgres/Realtime, and Tailwind CSS. Players create a private room, share a five-character code or link, ready up, and play from different devices.

## Games

- Pocket Basketball (2–4)
- Neon Ping Pong (2)
- Rock Paper Scissors (2–4)
- Connect Four (2)
- Number Hunt (2–4)
- Tic-Tac-Toe (2)
- Dice Dash (2–4)
- Quick Draw Trivia (2–4)
- Emoji Decode (2–4)

The game catalog lives in `src/features/games/registry.ts`. All games share one room contract, so another game can be added without changing authentication, invitations, presence, history, or results.

## Stack

- Next.js App Router + React + TypeScript
- Tailwind CSS 4
- Supabase Authentication, PostgreSQL, RLS, RPCs, Realtime Presence/Broadcast/Postgres Changes
- Drizzle/PostgreSQL for the platform health check
- Vercel-ready production build

## Quick start

1. Create a Supabase project.
2. In Supabase **SQL Editor**, run `supabase/complete.sql`. For an existing Rally Phase 1 project, the script is idempotent and can be run after `phase1.sql`.
3. In **Database → Replication**, ensure `game_rooms` and `game_players` are in the `supabase_realtime` publication (the SQL attempts this safely).
4. In **Authentication → URL Configuration**, set the local Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` as a redirect URL.
5. Create `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
DATABASE_URL=YOUR_POSTGRES_CONNECTION_STRING
```

6. Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, create two accounts in separate browsers, create a room, share the link, and ready both players.

## Security model

The browser receives only the Supabase publishable/anon key. That key is designed to be public and is constrained by RLS. Never expose a service-role key.

- Room creation, joining, readying, starting, gameplay actions, leaving, and rematches use PostgreSQL RPC functions.
- RPCs verify `auth.uid()`, membership, room status, capacity, seat, turn, and action shape.
- Mutations lock the room row to prevent simultaneous invalid turns.
- Basketball outcomes and dice rolls are generated in PostgreSQL, not accepted from clients.
- RPS picks are stored in the private schema and revealed only after all active players choose.
- Browser clients cannot directly change scores or finished results.
- Completion and profile statistics are written once in the same trusted database path.
- Realtime presence is informational; it never decides a winner.

This is a casual-game anti-cheat model, not a cash-prize tournament system. For high-stakes play, add rate limiting and a server-side event audit service.

## Realtime design

Durable room/player state uses Postgres Changes. Presence reports who is currently connected and enables reconnect banners. Ping Pong uses Broadcast for frequent paddle/ball frames to avoid database writes per animation frame; point results remain durable. Clients refetch the room after reconnect so missed broadcasts do not leave stale durable state.

## Project map

```text
src/app/                 pages and API health route
src/app/room/[code]/     live lobby and game room
src/components/          shared identity, navigation, modals
src/features/games/      catalog and game boards
src/features/rooms/      room types, realtime hook, room UI
src/lib/supabase/        safe browser client
supabase/complete.sql    production schema, RLS, and RPCs
docs/ARCHITECTURE.md     deeper architecture notes
```

## Add a game

1. Add its metadata and player limits to `registry.ts`.
2. Add a board component to the game renderer.
3. Add its initial state and allowed action branch in `start_game` / `play_room_action` in `complete.sql`.
4. Keep score generation and win validation inside the RPC, then test simultaneous actions from multiple clients.

## Deploy to Vercel

1. Push to a Git provider and import the repository into Vercel.
2. Add the three environment variables above in Project Settings. Keep any future service-role key server-only and never prefix it with `NEXT_PUBLIC_`.
3. Deploy, then add the production URL and `/auth/callback` URL to Supabase Authentication Redirect URLs.
4. Test signup, room invitation, Realtime updates, reconnect, rematch, and mobile controls from separate devices.

## Useful commands

```bash
npx next typegen
npm exec tsc -- --noEmit
npm run build
```

## Current gameplay note

Rally’s turn-based games are database-authoritative. Ping Pong is host-simulated with Realtime Broadcast for smooth casual play and durable server-scored points. Network quality can affect motion, so reconnecting players receive a pause notice and state resynchronization.
