-- Only names, roles and member counts are discoverable through accepted friends.
-- Club posts, full rosters, notes and invitation codes retain member-only RLS.
create table public.club_connections (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.clubs(id) on delete cascade,
 player_id uuid not null references public.profiles(id) on delete cascade,
 created_by uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('request','invitation')),
 status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
 created_at timestamptz not null default now(),
 unique(club_id,player_id,kind)
);
create index club_connections_player_idx on public.club_connections(player_id,status);
create index club_connections_actor_idx on public.club_connections(created_by);
alter table public.club_connections enable row level security;
revoke all on public.club_connections from public,anon,authenticated;
grant select on public.club_connections to authenticated;
create policy club_connections_read on public.club_connections for select to authenticated
 using(player_id=(select auth.uid()) or created_by=(select auth.uid()) or club_private.my_role(club_id) in ('owner','coach'));

create function club_private.has_friend_in_club(p_club uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.club_members m
 where m.club_id=p_club and public.are_friends(auth.uid(),m.user_id));
$$;
revoke all on function club_private.has_friend_in_club(uuid) from public,anon;
grant execute on function club_private.has_friend_in_club(uuid) to authenticated;

create function club_private.resolve_joined_connections() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.club_connections set status='accepted' where club_id=new.club_id and player_id=new.user_id and status='pending';
 return new;
end; $$;
revoke all on function club_private.resolve_joined_connections() from public,anon,authenticated;
create trigger club_connections_joined after insert on public.club_members for each row execute function club_private.resolve_joined_connections();

create function club_private.get_club_connections() returns jsonb language plpgsql security definer set search_path='' as $$

begin
 if auth.uid() is null then raise exception 'Najprv sa prihlás.'; end if;

 return jsonb_build_object(
 'memberships',coalesce((select jsonb_agg(jsonb_build_object('club_id',c.id,'name',c.name,'user_id',m.user_id,'role',m.role,
  'member_count',(select count(*) from public.club_members n where n.club_id=c.id)) order by c.name,m.user_id)
  from public.club_members m join public.clubs c on c.id=m.club_id
  where m.user_id=auth.uid() or public.are_friends(auth.uid(),m.user_id)),'[]'::jsonb),
 'actions',coalesce((select jsonb_agg(item order by created_at desc,id) from (
  select a.id,a.created_at,jsonb_build_object('id',a.id,'club_id',a.club_id,'club_name',c.name,
   'player_id',a.player_id,'player_name',p.display_name,'created_by',a.created_by,'actor_name',sender.display_name,
   'kind',a.kind,'status',a.status,'created_at',a.created_at,
   'can_respond',case when a.kind='request' then coalesce(club_private.my_role(a.club_id) in ('owner','coach'),false) else a.player_id=auth.uid() end,
   'can_cancel',a.created_by=auth.uid() or coalesce(club_private.my_role(a.club_id) in ('owner','coach'),false)) as item
  from public.club_connections a join public.clubs c on c.id=a.club_id
   join public.profiles p on p.id=a.player_id join public.profiles sender on sender.id=a.created_by
  where a.player_id=auth.uid() or a.created_by=auth.uid() or club_private.my_role(a.club_id) in ('owner','coach')
  order by (a.status='pending') desc,a.created_at desc,a.id limit 200
 ) visible),'[]'::jsonb));
end; $$;
revoke all on function club_private.get_club_connections() from public,anon;
grant execute on function club_private.get_club_connections() to authenticated;
create function public.get_club_connections() returns jsonb language sql security invoker set search_path='' as $$
 select club_private.get_club_connections();
$$;
revoke all on function public.get_club_connections() from public,anon;
grant execute on function public.get_club_connections() to authenticated;

