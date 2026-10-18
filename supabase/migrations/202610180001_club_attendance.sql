-- Run after 202610100001_community.sql.
-- Training organisers act as coaches for the sessions they create.
begin;
create table public.club_trainings (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  location text not null default '' check (char_length(location) <= 200),
  training_date date not null,
  start_time time not null,
  duration_minutes integer not null check (duration_minutes between 10 and 600),
  focus_drills text[] not null default '{}',
  response_deadline timestamptz not null,
  created_at timestamptz not null default now(),
  check (cardinality(focus_drills) <= 50)
);
create table public.club_training_members (
  training_id uuid not null references public.club_trainings(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  response text check (response in ('yes', 'no', 'unsure')),
  responded_at timestamptz,
  attended boolean,
  confirmed_at timestamptz,
  primary key(training_id, player_id)
);
create index club_training_members_player_idx on public.club_training_members(player_id);

create function public.can_access_club_training(p_training uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.club_trainings where id=p_training and coach_id=auth.uid())
    or exists(select 1 from public.club_training_members where training_id=p_training and player_id=auth.uid());
$$;
alter table public.club_trainings enable row level security;
alter table public.club_training_members enable row level security;
create policy club_training_read on public.club_trainings for select to authenticated
 using(public.can_access_club_training(id));
create policy club_members_read on public.club_training_members for select to authenticated
 using(player_id=auth.uid() or exists(select 1 from public.club_trainings t where t.id=training_id and t.coach_id=auth.uid()));
revoke all on public.club_trainings, public.club_training_members from anon, authenticated;
grant select on public.club_trainings, public.club_training_members to authenticated;

create function public.create_club_training(p_title text, p_location text, p_date date,
  p_start time, p_duration integer, p_drills text[], p_deadline timestamptz, p_players uuid[])
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_player uuid; v_start timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  v_start := (p_date + p_start) at time zone 'Europe/Bratislava';
  if v_start <= now() or p_deadline <= now() or p_deadline > v_start then
    raise exception 'Deadline must be in the future and before training'; end if;
  if coalesce(cardinality(p_players),0) < 1 or cardinality(p_players) > 100 then
    raise exception 'Choose 1 to 100 friends'; end if;
  if exists(select 1 from unnest(p_drills) d where char_length(d) > 80) then
    raise exception 'Drill too long'; end if;
  insert into public.club_trainings(coach_id,title,location,training_date,start_time,duration_minutes,focus_drills,response_deadline)
    values(auth.uid(),trim(p_title),trim(p_location),p_date,p_start,p_duration,coalesce(p_drills,'{}'),p_deadline) returning id into v_id;
  foreach v_player in array p_players loop
    if v_player is null or v_player=auth.uid() or not public.are_friends(auth.uid(),v_player) then
      raise exception 'Only accepted friends may be invited'; end if;
    insert into public.club_training_members(training_id,player_id) values(v_id,v_player) on conflict do nothing;
  end loop;
  return v_id;
end $$;

create function public.respond_club_training(p_training uuid, p_response text) returns void
language plpgsql security definer set search_path=public as $$
declare v_deadline timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_response is null or p_response not in ('yes','no','unsure') then raise exception 'Invalid response'; end if;
  select response_deadline into v_deadline from public.club_trainings where id=p_training for update;
  if v_deadline is null or now() > v_deadline then raise exception 'Response deadline passed'; end if;
  update public.club_training_members set response=p_response,responded_at=now()
    where training_id=p_training and player_id=auth.uid();
  if not found then raise exception 'Invitation required'; end if;
end $$;

create function public.confirm_club_attendance(p_training uuid,p_player uuid,p_attended boolean) returns void
language plpgsql security definer set search_path=public as $$
declare v_training public.club_trainings;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_training from public.club_trainings where id=p_training for update;
  if v_training.coach_id is distinct from auth.uid() then raise exception 'Only the coach can confirm attendance'; end if;
  if ((v_training.training_date+v_training.start_time) at time zone 'Europe/Bratislava') + make_interval(mins=>v_training.duration_minutes) > now() then
    raise exception 'Training has not finished'; end if;
  if p_attended is null then raise exception 'Attendance required'; end if;
  update public.club_training_members set attended=p_attended,confirmed_at=now() where training_id=p_training and player_id=p_player;
  if not found then raise exception 'Player not invited'; end if;
end $$;

revoke execute on function public.can_access_club_training(uuid) from public,anon;
revoke execute on function public.create_club_training(text,text,date,time,integer,text[],timestamptz,uuid[]) from public,anon;
revoke execute on function public.respond_club_training(uuid,text) from public,anon;
revoke execute on function public.confirm_club_attendance(uuid,uuid,boolean) from public,anon;
grant execute on function public.can_access_club_training(uuid) to authenticated;
grant execute on function public.create_club_training(text,text,date,time,integer,text[],timestamptz,uuid[]) to authenticated;
grant execute on function public.respond_club_training(uuid,text) to authenticated;
grant execute on function public.confirm_club_attendance(uuid,uuid,boolean) to authenticated;
commit;
