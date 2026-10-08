-- ════════════════════════════════════════════════════════════════════════
--  Migration 002: shared cloud uploads + "Our Call" link
--  Run this ONCE in Supabase → SQL Editor if you already ran the first
--  version of schema.sql. It is safe to run more than once.
--  (A brand-new project can just run supabase/schema.sql instead.)
-- ════════════════════════════════════════════════════════════════════════

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