create function club_private.request_club_membership(p_club uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Najprv sa prihlás.'; end if;

 perform 1 from public.clubs where id=p_club for update;
 if not found or not club_private.has_friend_in_club(p_club) then raise exception 'Klub nie je dostupný cez tvojich priateľov.'; end if;
 if club_private.my_role(p_club) is not null then raise exception 'Už si členom tohto klubu.'; end if;
 insert into public.club_connections(club_id,player_id,created_by,kind) values(p_club,auth.uid(),auth.uid(),'request')
 on conflict(club_id,player_id,kind) do update set status='pending',created_at=case when club_connections.status='pending' then club_connections.created_at else now() end
 returning id into result;
 return result;
end; $$;
revoke all on function club_private.request_club_membership(uuid) from public,anon;
grant execute on function club_private.request_club_membership(uuid) to authenticated;
create function public.request_club_membership(p_club uuid) returns uuid language sql security invoker set search_path='' as $$
 select club_private.request_club_membership(p_club);
$$;
revoke all on function public.request_club_membership(uuid) from public,anon;
grant execute on function public.request_club_membership(uuid) to authenticated;

create function club_private.invite_friend_to_club(p_club uuid, p_player uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Najprv sa prihlás.'; end if;

 perform 1 from public.clubs where id=p_club for update;
 if club_private.my_role(p_club) is null or club_private.my_role(p_club) not in ('owner','coach') then raise exception 'Pozvánky posiela zakladateľ alebo tréner klubu.'; end if;
 if not public.are_friends(auth.uid(),p_player) or p_player is null then raise exception 'Pozvať môžeš iba prijatého priateľa.'; end if;
 if exists(select 1 from public.club_members where club_id=p_club and user_id=p_player) then raise exception 'Hráč už je členom klubu.'; end if;
 insert into public.club_connections(club_id,player_id,created_by,kind) values(p_club,p_player,auth.uid(),'invitation')
 on conflict(club_id,player_id,kind) do update set status='pending',
 created_by=auth.uid(),
 created_at=case when club_connections.status='pending' then club_connections.created_at else now() end
 returning id into result;
 return result;
end; $$;
revoke all on function club_private.invite_friend_to_club(uuid, uuid) from public,anon;
grant execute on function club_private.invite_friend_to_club(uuid, uuid) to authenticated;
create function public.invite_friend_to_club(p_club uuid, p_player uuid) returns uuid language sql security invoker set search_path='' as $$
 select club_private.invite_friend_to_club(p_club, p_player);
$$;
revoke all on function public.invite_friend_to_club(uuid, uuid) from public,anon;
grant execute on function public.invite_friend_to_club(uuid, uuid) to authenticated;

create function club_private.respond_club_connection(p_connection uuid, p_decision text) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.club_connections; c uuid; manager boolean;
begin
 if auth.uid() is null then raise exception 'Najprv sa prihlás.'; end if;

 if p_decision is null or p_decision not in ('accept','decline','cancel') then raise exception 'Neplatná odpoveď.'; end if;
 select club_id into c from public.club_connections where id=p_connection;
 perform 1 from public.clubs where id=c for update;
 select * into a from public.club_connections where id=p_connection for update;
 if not found then raise exception 'Pozvánka alebo žiadosť už nie je dostupná.'; end if;
 manager := coalesce(club_private.my_role(c) in ('owner','coach'),false);
 if p_decision='cancel' then
  if a.created_by<>auth.uid() and not manager then raise exception 'Túto žiadosť nemôžeš zrušiť.'; end if;
 elsif (a.kind='request' and not manager) or (a.kind='invitation' and a.player_id<>auth.uid()) then
  raise exception 'Túto pozvánku alebo žiadosť nemôžeš vybaviť.';
 end if;
 if a.status='accepted' and p_decision='accept' and exists(select 1 from public.club_members where club_id=c and user_id=a.player_id) then return c; end if;
 if a.status<>'pending' then raise exception 'Pozvánka alebo žiadosť už bola vybavená.'; end if;
 if p_decision='accept' then
  if a.kind='invitation' and (not public.are_friends(a.created_by,a.player_id) or not exists(select 1 from public.club_members where club_id=c and user_id=a.created_by and role in ('owner','coach'))) then raise exception 'Pozvánka už neplatí. Požiadaj o novú.'; end if;
  if a.kind='request' and not exists(select 1 from public.club_members m where m.club_id=c and public.are_friends(a.player_id,m.user_id)) then raise exception 'Žiadosť už nemá spojenie s členmi klubu.'; end if;
  insert into public.club_members(club_id,user_id,role) values(c,a.player_id,'player') on conflict do nothing;
  update public.club_connections set status='accepted' where club_id=c and player_id=a.player_id and status='pending';
 else update public.club_connections set status=case when p_decision='cancel' then 'cancelled' else 'declined' end where id=a.id;
 end if;
 return c;
end; $$;
revoke all on function club_private.respond_club_connection(uuid, text) from public,anon;
grant execute on function club_private.respond_club_connection(uuid, text) to authenticated;
create function public.respond_club_connection(p_connection uuid, p_decision text) returns uuid language sql security invoker set search_path='' as $$
 select club_private.respond_club_connection(p_connection, p_decision);
$$;
revoke all on function public.respond_club_connection(uuid, text) from public,anon;
grant execute on function public.respond_club_connection(uuid, text) to authenticated;
