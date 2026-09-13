-- REFERENCE BLUEPRINT — DO NOT RUN DURING PHASE 1.
-- Phase 2 will ship validated create/join/action RPCs and their exact RLS policies.

create type public.game_type as enum ('basketball', 'ping_pong', 'rps', 'number_guess');
create type public.room_status as enum ('waiting', 'ready', 'playing', 'completed', 'cancelled');
create type public.game_outcome as enum ('win', 'loss', 'draw');
create type public.friend_status as enum ('pending', 'accepted', 'blocked');

create table public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and char_length(code) between 5 and 8),
  game_type public.game_type not null,
  owner_id uuid not null references public.profiles(id),
  status public.room_status not null default 'waiting',
  rules jsonb not null default '{}'::jsonb,
  public_state jsonb not null default '{}'::jsonb,
  state_version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create table public.game_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  player_id uuid not null references public.profiles(id),
  seat smallint not null check (seat in (1, 2)),
  is_ready boolean not null default false,
  connection_status text not null default 'online' check (connection_status in ('online','away','offline')),
  score integer not null default 0 check (score >= 0),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id, player_id),
  unique (room_id, seat)
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id),
  game_type public.game_type not null,
  status public.room_status not null default 'ready',
  rules jsonb not null default '{}'::jsonb,
  final_state jsonb,
  winner_id uuid references public.profiles(id),
  result_committed_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.game_results (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.profiles(id),
  opponent_id uuid not null references public.profiles(id),
  outcome public.game_outcome not null,
  score integer not null default 0,
  opponent_score integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (game_id, player_id),
  check (player_id <> opponent_id)
);

create table public.game_actions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  sequence integer not null check (sequence >= 0),
  action_type text not null,
  public_payload jsonb not null default '{}'::jsonb,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (game_id, sequence),
  unique (actor_id, idempotency_key)
);

-- Secret selections belong in a private schema not exposed by the Data API.
create schema if not exists private;
create table private.game_secrets (
  game_id uuid not null references public.games(id) on delete cascade,
  owner_id uuid not null references public.profiles(id),
  round integer not null,
  encrypted_or_hashed_value text not null,
  created_at timestamptz not null default now(),
  primary key (game_id, owner_id, round)
);

create table public.friends (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status public.friend_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index game_rooms_status_created_idx on public.game_rooms (status, created_at desc);
create index game_players_player_idx on public.game_players (player_id, joined_at desc);
create index games_room_created_idx on public.games (room_id, created_at desc);
create index game_results_player_created_idx on public.game_results (player_id, created_at desc);
create index game_actions_game_sequence_idx on public.game_actions (game_id, sequence);
create index friends_addressee_status_idx on public.friends (addressee_id, status);

alter table public.game_rooms enable row level security;
alter table public.game_players enable row level security;
alter table public.games enable row level security;
alter table public.game_results enable row level security;
alter table public.game_actions enable row level security;
alter table public.friends enable row level security;

-- Default deny is intentional: no grants/policies here. Phase 2 security-definer
-- functions will expose narrowly validated create_room, join_room, set_ready,
-- submit_action, leave_room, and rematch operations. Participants will receive
-- SELECT policies only for rooms/games in which they have membership.
