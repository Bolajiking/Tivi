-- Channel XMTP Group Mapping
-- Run this in Supabase SQL editor.

create table if not exists public.channel_chat_groups (
  playback_id text primary key,
  creator_id text not null,
  xmtp_group_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists channel_chat_groups_creator_id_idx
  on public.channel_chat_groups (creator_id);

create or replace function public.set_channel_chat_groups_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

DROP TRIGGER IF EXISTS trg_channel_chat_groups_updated_at ON public.channel_chat_groups;
create trigger trg_channel_chat_groups_updated_at
before update on public.channel_chat_groups
for each row
execute function public.set_channel_chat_groups_updated_at();

alter table public.channel_chat_groups enable row level security;

-- Allow public reads (viewers need mapping to fetch group by channel playback id).
drop policy if exists "channel_chat_groups_read_all" on public.channel_chat_groups;
create policy "channel_chat_groups_read_all"
  on public.channel_chat_groups
  for select
  using (true);

-- Allow insert/update/delete for authenticated users.
-- Tightening can be done later with wallet-based JWT claims.
drop policy if exists "channel_chat_groups_write_authenticated" on public.channel_chat_groups;
create policy "channel_chat_groups_write_authenticated"
  on public.channel_chat_groups
  for all
  to authenticated
  using (true)
  with check (true);
