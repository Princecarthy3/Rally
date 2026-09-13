# Rally — architecture and Phase 1 guide

## 1. Recommended architecture

Rally uses Next.js App Router with TypeScript for UI and routing, and Supabase for hosted authentication, PostgreSQL data, and future Realtime channels. Public pages are server-rendered where useful; authenticated screens use a small session provider backed by the official Supabase browser client.

Layers:

- **UI:** responsive React components and Tailwind CSS.
- **Auth:** Supabase email/password sessions. Only the public anon key is used in the browser.
- **Data:** PostgreSQL behind Supabase Row Level Security (RLS).
- **Realtime (Phase 2+):** database change subscriptions for durable room state, Presence for online state, and Broadcast for latency-sensitive transient input.
- **Authoritative operations (Phase 2+):** PostgreSQL functions or server-only Next.js route handlers validate joins, moves, turns, and game completion.

Phase 1 intentionally contains no room creation or playable game logic. Game cards clearly show that multiplayer is coming next rather than pretending static interactions are live.

## 2. Database schema

### Implemented in Phase 1

`profiles`
- `id uuid` primary key and foreign key to `auth.users(id)`
- `display_name text`
- `avatar_url text`, optional
- `games_played`, `wins`, `losses`, `draws` non-negative integers
- `created_at`, `updated_at` timestamps

A signup trigger creates a profile from auth metadata. RLS permits users to read public profile fields and update only their own profile. Dashboard statistics cannot be updated by browser clients.

### Planned for Phase 2+

- `game_rooms`: code, game type, status, owner, rules, authoritative state, timestamps
- `game_players`: room/user membership, seat, ready/connection state, score
- `games`: immutable match session, room, rules, status, winner, started/finished timestamps
- `game_results`: one result per game/player with outcome and score
- `game_actions`: append-only, unique sequenced validated moves (or game-specific private tables)
- `friends`: requester/addressee/status, intentionally deferred but accounted for

Recommended indexes include unique uppercase room code, active rooms by status, room players by room, games by player/time through results, and unique `(game_id, player_id)` results.

## 3. Project folder structure

```
src/
  app/
    auth/             login and signup
    dashboard/        protected player home
    profile/          protected profile editor
    history/          Phase 1 empty history shell
    auth/callback/    email confirmation callback
    api/health/       deployment health check
  components/         brand, navigation, auth/session UI
  lib/supabase/       safe browser client
  db/                 platform Drizzle connection
supabase/
  phase1.sql           paste into Supabase SQL Editor
  future-schema.sql    reference design for later phases
docs/
  ARCHITECTURE.md
```

Future game modules will live under `src/features/games/<game-key>` behind a shared game adapter (`metadata`, lobby, reducer/state validation, renderer), so new games do not alter the room platform.

## 4. Multiplayer communication (Phase 2+)

1. Creator calls a validated `create_room(game_type, rules)` RPC; PostgreSQL creates the room and creator membership and returns a short code.
2. Opponent joins through `join_room(code)` RPC, which locks the room row, checks capacity/status, and inserts exactly one membership.
3. Both subscribe to the room’s Postgres Changes and Presence channel. Durable state (ready, scores, turns, completion) is written to tables through validated operations.
4. Realtime Presence communicates online/disconnected/reconnected UI without treating presence as authoritative.
5. RPS, guessing, and basketball actions use RPCs/route handlers and durable state. Pong uses client prediction and throttled Supabase Broadcast messages for paddle/input updates, with periodic authoritative snapshots; it does not write every animation frame to PostgreSQL.
6. Completion happens transactionally: validate final state, mark game complete, insert results, and increment profile stats once using an idempotency guard.

## 5. Preventing cheating

- Enable RLS on every public table; default-deny policies.
- Membership and state transitions happen in carefully scoped RPCs, not arbitrary table updates.
- Never accept final scores from a client. Derive them from validated actions.
- Lock the room/game row during turn submission to prevent duplicate or simultaneous invalid moves.
- Add unique action sequence/idempotency keys to reject duplicate submissions.
- Hide RPS choices and number-guess secrets in private tables or security-definer functions inaccessible through normal selects.
- Validate actor, room membership, current turn, allowed move, game status, and action deadline for each action.
- Restrict service-role credentials to server-only environment variables if later needed. The current app does not require a service-role key.
- Treat Realtime Broadcast data as hints/input, never as final results.

## Phase 1 setup

1. Create a Supabase project.
2. Open **SQL Editor**, paste and run `supabase/phase1.sql`.
3. In **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` and add your Vercel production URL to Redirect URLs.
4. Add these values to `.env.local` (never commit the file):
   - `NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY`
5. Run `npm install` and `npm run dev`.
6. Sign up, follow the confirmation email if email confirmation is enabled, then sign in. Profile and dashboard are now live.

Only the anon/publishable key is exposed to the browser; this is expected and safe with RLS. Never add `SUPABASE_SERVICE_ROLE_KEY` to a `NEXT_PUBLIC_` variable.

## Vercel deployment

1. Push the repository to GitHub/GitLab/Bitbucket and import it in Vercel.
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the existing server-only `DATABASE_URL` in Vercel Project Settings → Environment Variables.
3. Deploy. Add the resulting `https://...vercel.app` URL to Supabase Authentication Redirect URLs.
4. Redeploy if environment variables were added after the first build.

## Phase verification checklist

- Landing page works at mobile, tablet, and desktop widths.
- Missing Supabase settings produce a clear setup notice, not a crash.
- Signup creates `auth.users` and a `profiles` row.
- Login restores a session after refresh; logout clears it.
- Unauthenticated dashboard/profile/history visits redirect to auth.
- A player can edit only their own display name/avatar.
- Dashboard renders profile statistics and a useful empty recent-games state.
- Phase 2 controls are labeled as coming next and do not create fake rooms.
