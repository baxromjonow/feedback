-- Al-Aziz Feedback Bot v0.2 migration
-- Run ONCE after the original v0.1 schema.sql.

alter table public.user_states
  add column if not exists ticket_code text;

create table if not exists public.admin_states (
  telegram_id bigint primary key,
  state text not null,
  ticket_code text,
  updated_at timestamptz not null default now()
);

alter table public.admin_states enable row level security;
revoke all on table public.admin_states from anon, authenticated;
grant all on table public.admin_states to service_role;

alter table public.tickets
  add column if not exists source text
    check (source in ('student', 'employee', 'unknown'));

update public.tickets t
set source = coalesce(u.user_type, 'unknown')
from public.users u
where t.telegram_id = u.telegram_id
  and t.source is null;

alter table public.tickets
  alter column source set default 'unknown';

create or replace view public.admin_ticket_view as
select
  t.id,
  t.ticket_code,
  t.type,
  t.status,
  t.source,
  t.text,
  t.created_at,
  t.updated_at
from public.tickets t;

revoke all on public.admin_ticket_view from anon, authenticated;
grant select on public.admin_ticket_view to service_role;

create index if not exists idx_tickets_source_created_at
  on public.tickets (source, created_at desc);

-- v2 function returns code + type in one DB round-trip.
create or replace function public.create_ticket_from_state_v2(
  p_telegram_id bigint,
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket_type text;
  v_ticket_code text;
  v_source text;
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

  select coalesce(user_type, 'unknown')
    into v_source
  from public.users
  where telegram_id = p_telegram_id;

  insert into public.tickets (telegram_id, type, source, text)
  values (
    p_telegram_id,
    v_ticket_type,
    coalesce(v_source, 'unknown'),
    trim(p_text)
  )
  returning ticket_code into v_ticket_code;

  delete from public.user_states
  where telegram_id = p_telegram_id;

  return jsonb_build_object(
    'ticket_code', v_ticket_code,
    'type', v_ticket_type
  );
end;
$$;

grant execute on function public.create_ticket_from_state_v2(bigint, text) to service_role;
