-- Apply once in the Supabase SQL editor. Auth, backups and shared data are separate.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  handle text unique not null check (handle ~ '^[a-z0-9_]{3,32}$'),
  club text not null default '' check (char_length(club) <= 120),
  created_at timestamptz not null default now()
);
create function public.create_player_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name, handle)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), 'Hráč'),
    coalesce(nullif(lower(trim(new.raw_user_meta_data->>'handle')), ''), 'hrac_' || substr(replace(new.id::text, '-', ''), 1, 24)));
  return new;
end; $$;
create trigger on_player_signup after insert on auth.users
for each row execute function public.create_player_profile();

create table public.user_data (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);
create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> recipient_id)
);
create unique index one_friendship_per_pair on public.friend_requests
(least(requester_id, recipient_id), greatest(requester_id, recipient_id));
create index friends_recipient on public.friend_requests(recipient_id);

create table public.shared_activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  local_id text not null check (char_length(local_id) between 1 and 120),
  visibility text not null check (visibility in ('private', 'friends', 'community')),
  activity_date date not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  unique (owner_id, local_id)
);
create index shared_activities_date on public.shared_activities(activity_date desc, created_at desc);
create table public.activity_invitations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.shared_activities(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (activity_id, recipient_id)
);
create index invitations_recipient on public.activity_invitations(recipient_id);
create table public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  source_activity_id uuid references public.shared_activities(id) on delete set null,
  data jsonb not null,
  activity_date date not null,
  created_at timestamptz not null default now(),
  unique (owner_id, source_activity_id)
);

create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.friend_requests where status = 'accepted'
    and ((requester_id = a and recipient_id = b) or (requester_id = b and recipient_id = a)))
$$;
create function public.can_view_activity(activity uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.shared_activities a where a.id = activity and (
    a.owner_id = auth.uid() or a.visibility = 'community' or (
      a.visibility = 'friends' and public.are_friends(a.owner_id, auth.uid())
    )
  ))
$$;

alter table public.profiles enable row level security;
alter table public.user_data enable row level security;
alter table public.friend_requests enable row level security;
alter table public.shared_activities enable row level security;
alter table public.activity_invitations enable row level security;
alter table public.calendar_entries enable row level security;
create policy profile_directory on public.profiles for select to authenticated, anon using (true);
create policy own_profile_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy own_backup on public.user_data for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy own_friend_requests on public.friend_requests for select to authenticated
  using (auth.uid() in (requester_id, recipient_id));
create policy visible_activity on public.shared_activities for select to authenticated, anon
  using (public.can_view_activity(id));
create policy own_invitation on public.activity_invitations for select to authenticated
  using (recipient_id = auth.uid() or exists (
    select 1 from public.shared_activities a where a.id = activity_id and a.owner_id = auth.uid()
  ));
create policy own_calendar on public.calendar_entries for select to authenticated
  using (owner_id = auth.uid());
create policy remove_own_calendar on public.calendar_entries for delete to authenticated
  using (owner_id = auth.uid());

-- Supabase default privileges can grant DML. Revoke before the explicit grants.
revoke all on public.profiles, public.user_data, public.friend_requests,
  public.shared_activities, public.activity_invitations, public.calendar_entries from anon, authenticated;
grant select on public.profiles, public.shared_activities to anon, authenticated;
grant update(display_name, handle, club) on public.profiles to authenticated;
grant select, insert, update, delete on public.user_data to authenticated;
grant select on public.friend_requests, public.activity_invitations, public.calendar_entries to authenticated;
grant delete on public.calendar_entries to authenticated;

