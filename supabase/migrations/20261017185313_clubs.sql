-- Club data is opt-in and isolated from private account backups.
create schema if not exists club_private;
revoke all on schema club_private from public, anon;
grant usage on schema club_private to authenticated;
create table public.clubs (
 id uuid primary key default gen_random_uuid(), name text not null check(char_length(trim(name)) between 1 and 120),
 owner_id uuid not null references public.profiles(id) on delete cascade, created_at timestamptz not null default now()
);
create index clubs_owner_idx on public.clubs(owner_id);
create table public.club_members (
 club_id uuid references public.clubs(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade,
 role text not null default 'player' check(role in ('owner','coach','player')), primary key(club_id,user_id)
);
create index club_members_user_idx on public.club_members(user_id,club_id);
create table public.club_invite_codes (
 club_id uuid primary key references public.clubs(id) on delete cascade,
 code text not null unique default replace(gen_random_uuid()::text,'-','')
);
create table public.club_activities (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
 owner_id uuid not null references public.profiles(id) on delete cascade,
 local_id text not null check(char_length(local_id) between 1 and 120),
 activity_date date not null, payload jsonb not null check(jsonb_typeof(payload)='object'),
 scheduled boolean not null default false, tagged_ids uuid[] not null default '{}',
 created_at timestamptz not null default now(), unique(club_id,owner_id,local_id)
);
create index club_activities_date_idx on public.club_activities(club_id,activity_date desc,id);
create index club_activities_owner_idx on public.club_activities(owner_id);
create table public.club_notes (
 id uuid primary key default gen_random_uuid(), activity_id uuid not null references public.club_activities(id) on delete cascade,
 author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 body text not null check(char_length(trim(body)) between 1 and 4000), created_at timestamptz not null default now()
);
create index club_notes_activity_idx on public.club_notes(activity_id,created_at);
create index club_notes_author_idx on public.club_notes(author_id);
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_invite_codes enable row level security;
alter table public.club_activities enable row level security;
alter table public.club_notes enable row level security;
revoke all on public.clubs,public.club_members,public.club_invite_codes,public.club_activities,public.club_notes from anon,authenticated;
grant select on public.clubs,public.club_members,public.club_invite_codes,public.club_activities,public.club_notes to authenticated;
grant insert(activity_id,body), delete on public.club_notes to authenticated;
create function club_private.my_role(p_club uuid) returns text language sql stable security definer set search_path='' as $$
 select role from public.club_members where club_id=p_club and user_id=(select auth.uid());
$$;
revoke all on function club_private.my_role(uuid) from public,anon;
grant execute on function club_private.my_role(uuid) to authenticated;
create policy club_read on public.clubs for select to authenticated using(club_private.my_role(id) is not null);
create policy members_read on public.club_members for select to authenticated using(club_private.my_role(club_id) is not null);
create policy codes_owner on public.club_invite_codes for select to authenticated using(club_private.my_role(club_id)='owner');
create policy activities_read on public.club_activities for select to authenticated using(club_private.my_role(club_id) is not null);
create policy notes_read on public.club_notes for select to authenticated using(exists(select 1 from public.club_activities a where a.id=activity_id));
create policy notes_coach on public.club_notes for insert to authenticated with check(author_id=(select auth.uid()) and exists(select 1 from public.club_activities a where a.id=activity_id and club_private.my_role(a.club_id) in ('owner','coach')));
create policy notes_delete on public.club_notes for delete to authenticated using(author_id=(select auth.uid()) and exists(select 1 from public.club_activities a where a.id=activity_id));

create function club_private.create_club(p_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
 if auth.uid() is null then raise exception 'Najprv sa prihlás.'; end if;

 insert into public.clubs(name,owner_id) values(trim(p_name),auth.uid()) returning id into c;
 insert into public.club_members values(c,auth.uid(),'owner');
 insert into public.club_invite_codes(club_id) values(c);
 return c;
end; $$;
revoke all on function club_private.create_club(text) from public,anon;
grant execute on function club_private.create_club(text) to authenticated;
create function public.create_club(p_name text) returns uuid language sql security invoker set search_path='' as $$
 select club_private.create_club(p_name);
$$;
revoke all on function public.create_club(text) from public,anon;
grant execute on function public.create_club(text) to authenticated;

create function club_private.join_club(p_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
 if auth.uid() is null then raise exception 'Najprv sa prihlás.'; end if;

 select club_id into c from public.club_invite_codes where code=trim(p_code);
 if c is null then raise exception 'Neplatný kód klubu.'; end if;
 perform 1 from public.clubs where id=c for update;
 -- Recheck after waiting for code rotation or club deletion.
 if not exists(select 1 from public.club_invite_codes where club_id=c and code=trim(p_code)) then raise exception 'Neplatný kód klubu.'; end if;
 insert into public.club_members values(c,auth.uid(),'player') on conflict do nothing;
 return c;
end; $$;
revoke all on function club_private.join_club(text) from public,anon;
grant execute on function club_private.join_club(text) to authenticated;
create function public.join_club(p_code text) returns uuid language sql security invoker set search_path='' as $$
 select club_private.join_club(p_code);
$$;
revoke all on function public.join_club(text) from public,anon;
grant execute on function public.join_club(text) to authenticated;

create function club_private.manage_club_member(p_club uuid, p_user uuid, p_role text) returns void language plpgsql security definer set search_path='' as $$

begin
 if auth.uid() is null then raise exception 'Najprv sa prihlás.'; end if;

 perform 1 from public.clubs where id=p_club for update;
 if club_private.my_role(p_club) is null or not (club_private.my_role(p_club)='owner' or (p_user=auth.uid() and p_role='remove')) then raise exception 'Klub môže spravovať iba zakladateľ.'; end if;
 if exists(select 1 from public.clubs where id=p_club and owner_id=p_user) then raise exception 'Zakladateľ musí zostať členom klubu.'; end if;
 if p_role='remove' then
   delete from public.club_members where club_id=p_club and user_id=p_user;
   update public.club_activities set tagged_ids=array_remove(tagged_ids,p_user) where club_id=p_club and p_user=any(tagged_ids);
 elsif p_role in ('coach','player') then update public.club_members set role=p_role where club_id=p_club and user_id=p_user;
 else raise exception 'Neplatná rola.'; end if;
end; $$;
revoke all on function club_private.manage_club_member(uuid, uuid, text) from public,anon;
grant execute on function club_private.manage_club_member(uuid, uuid, text) to authenticated;
create function public.manage_club_member(p_club uuid, p_user uuid, p_role text) returns void language sql security invoker set search_path='' as $$
 select club_private.manage_club_member(p_club, p_user, p_role);
$$;
revoke all on function public.manage_club_member(uuid, uuid, text) from public,anon;
grant execute on function public.manage_club_member(uuid, uuid, text) to authenticated;

create function club_private.rotate_club_code(p_club uuid) returns void language plpgsql security definer set search_path='' as $$

begin
 if auth.uid() is null then raise exception 'Najprv sa prihlás.'; end if;

 perform 1 from public.clubs where id=p_club for update;
 if club_private.my_role(p_club) is distinct from 'owner' then raise exception 'Klub môže spravovať iba zakladateľ.'; end if;
 update public.club_invite_codes set code=replace(gen_random_uuid()::text,'-','') where club_id=p_club;
end; $$;
revoke all on function club_private.rotate_club_code(uuid) from public,anon;
grant execute on function club_private.rotate_club_code(uuid) to authenticated;
create function public.rotate_club_code(p_club uuid) returns void language sql security invoker set search_path='' as $$
 select club_private.rotate_club_code(p_club);
$$;
revoke all on function public.rotate_club_code(uuid) from public,anon;
grant execute on function public.rotate_club_code(uuid) to authenticated;

create function club_private.publish_club_activity(p_club uuid, p_local_id text, p_payload jsonb, p_scheduled boolean, p_tags uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare activity uuid; shared jsonb; event_date date;
begin
 if auth.uid() is null then raise exception 'Najprv sa prihlás.'; end if;

 perform 1 from public.clubs where id=p_club for update;
 if club_private.my_role(p_club) is null then raise exception 'Najprv sa pridaj do klubu.'; end if;
 if p_scheduled and club_private.my_role(p_club) not in ('owner','coach') then raise exception 'Rozpis môže vytvárať iba tréner.'; end if;
 if coalesce(cardinality(p_tags),0)>100 or exists(select 1 from unnest(p_tags) x where x is null or not exists(select 1 from public.club_members where club_id=p_club and user_id=x)) then raise exception 'Označiť môžeš iba členov klubu (najviac 100).'; end if;
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
  select jsonb_strip_nulls(jsonb_object_agg(key, value)) into shared
  from jsonb_each(p_payload) where key = any(array[
    'category', 'date', 'startTime', 'durationMinutes', 'focusDrills', 'location', 'title',
    'publicNote', 'opponentName', 'matchScore', 'matchResult', 'leagueName', 'teamHome', 'teamAway',
    'round', 'eventCategory', 'placing', 'eventResult'
  ]);

 insert into public.club_activities(club_id,owner_id,local_id,activity_date,payload,scheduled,tagged_ids)
 values(p_club,auth.uid(),p_local_id,event_date,shared,p_scheduled,coalesce(p_tags,'{}'))
 on conflict(club_id,owner_id,local_id) do update set activity_date=excluded.activity_date,payload=excluded.payload,scheduled=excluded.scheduled,tagged_ids=excluded.tagged_ids returning id into activity;
 return activity;
end; $$;
revoke all on function club_private.publish_club_activity(uuid, text, jsonb, boolean, uuid[]) from public,anon;
grant execute on function club_private.publish_club_activity(uuid, text, jsonb, boolean, uuid[]) to authenticated;
create function public.publish_club_activity(p_club uuid, p_local_id text, p_payload jsonb, p_scheduled boolean, p_tags uuid[]) returns uuid language sql security invoker set search_path='' as $$
 select club_private.publish_club_activity(p_club, p_local_id, p_payload, p_scheduled, p_tags);
$$;
revoke all on function public.publish_club_activity(uuid, text, jsonb, boolean, uuid[]) from public,anon;
grant execute on function public.publish_club_activity(uuid, text, jsonb, boolean, uuid[]) to authenticated;

create function club_private.delete_club_activity(p_activity uuid) returns void language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
 if auth.uid() is null then raise exception 'Najprv sa prihlás.'; end if;

 select club_id into c from public.club_activities where id=p_activity;
 perform 1 from public.clubs where id=c for update;
 if club_private.my_role(c) is null then raise exception 'Aktivita nie je dostupná.'; end if;
 delete from public.club_activities where id=p_activity and (owner_id=auth.uid() or club_private.my_role(c)='owner');
 if not found then raise exception 'Aktivita nie je dostupná.'; end if;
end; $$;
revoke all on function club_private.delete_club_activity(uuid) from public,anon;
grant execute on function club_private.delete_club_activity(uuid) to authenticated;
create function public.delete_club_activity(p_activity uuid) returns void language sql security invoker set search_path='' as $$
 select club_private.delete_club_activity(p_activity);
$$;
revoke all on function public.delete_club_activity(uuid) from public,anon;
grant execute on function public.delete_club_activity(uuid) to authenticated;

create function club_private.tag_shared_activity(p_activity uuid, p_recipient uuid) returns void language plpgsql security definer set search_path='' as $$

begin
 if auth.uid() is null then raise exception 'Najprv sa prihlás.'; end if;

 perform 1 from public.shared_activities where id=p_activity and owner_id=auth.uid() and visibility<>'private' for update;
 if not found then raise exception 'Aktivita nie je dostupná na označenie.'; end if;
 if not public.are_friends(auth.uid(),p_recipient) then raise exception 'Pozvať môžeš iba prijatých priateľov.'; end if;
 insert into public.activity_invitations(activity_id,recipient_id) values(p_activity,p_recipient)
 on conflict(activity_id,recipient_id) do nothing;
end; $$;
revoke all on function club_private.tag_shared_activity(uuid, uuid) from public,anon;
grant execute on function club_private.tag_shared_activity(uuid, uuid) to authenticated;
create function public.tag_shared_activity(p_activity uuid, p_recipient uuid) returns void language sql security invoker set search_path='' as $$
 select club_private.tag_shared_activity(p_activity, p_recipient);
$$;
revoke all on function public.tag_shared_activity(uuid, uuid) from public,anon;
grant execute on function public.tag_shared_activity(uuid, uuid) to authenticated;
