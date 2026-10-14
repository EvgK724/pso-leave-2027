-- All application records are private to the Edge Function service role.
-- Idempotent setup. No existing project tables are changed.
create table if not exists public.leave2027_state (
 id integer primary key check (id=1), version bigint not null default 0,
 state jsonb not null, updated_at timestamptz not null default now()
);
create table if not exists public.leave2027_access (
 token text primary key default encode(extensions.gen_random_bytes(32),'hex'),
 doctor_id text not null, kind text not null check(kind in ('access','calendar')),
 created_at timestamptz not null default now(), unique(doctor_id,kind)
);
create table if not exists public.leave2027_settings (key text primary key, value jsonb not null);
create table if not exists public.leave2027_push (
 endpoint text primary key, doctor_id text not null, subscription jsonb not null,
 created_at timestamptz not null default now()
);
create table if not exists public.leave2027_outbox (
 id text primary key, doctor_id text not null, payload jsonb not null,
 created_at timestamptz not null default now(), sent_at timestamptz,
 attempts integer not null default 0, last_error text
);
create table if not exists public.leave2027_reminded (doctor_id text primary key, on_date date not null);
alter table public.leave2027_state enable row level security;
alter table public.leave2027_access enable row level security;
alter table public.leave2027_settings enable row level security;
alter table public.leave2027_push enable row level security;
alter table public.leave2027_outbox enable row level security;
alter table public.leave2027_reminded enable row level security;
revoke all on public.leave2027_state,public.leave2027_access,public.leave2027_settings,public.leave2027_push,public.leave2027_outbox,public.leave2027_reminded from anon,authenticated,public;
grant all on public.leave2027_state,public.leave2027_access,public.leave2027_settings,public.leave2027_push,public.leave2027_outbox,public.leave2027_reminded to service_role;
insert into public.leave2027_settings(key,value) values ('cron_key',to_jsonb(encode(extensions.gen_random_bytes(32),'hex'))) on conflict do nothing;
insert into public.leave2027_access(doctor_id,kind)
select id,'access' from unnest(array['klepikov','kardashina','lekerova','khamatnurova','leonard','alekeshova','davydova','omutov']) id on conflict(doctor_id,kind) do nothing;

create or replace function public.leave2027_commit(p_expected bigint,p_state jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare old_state jsonb; ev jsonb; recipient text;
begin
 select state into old_state from public.leave2027_state where id=1 and version=p_expected for update;
 if old_state is null then return false;end if;
 if (p_state->>'version')::bigint <> p_expected+1 then raise exception 'Invalid version';end if;
 update public.leave2027_state set state=p_state,version=p_expected+1,updated_at=now() where id=1;
 for ev in select value from jsonb_array_elements(p_state->'events') loop
  if not exists(select 1 from jsonb_array_elements(old_state->'events') e where e->>'id'=ev->>'id') then
   for recipient in select jsonb_array_elements_text(ev->'to') loop
    insert into public.leave2027_outbox(id,doctor_id,payload) values(ev->>'id'||':'||recipient,recipient,ev) on conflict do nothing;
   end loop;
  end if;
 end loop;
 return true;
end;$$;
revoke all on function public.leave2027_commit(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.leave2027_commit(bigint,jsonb) to service_role;

create or replace function public.leave2027_reminders()
returns integer language plpgsql security invoker set search_path='' as $$
declare today date:=(now() at time zone 'Asia/Yekaterinburg')::date; s jsonb;d jsonb;ev jsonb;last_date date;n integer:=0;v bigint;
begin
 if today<'2026-10-13'::date or today>'2026-10-31'::date then return 0;end if;
 select state,version into s,v from public.leave2027_state where id=1 for update;
 if s is null then return 0;end if;
 for d in select value from jsonb_array_elements(s->'doctors') loop
  if (d->>'submitted')::boolean then continue;end if;
  select on_date into last_date from public.leave2027_reminded where doctor_id=d->>'id';
  if last_date is not null and today<last_date+3 then continue;end if;
  ev:=jsonb_build_object('id',gen_random_uuid()::text,'type','reminder','text','Пожалуйста, когда будет удобно, внесите пожелания по отпуску на 2027 год до 1 ноября. Спасибо! ЕЮ','to',jsonb_build_array(d->>'id'),'at',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  s:=jsonb_set(s,'{events}',(s->'events')||jsonb_build_array(ev));
  insert into public.leave2027_outbox(id,doctor_id,payload) values(ev->>'id'||':'||(d->>'id'),d->>'id',ev) on conflict do nothing;
  insert into public.leave2027_reminded(doctor_id,on_date) values(d->>'id',today) on conflict(doctor_id) do update set on_date=excluded.on_date;
  n:=n+1;
 end loop;
 if n>0 then s:=jsonb_set(s,'{version}',to_jsonb(v+1)); update public.leave2027_state set state=s,version=v+1,updated_at=now() where id=1;end if;
 return n;
end;$$;
revoke all on function public.leave2027_reminders() from public,anon,authenticated;
grant execute on function public.leave2027_reminders() to service_role;

