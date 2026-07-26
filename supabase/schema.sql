-- Al-Aziz Academy feedback bot — starter schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create sequence if not exists public.ticket_number_seq start 1001;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint unique not null,
  full_name text,
  username text,
  user_type text not null default 'unknown'
    check (user_type in ('student', 'employee', 'unknown')),
  role text not null default 'user'
    check (role in ('user', 'admin', 'superadmin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_states (
  telegram_id bigint primary key,
  state text not null,
  ticket_type text
    check (ticket_type in ('suggestion', 'complaint', 'request', 'other')),
  updated_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_code text unique not null default (
    'A' || lpad(nextval('public.ticket_number_seq')::text, 6, '0')
  ),
  telegram_id bigint not null references public.users(telegram_id) on update cascade,
  type text not null
    check (type in ('suggestion', 'complaint', 'request', 'other')),
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'progress', 'resolved')),
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_messages (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  sender_type text not null
    check (sender_type in ('user', 'admin', 'superadmin')),
  text text,
  telegram_file_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.identity_logs (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  superadmin_telegram_id bigint not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tickets_telegram_id_created_at
  on public.tickets (telegram_id, created_at desc);

create index if not exists idx_tickets_status_created_at
  on public.tickets (status, created_at desc);

create index if not exists idx_tickets_type_created_at
  on public.tickets (type, created_at desc);

-- One DB round-trip for: read state -> create ticket -> clear state.
create or replace function public.create_ticket_from_state(
  p_telegram_id bigint,
  p_text text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket_type text;
  v_ticket_code text;
begin
  if p_text is null or length(trim(p_text)) = 0 then
    return null;
  end if;

  select ticket_type
    into v_ticket_type
  from public.user_states
  where telegram_id = p_telegram_id
    and state = 'awaiting_ticket_text'
  for update;

  if v_ticket_type is null then
    return null;
  end if;

  insert into public.tickets (telegram_id, type, text)
  values (p_telegram_id, v_ticket_type, trim(p_text))
  returning ticket_code into v_ticket_code;

  delete from public.user_states
  where telegram_id = p_telegram_id;

  return v_ticket_code;
end;
$$;

-- This starter uses service_role only on the server.
-- Lock Data API access down for public client roles.
alter table public.users enable row level security;
alter table public.user_states enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.identity_logs enable row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.user_states from anon, authenticated;
revoke all on table public.tickets from anon, authenticated;
revoke all on table public.ticket_messages from anon, authenticated;
revoke all on table public.identity_logs from anon, authenticated;

grant all on table public.users to service_role;
grant all on table public.user_states to service_role;
grant all on table public.tickets to service_role;
grant all on table public.ticket_messages to service_role;
grant all on table public.identity_logs to service_role;
grant usage, select on sequence public.ticket_number_seq to service_role;
grant execute on function public.create_ticket_from_state(bigint, text) to service_role;
