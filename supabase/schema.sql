-- ════════════════════════════════════════════════════════════════════════
--  Our Little Cinema: Supabase schema
--  Paste this whole file into Supabase → SQL Editor → New query → Run.
--  It is safe to run more than once.
--
--  Privacy model
--  • Nobody can list or browse rooms. The tables have RLS enabled and NO
--    policies, so the public "anon" key cannot read or write them directly.
--  • All access goes through the functions below. Each one needs the exact
--    room code, so only people who have the link can use a room.
--  • Realtime "broadcast" + "presence" (used for instant play/pause/chat)
--    do not touch these tables at all.
--  • Uploaded videos live in the PRIVATE "room-videos" storage bucket.
--    Browsers get short-lived signed URLs from the app's server only.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.rooms (
  code         text primary key check (char_length(code) between 6 and 64),
  video_url    text,
  video_title  text,
  source_type  text not null default 'url',
  is_playing   boolean not null default false,
  position     double precision not null default 0,   -- seconds
  rate         double precision not null default 1,   -- playback rate
  updated_at   bigint not null default 0,             -- server-clock ms when position was true
  updated_by   text,
  names        jsonb not null default '{"one":"Ayvon","two":"Aksa"}'::jsonb,
  storage_path text,                                  -- uploaded video in the room-videos bucket
  meeting_url  text,                                  -- Google Meet / Teams / Zoom link
  created_at   timestamptz not null default now()
);

create table if not exists public.messages (
  id          uuid primary key,
  room_code   text not null references public.rooms(code) on delete cascade,
  sender      text not null check (char_length(sender) between 1 and 40),
  body        text not null check (char_length(body) between 1 and 1000),
  kind        text not null default 'text' check (kind in ('text', 'reaction')),
  created_at  timestamptz not null default now()
);

create index if not exists messages_room_created_idx
  on public.messages (room_code, created_at desc);

alter table public.rooms    enable row level security;
alter table public.messages enable row level security;
revoke all on public.rooms, public.messages from anon, authenticated;

-- ── Clock: lets every browser line up with one shared clock ─────────────
create or replace function public.server_now()
returns bigint
language sql volatile
as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

-- ── Rooms ───────────────────────────────────────────────────────────────
create or replace function public.create_room(p_code text, p_names jsonb)
returns setof public.rooms
language sql volatile security definer
set search_path = public
as $$
  insert into public.rooms (code, names, updated_at)
  values (p_code, coalesce(p_names, '{"one":"Ayvon","two":"Aksa"}'::jsonb), public.server_now())
  returning *;
$$;

create or replace function public.get_room(p_code text)
returns setof public.rooms
language sql stable security definer
set search_path = public
as $$ select * from public.rooms where code = p_code limit 1; $$;

create or replace function public.update_room_names(p_code text, p_names jsonb)
returns void
language sql volatile security definer
set search_path = public
as $$ update public.rooms set names = p_names where code = p_code; $$;

-- ── Chat ────────────────────────────────────────────────────────────────
create or replace function public.post_message(
  p_id uuid, p_code text, p_sender text, p_body text, p_kind text
)
returns void
language sql volatile security definer
set search_path = public
as $$
  insert into public.messages (id, room_code, sender, body, kind)
  select p_id, p_code, p_sender, p_body, coalesce(p_kind, 'text')
  where exists (select 1 from public.rooms where code = p_code)
  on conflict (id) do nothing;
$$;

create or replace function public.get_messages(p_code text, p_limit int default 100)
returns setof public.messages
language sql stable security definer
set search_path = public
as $$
  select * from public.messages
   where room_code = p_code
   order by created_at desc
   limit least(greatest(p_limit, 1), 300);
$$;

grant execute on function
  public.server_now(),
  public.create_room(text, jsonb),
  public.get_room(text),
  public.update_room_names(text, jsonb),
  public.post_message(uuid, text, text, text, text),
  public.get_messages(text, int)
to anon, authenticated;

-- ── Uploads + call link (same as migrations/002) ─────────────────────────
-- 1. New room fields
alter table public.rooms add column if not exists storage_path text;  -- e.g. "k7m2-qx9p-4hdt/1728400000000-ab12cd.mp4"
alter table public.rooms add column if not exists meeting_url  text;  -- Google Meet / Teams / Zoom link

alter table public.rooms drop constraint if exists rooms_source_type_check;
alter table public.rooms add constraint rooms_source_type_check
  check (source_type in ('url', 'hls', 'upload', 'library', 'local'));

-- 2. Private storage bucket for room videos.
--    No storage policies are created on purpose: the browser can never list
--    or read this bucket directly. The app's server creates short-lived
--    signed upload / playback URLs only for a valid room code.
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('room-videos', 'room-videos', false, array['video/*'])
on conflict (id) do update set public = false, allowed_mime_types = array['video/*'];

-- 3. Room functions that know about the new fields
create or replace function public.get_room(p_code text)
returns setof public.rooms
language sql stable security definer
set search_path = public
as $$ select * from public.rooms where code = p_code limit 1; $$;

drop function if exists public.update_room_state(
  text, text, text, text, boolean, double precision, double precision, bigint, text
);

create or replace function public.update_room_state(
  p_code         text,
  p_video_url    text,
  p_video_title  text,
  p_source_type  text,
  p_is_playing   boolean,
  p_position     double precision,
  p_rate         double precision,
  p_updated_at   bigint,
  p_updated_by   text,
  p_storage_path text default null
)
returns void
language sql volatile security definer
set search_path = public
as $$
  update public.rooms
     set video_url    = p_video_url,
         video_title  = p_video_title,
         source_type  = p_source_type,
         storage_path = case when p_storage_path like p_code || '/%' then p_storage_path else null end,
         is_playing   = p_is_playing,
         position     = greatest(p_position, 0),
         rate         = least(greatest(p_rate, 0.25), 4),
         updated_at   = p_updated_at,
         updated_by   = p_updated_by
   where code = p_code
     and updated_at <= p_updated_at;
$$;

create or replace function public.update_room_meeting(p_code text, p_url text)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
begin
  if p_url is not null and p_url !~* '^https://([a-z0-9-]+\.)*(meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|zoom\.us|zoom\.com)(/|\?|$)' then
    raise exception 'Only Google Meet, Microsoft Teams or Zoom links are allowed';
  end if;
  update public.rooms set meeting_url = left(p_url, 500) where code = p_code;
end;
$$;

grant execute on function
  public.get_room(text),
  public.update_room_state(text, text, text, text, boolean, double precision, double precision, bigint, text, text),
  public.update_room_meeting(text, text)
to anon, authenticated;

-- ── Optional housekeeping ───────────────────────────────────────────────
-- Enable the pg_cron extension (Database → Extensions) and uncomment this
-- to delete rooms (and their chat) that have not been used for 60 days.
--
-- select cron.schedule('cleanup-old-rooms', '0 3 * * *', $$
--   delete from public.rooms
--    where to_timestamp(updated_at / 1000.0) < now() - interval '60 days';
-- $$);
