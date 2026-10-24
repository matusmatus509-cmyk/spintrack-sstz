import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const owner = "11111111-1111-4111-8111-111111111111",
  player = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333",
  coach = "44444444-4444-4444-8444-444444444444";
test("friend club discovery, approved membership, personal invitations and isolated permissions", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
  create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
    const dir = new URL("../supabase/migrations/", import.meta.url);
    for (const file of (await fs.readdir(dir))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(await fs.readFile(new URL(file, dir), "utf8"));
    for (const [id, handle] of [
      [owner, "owner"],
      [player, "player"],
      [other, "other"],
      [coach, "coach"],
    ])
      await db.query("insert into auth.users values($1,$2)", [
        id,
        { display_name: handle, handle },
      ]);
    const as = async (id, role = "authenticated") => {
      await db.exec(`reset role;set role ${role}`);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id || "",
      ]);
    };
    const rpc = async (name, args = []) =>
      (
        await db.query(
          `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as value`,
          args,
        )
      ).rows[0].value;
    const friends = async (a, b) => {
      await as(a);
      const id = await rpc("request_friend", [b]);
      await as(b);
      await rpc("respond_friend", [id, true]);
      return id;
    };
    const friendship = await friends(owner, player);
    await as(owner);
    const club = await rpc("create_club", ["Žiar test"]);
    const code = (await db.query("select code from club_invite_codes")).rows[0]
      .code;
    await rpc("publish_club_activity", [
      club,
      "secret",
      {
        category: "tréning",
        date: "2026-10-25",
        durationMinutes: 90,
        location: "Private",
      },
      true,
      [],
    ]);
    await as(player);
    const directory = await rpc("get_club_connections");
    assert.equal(directory.memberships.length, 1);
    assert.equal(directory.memberships[0].name, "Žiar test");
    assert.equal(directory.memberships[0].role, "owner");
    assert.equal(directory.memberships[0].member_count, 1);
    assert.deepEqual(Object.keys(directory.memberships[0]).sort(), [
      "club_id",
      "member_count",
      "name",
      "role",
      "user_id",
    ]);
    for (const t of [
      "clubs",
      "club_members",
      "club_activities",
      "club_invite_codes",
    ])
      assert.equal(
        (await db.query("select * from " + t)).rows.length,
        0,
        "discovery does not expose " + t,
      );
    const request = await rpc("request_club_membership", [club]);
    assert.equal(await rpc("request_club_membership", [club]), request);
    assert.equal(
      (await rpc("get_club_connections")).actions[0].can_respond,
      false,
    );
    await assert.rejects(
      rpc("respond_club_connection", [request, "accept"]),
      /nemôžeš vybaviť/,
    );
    await as(other);
    assert.equal((await rpc("get_club_connections")).memberships.length, 0);
    assert.equal((await rpc("get_club_connections")).actions.length, 0);
    await assert.rejects(
      rpc("request_club_membership", [club]),
      /nie je dostupný/,
    );
    await assert.rejects(
      rpc("respond_club_connection", [request, "decline"]),
      /nemôžeš vybaviť/,
    );
    await assert.rejects(
      db.query(
        "insert into club_connections(club_id,player_id,created_by,kind) values($1,$2,$2,'request')",
        [club, other],
      ),
      /permission denied/,
    );
    await as(owner);
    assert.equal(
      (await rpc("get_club_connections")).actions[0].can_respond,
      true,
    );
    await rpc("respond_club_connection", [request, "decline"]);
    await as(player);
    assert.equal(
      (await rpc("get_club_connections")).actions[0].status,
      "declined",
    );
    await rpc("request_club_membership", [club]);
    await as(owner);
    await rpc("respond_club_connection", [request, "accept"]);
    await rpc("respond_club_connection", [request, "accept"]);
    await as(player);
    assert.equal(
      (
        await db.query("select role from club_members where user_id=$1", [
          player,
        ])
      ).rows[0].role,
      "player",
    );
    assert.equal(
      (await db.query("select * from club_activities")).rows.length,
      1,
    );
    await assert.rejects(
      rpc("request_club_membership", [club]),
      /Už si členom/,
    );
    await assert.rejects(
      rpc("invite_friend_to_club", [club, other]),
      /zakladateľ alebo tréner/,
    );
    await as(owner);
    await assert.rejects(
      rpc("invite_friend_to_club", [club, player]),
      /už je členom/,
    );
    await assert.rejects(
      rpc("invite_friend_to_club", [club, other]),
      /prijatého priateľa/,
    );
    // A friend of a player can request admission; approval still belongs to club management.
    await friends(player, other);
    await as(other);
    const req2 = await rpc("request_club_membership", [club]);
    await as(player);
    await assert.rejects(
      rpc("respond_club_connection", [req2, "accept"]),
      /nemôžeš vybaviť/,
    );
    await as(owner);
    await rpc("respond_club_connection", [req2, "cancel"]);
    await as(other);
    await rpc("request_club_membership", [club]);
    await rpc("respond_club_connection", [req2, "cancel"]);
    // Coaches can invite accepted friends, but never self-assign roles.
    await as(coach);
    await rpc("join_club", [code]);
    await as(owner);
    await rpc("manage_club_member", [club, coach, "coach"]);
    await friends(coach, other);
    await as(coach);
    const invitation = await rpc("invite_friend_to_club", [club, other]);
    assert.equal(await rpc("invite_friend_to_club", [club, other]), invitation);
    await assert.rejects(
      rpc("respond_club_connection", [invitation, "accept"]),
      /nemôžeš vybaviť/,
    );
    await as(player);
    assert.equal(
      (
        await db.query("select * from club_connections where id=$1", [
          invitation,
        ])
      ).rows.length,
      0,
    );
    await assert.rejects(
      rpc("respond_club_connection", [invitation, "accept"]),
      /nemôžeš vybaviť/,
    );
    await as(other);
    let action = (await rpc("get_club_connections")).actions.find(
      (a) => a.id === invitation,
    );
    assert.equal(action.can_respond, true);
    assert.equal(action.actor_name, "coach");
    await rpc("respond_club_connection", [invitation, "decline"]);
    await as(coach);
    await rpc("invite_friend_to_club", [club, other]);
    await as(owner);
    await rpc("manage_club_member", [club, coach, "player"]);
    await as(other);
    await assert.rejects(
      rpc("respond_club_connection", [invitation, "accept"]),
      /už neplatí/,
    );
    await as(owner);
    await friends(owner, other);
    await as(owner);
    await rpc("invite_friend_to_club", [club, other]);
    await as(other);
    await rpc("request_club_membership", [club]);
    await rpc("respond_club_connection", [invitation, "accept"]);
    await rpc("respond_club_connection", [invitation, "accept"]);
    assert.equal(
      (await db.query("select * from club_members where user_id=$1", [other]))
        .rows.length,
      1,
    );
    assert.ok(
      (await rpc("get_club_connections")).actions
        .filter((a) => a.player_id === other)
        .every((a) => a.status === "accepted"),
    );
    // Accepted historical invitation cannot restore a subsequently removed membership.
    await as(owner);
    await rpc("manage_club_member", [club, other, "remove"]);
    await as(other);
    await assert.rejects(
      rpc("respond_club_connection", [invitation, "accept"]),
      /už bola vybavená/,
    );
    // Joining by a code resolves a pending request without leaving an actionable duplicate.
    await rpc("request_club_membership", [club]);
    await rpc("join_club", [code]);
    assert.ok(
      (await rpc("get_club_connections")).actions
        .filter((a) => a.player_id === other)
        .every((a) => a.status === "accepted"),
    );
    // Friendship removal hides club membership discovery and invalidates unaccepted invitations.
    await as(owner);
    const club2 = await rpc("create_club", ["Second"]);
    const inv2 = await rpc("invite_friend_to_club", [club2, player]);
    await rpc("remove_friend", [friendship]);
    await as(player);
    assert.ok(
      !(await rpc("get_club_connections")).memberships.some(
        (m) => m.club_id === club2,
      ),
    );
    await assert.rejects(
      rpc("respond_club_connection", [inv2, "accept"]),
      /už neplatí/,
    );
    await as(null, "anon");
    await assert.rejects(rpc("get_club_connections"), /permission denied/);
    await assert.rejects(
      rpc("request_club_membership", [club]),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