create function public.search_players(p_query text)
returns table(id uuid, display_name text, handle text, club text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.handle, p.club from public.profiles p
  where auth.uid() is not null and p.id <> auth.uid() and char_length(ltrim(trim(p_query), '@')) between 2 and 80
    and position(lower(ltrim(trim(p_query), '@')) in lower(p.display_name || ' ' || p.handle)) > 0
  order by p.display_name limit 20
$$;
create function public.request_friend(p_recipient uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare request_id uuid;
begin
  if auth.uid() is null or p_recipient = auth.uid() then raise exception 'Neplatná žiadosť.'; end if;
  insert into public.friend_requests(requester_id, recipient_id) values (auth.uid(), p_recipient)
    on conflict do nothing returning id into request_id;
  if request_id is null then
    select id into request_id from public.friend_requests
    where least(requester_id, recipient_id) = least(auth.uid(), p_recipient)
      and greatest(requester_id, recipient_id) = greatest(auth.uid(), p_recipient);
  end if;
  return request_id;
end; $$;
create function public.respond_friend(p_request uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.friend_requests where id = p_request
    and recipient_id = auth.uid() and status = 'pending') then raise exception 'Žiadosť nie je dostupná.'; end if;
  if p_accept then
    update public.friend_requests set status = 'accepted' where id = p_request;
  else
    delete from public.friend_requests where id = p_request;
  end if;
end; $$;
create function public.remove_friend(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare friendship public.friend_requests;
begin
  delete from public.friend_requests where id = p_request and auth.uid() in (requester_id, recipient_id)
    returning * into friendship;
  if not found then raise exception 'Žiadosť nie je dostupná.'; end if;
  delete from public.activity_invitations i using public.shared_activities a
    where i.activity_id = a.id and (
      (a.owner_id = friendship.requester_id and i.recipient_id = friendship.recipient_id) or
      (a.owner_id = friendship.recipient_id and i.recipient_id = friendship.requester_id)
    );
end; $$;

-- Only these public fields may leave the owner's private backup. No privateNote,
-- equipment IDs, scouting notes, photos or arbitrary JSON keys are copied.
create function public.publish_activity(p_local_id text, p_payload jsonb, p_visibility text, p_invitees uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare activity uuid; shared jsonb; event_date date;
begin
  if auth.uid() is null then raise exception 'Najprv sa prihlás.'; end if;
  if p_visibility not in ('private', 'friends', 'community') or p_visibility is null then raise exception 'Neplatná viditeľnosť.'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 16000 then raise exception 'Príliš veľký záznam.'; end if;
  if exists(select 1 from jsonb_each(p_payload) fields where key = any(array[
    'category','date','startTime','location','title','publicNote','opponentName','matchScore',
    'matchResult','leagueName','teamHome','teamAway','round','eventCategory','placing','eventResult'
  ]) and value <> 'null'::jsonb and (jsonb_typeof(value) <> 'string'
    or char_length(value #>> '{}') > case when key = 'publicNote' then 4000 else 200 end))
    then raise exception 'Neplatný text aktivity.'; end if;
  if p_payload ? 'durationMinutes' and p_payload->'durationMinutes' <> 'null'::jsonb
    and jsonb_typeof(p_payload->'durationMinutes') <> 'number' then raise exception 'Neplatné trvanie.'; end if;
  if p_payload ? 'focusDrills' and p_payload->'focusDrills' <> 'null'::jsonb then
    if jsonb_typeof(p_payload->'focusDrills') <> 'array' or jsonb_array_length(p_payload->'focusDrills') > 50
      then raise exception 'Neplatná náplň tréningu.'; end if;
    if exists(select 1 from jsonb_array_elements(p_payload->'focusDrills') drill
      where jsonb_typeof(drill) <> 'string' or char_length(drill #>> '{}') > 80)
      then raise exception 'Neplatná náplň tréningu.'; end if;
  end if;
  if coalesce(p_payload->>'category', '') not in ('tréning', 'priatelsky', 'turnaj', 'liga', 'podujatie') then raise exception 'Neplatný typ aktivity.'; end if;
  if coalesce(p_payload->>'date', '') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Neplatný dátum.'; end if;
  event_date := (p_payload->>'date')::date;
  if p_payload->>'startTime' is not null and p_payload->>'startTime' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Neplatný čas.'; end if;
  if coalesce((p_payload->>'durationMinutes')::numeric, 0) not between 0 and 1440 then raise exception 'Neplatné trvanie.'; end if;
  if coalesce(cardinality(p_invitees), 0) > 20 then raise exception 'Pozvi najviac 20 priateľov.'; end if;
  if p_visibility = 'private' and coalesce(cardinality(p_invitees), 0) > 0 then raise exception 'Súkromná aktivita nemôže mať pozvánky.'; end if;
  if exists(select 1 from unnest(p_invitees) x where x is null or not public.are_friends(auth.uid(), x)) then raise exception 'Pozvať môžeš iba prijatých priateľov.'; end if;
  select jsonb_strip_nulls(jsonb_object_agg(key, value)) into shared
  from jsonb_each(p_payload) where key = any(array[
    'category', 'date', 'startTime', 'durationMinutes', 'focusDrills', 'location', 'title',
    'publicNote', 'opponentName', 'matchScore', 'matchResult', 'leagueName', 'teamHome', 'teamAway',
    'round', 'eventCategory', 'placing', 'eventResult'
  ]);
  insert into public.shared_activities(owner_id, local_id, visibility, activity_date, payload)
    values (auth.uid(), p_local_id, p_visibility, event_date, shared)
    on conflict (owner_id, local_id) do update set visibility = excluded.visibility,
      activity_date = excluded.activity_date, payload = excluded.payload returning id into activity;
  delete from public.activity_invitations where activity_id = activity
    and (p_visibility = 'private' or not (recipient_id = any(coalesce(p_invitees, '{}'))));
  insert into public.activity_invitations(activity_id, recipient_id)
    select activity, x from (select distinct unnest(p_invitees) x) recipients
    on conflict (activity_id, recipient_id) do nothing;
  return activity;
end; $$;
create function public.change_activity_visibility(p_activity uuid, p_visibility text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_visibility not in ('private', 'friends', 'community') or p_visibility is null then raise exception 'Neplatná viditeľnosť.'; end if;
  update public.shared_activities set visibility = p_visibility where id = p_activity and owner_id = auth.uid();
  if not found then raise exception 'Aktivita nie je dostupná.'; end if;
  if p_visibility = 'private' then delete from public.activity_invitations where activity_id = p_activity; end if;
end; $$;
create function public.unshare_activity(p_activity uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.shared_activities where id = p_activity and owner_id = auth.uid();
  if not found then raise exception 'Aktivita nie je dostupná.'; end if;
end; $$;
create function public.unshare_local_activity(p_local_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Najprv sa prihlás.'; end if;
  delete from public.shared_activities where owner_id = auth.uid() and local_id = p_local_id;
end; $$;
create function public.unshare_all_activities() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Najprv sa prihlás.'; end if;
  delete from public.shared_activities where owner_id = auth.uid();
end; $$;
create function public.accept_activity_invitation(p_invitation uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare invite public.activity_invitations; activity public.shared_activities; calendar_id uuid; author text;
begin
  select * into invite from public.activity_invitations
    where id = p_invitation and recipient_id = auth.uid();
  if not found or invite.status = 'declined' then raise exception 'Pozvánka nie je dostupná.'; end if;
  select * into activity from public.shared_activities where id = invite.activity_id for share;
  if not found or activity.visibility = 'private' then raise exception 'Pozvánka už neplatí.'; end if;
  -- Lock the activity before the invitation, matching publish/privacy changes.
  select * into invite from public.activity_invitations
    where id = p_invitation and recipient_id = auth.uid() for update;
  if not found or invite.status = 'declined' then raise exception 'Pozvánka nie je dostupná.'; end if;
  select display_name into author from public.profiles where id = activity.owner_id;
  insert into public.calendar_entries(owner_id, source_activity_id, activity_date, data)
    values (auth.uid(), activity.id, activity.activity_date, activity.payload || jsonb_build_object('authorName', author))
    on conflict (owner_id, source_activity_id) do nothing returning id into calendar_id;
  if calendar_id is null then select id into calendar_id from public.calendar_entries
    where owner_id = auth.uid() and source_activity_id = activity.id; end if;
  update public.activity_invitations set status = 'accepted' where id = invite.id;
  return calendar_id;
end; $$;
create function public.decline_activity_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.activity_invitations set status = 'declined'
    where id = p_invitation and recipient_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Pozvánka nie je dostupná.'; end if;
end; $$;

revoke all on function public.create_player_profile() from public, anon, authenticated;
revoke all on function public.are_friends(uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_view_activity(uuid) from public;
grant execute on function public.can_view_activity(uuid) to anon, authenticated;
revoke all on function public.search_players(text), public.request_friend(uuid),
 public.respond_friend(uuid, boolean), public.remove_friend(uuid),
 public.publish_activity(text, jsonb, text, uuid[]), public.change_activity_visibility(uuid, text),
 public.unshare_activity(uuid), public.unshare_local_activity(text), public.unshare_all_activities(), public.accept_activity_invitation(uuid), public.decline_activity_invitation(uuid)
 from public, anon, authenticated;
grant execute on function public.search_players(text), public.request_friend(uuid),
 public.respond_friend(uuid, boolean), public.remove_friend(uuid),
 public.publish_activity(text, jsonb, text, uuid[]), public.change_activity_visibility(uuid, text),
 public.unshare_activity(uuid), public.unshare_local_activity(text), public.unshare_all_activities(), public.accept_activity_invitation(uuid), public.decline_activity_invitation(uuid)
 to authenticated;
