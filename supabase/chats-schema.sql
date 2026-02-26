-- Channel and livestream chat persistence table
create extension if not exists pgcrypto;

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  stream_id text not null,
  sender text not null,
  wallet_address text not null,
  message text not null,
  "timestamp" timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists chats_stream_timestamp_idx
  on public.chats (stream_id, "timestamp");

alter table public.chats enable row level security;

drop policy if exists "chats_read_all" on public.chats;
create policy "chats_read_all"
  on public.chats
  for select
  using (true);

drop policy if exists "chats_insert_authenticated" on public.chats;
drop policy if exists "chats_insert_public" on public.chats;
create policy "chats_insert_public"
  on public.chats
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "chats_delete_authenticated" on public.chats;
drop policy if exists "chats_delete_public" on public.chats;
create policy "chats_delete_public"
  on public.chats
  for delete
  to anon, authenticated
  using (true);
