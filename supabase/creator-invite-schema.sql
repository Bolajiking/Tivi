-- Creator invite system schema
-- Run this in Supabase SQL editor before using invite-gated creator onboarding.

create extension if not exists pgcrypto;

create table if not exists public.creator_invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  is_active boolean not null default true,
  max_uses integer null check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint creator_invite_codes_uppercase check (code = upper(code))
);

create index if not exists idx_creator_invite_codes_active
  on public.creator_invite_codes (is_active, expires_at);

create table if not exists public.creator_access_grants (
  creator_id text primary key,
  invite_code text not null references public.creator_invite_codes(code) on update cascade,
  granted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_creator_access_grants_invite_code
  on public.creator_access_grants (invite_code);

-- Seed example code. Replace with your own values.
insert into public.creator_invite_codes (code, is_active, max_uses, used_count)
values ('CREATOR-BETA-001', true, 25, 0)
on conflict (code) do nothing;

-- Keep tables private. App access should go through SECURITY DEFINER RPC functions below.
alter table public.creator_invite_codes enable row level security;
alter table public.creator_access_grants enable row level security;

revoke all on public.creator_invite_codes from anon, authenticated;
revoke all on public.creator_access_grants from anon, authenticated;

create or replace function public.has_creator_access(p_creator_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_creator_id is null or btrim(p_creator_id) = '' then
    return false;
  end if;

  if exists (
    select 1
    from public.streams s
    where s."creatorId" = p_creator_id
    limit 1
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.creator_access_grants g
    where g.creator_id = p_creator_id
    limit 1
  );
end;
$$;

create or replace function public.redeem_creator_invite(p_creator_id text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalized_code text;
  v_invite public.creator_invite_codes%rowtype;
  v_existing_grant public.creator_access_grants%rowtype;
  v_new_grant public.creator_access_grants%rowtype;
begin
  if p_creator_id is null or btrim(p_creator_id) = '' then
    raise exception 'Wallet address is required.' using errcode = 'P0001';
  end if;

  v_normalized_code := upper(btrim(coalesce(p_code, '')));
  if v_normalized_code = '' then
    raise exception 'Invite code is required.' using errcode = 'P0001';
  end if;

  select *
  into v_existing_grant
  from public.creator_access_grants
  where creator_id = p_creator_id;

  if found then
    return jsonb_build_object(
      'alreadyGranted', true,
      'inviteCode', v_existing_grant.invite_code,
      'grantedAt', v_existing_grant.granted_at
    );
  end if;

  select *
  into v_invite
  from public.creator_invite_codes
  where code = v_normalized_code
  for update;

  if not found then
    raise exception 'Invalid invite code.' using errcode = 'P0001';
  end if;

  if coalesce(v_invite.is_active, true) = false then
    raise exception 'This invite code is inactive.' using errcode = 'P0001';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    raise exception 'This invite code has expired.' using errcode = 'P0001';
  end if;

  if v_invite.max_uses is not null and v_invite.used_count >= v_invite.max_uses then
    raise exception 'This invite code has reached its usage limit.' using errcode = 'P0001';
  end if;

  insert into public.creator_access_grants (creator_id, invite_code, granted_at)
  values (p_creator_id, v_normalized_code, now())
  returning *
  into v_new_grant;

  update public.creator_invite_codes
  set used_count = used_count + 1
  where code = v_normalized_code;

  return jsonb_build_object(
    'alreadyGranted', false,
    'inviteCode', v_new_grant.invite_code,
    'grantedAt', v_new_grant.granted_at
  );
end;
$$;

grant execute on function public.has_creator_access(text) to anon, authenticated;
grant execute on function public.redeem_creator_invite(text, text) to anon, authenticated;
