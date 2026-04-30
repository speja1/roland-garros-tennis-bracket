create extension if not exists pgcrypto;

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  starts_at timestamptz,
  lock_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table draws (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  event_code text not null check (event_code in ('MS', 'WS')),
  name text not null,
  draw_size int not null default 128,
  source text not null default 'manual',
  source_url text,
  status text not null default 'draft',
  updated_at timestamptz not null default now(),
  unique (tournament_id, event_code)
);

create table players (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  country_code text,
  external_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (canonical_name, country_code)
);

create table draw_slots (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references draws(id) on delete cascade,
  slot_index int not null,
  player_id uuid references players(id),
  seed int,
  entry_status text,
  label text,
  unique (draw_id, slot_index)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references draws(id) on delete cascade,
  round int not null,
  match_number int not null,
  player_a_id uuid references players(id),
  player_b_id uuid references players(id),
  winner_player_id uuid references players(id),
  status text not null default 'scheduled',
  score_text text,
  scheduled_at timestamptz,
  source_match_id text,
  updated_at timestamptz not null default now(),
  unique (draw_id, round, match_number)
);

create table leagues (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  invite_slug text not null unique,
  created_by_email text,
  created_at timestamptz not null default now()
);

create table entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  league_id uuid references leagues(id) on delete set null,
  display_name text not null,
  email text,
  locked_at timestamptz,
  created_at timestamptz not null default now()
);

create table picks (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  picked_player_id uuid not null references players(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_id, match_id)
);

create table entry_scores (
  entry_id uuid primary key references entries(id) on delete cascade,
  total_points int not null default 0,
  correct_picks int not null default 0,
  possible_points_remaining int not null default 0,
  updated_at timestamptz not null default now()
);

create table source_snapshots (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid references draws(id) on delete cascade,
  source text not null,
  source_url text,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);
