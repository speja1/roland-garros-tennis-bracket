create table if not exists public.app_state (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "Public read app state" on public.app_state;
drop policy if exists "Public insert app state" on public.app_state;
drop policy if exists "Public update app state" on public.app_state;

create policy "Public read app state"
  on public.app_state
  for select
  to anon
  using (true);

create policy "Public insert app state"
  on public.app_state
  for insert
  to anon
  with check (id = 'rg-2026');

create policy "Public update app state"
  on public.app_state
  for update
  to anon
  using (id = 'rg-2026')
  with check (id = 'rg-2026');
