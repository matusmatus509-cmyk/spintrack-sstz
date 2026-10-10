import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const eve = "33333333-3333-4333-8333-333333333333";
const migration = await fs.readFile(
  new URL("../supabase/migrations/202610100001_community.sql", import.meta.url),
  "utf8",
);

test("community permissions, friendships, private notes and accepted calendar invitations", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth, public to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;`);
    await db.exec(migration);
    for (const [id, name, handle] of [
      [alice, "Alice", "alice"],
      [bob, "Bob", "bob"],
      [eve, "Eve", "eve"],
    ]) {
      await db.query("insert into auth.users values ($1, $2)", [
        id,
        { display_name: name, handle },
      ]);
    }
    const as = async (id, role = "authenticated") => {
      await db.exec(`reset role; set role ${role};`);
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
        id || "",
      ]);
    };
    const rpc = async (
      name,
      values,
      placeholders = values.map((_, i) => `$${i + 1}`).join(","),
    ) =>
      (
        await db.query(
          `select public.${name}(${placeholders}) as value`,
          values,
        )
      ).rows[0].value;
    const visible = async () =>
      (
        await db.query(
          "select local_id from public.shared_activities order by local_id",
        )
      ).rows.map((r) => r.local_id);
    const payload = {
      category: "tréning",
      date: "2026-10-20",
      startTime: "18:30",
      durationMinutes: 90,
      location: "Hala",
      publicNote: "Spoločný tréning",
      privateNote: "Never publish this",
      photos: ["secret photo"],
      racketId: "secret-racket",
    };
    await as(alice);
    assert.deepEqual(
      (
        await db.query("select id from public.search_players($1)", ["@bob"])
      ).rows.map((r) => r.id),
      [bob],
    );
    await db.query(
      "insert into public.user_data(owner_id,data) values ($1,$2)",
      [alice, { privateNote: "backup secret" }],
    );
    await assert.rejects(
      rpc("publish_activity", [
        "malformed",
        { ...payload, title: { bad: "object" } },
        "community",
        [],
      ]),
      /Neplatný text/,
    );
    await assert.rejects(
      rpc("publish_activity", [
        "malformed",
        { ...payload, focusDrills: [123] },
        "community",
        [],
      ]),
      /Neplatná náplň/,
    );
    const privateId = await rpc("publish_activity", [
      "private",
      payload,
      "private",
      [],
    ]);
    const publicId = await rpc("publish_activity", [
      "public",
      payload,
      "community",
      [],
    ]);
    const friendId = await rpc("publish_activity", [
      "friends",
      payload,
      "friends",
      [],
    ]);
    const shared = (
      await db.query(
        "select payload from public.shared_activities where id=$1",
        [publicId],
      )
    ).rows[0].payload;
    assert.equal(shared.publicNote, payload.publicNote);
    assert.ok(!("privateNote" in shared));
    assert.ok(!("photos" in shared));
    assert.ok(!("racketId" in shared));
    await as(bob);
    assert.deepEqual(await visible(), ["public"]);
    assert.equal(
      (await db.query("select * from public.user_data")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("insert into public.user_data(owner_id,data) values ($1,$2)", [
        alice,
        {},
      ]),
      /row-level security/,
    );
    await assert.rejects(
      db.query(
        "update public.shared_activities set visibility='community' where id=$1",
        [privateId],
      ),
      /permission denied/,
    );
    await assert.rejects(
      rpc("change_activity_visibility", [privateId, "community"]),
      /nie je dostupná/,
    );
    await assert.rejects(
      rpc("publish_activity", [
        "invite-nonfriend",
        payload,
        "friends",
        [alice],
      ]),
      /prijatých priateľov/,
    );
    await as(alice);
    const request = await rpc("request_friend", [bob]);
    assert.equal(
      await rpc("request_friend", [bob]),
      request,
      "duplicate requests are idempotent",
    );
    await assert.rejects(
      rpc("respond_friend", [request, true]),
      /nie je dostupná/,
      "sender cannot accept",
    );
    await as(eve);
    assert.equal(
      (await db.query("select * from public.friend_requests")).rows.length,
      0,
    );
    await assert.rejects(
      rpc("respond_friend", [request, true]),
      /nie je dostupná/,
    );
    await as(bob);
    assert.deepEqual(
      await visible(),
      ["public"],
      "pending requests grant no access",
    );
    await rpc("respond_friend", [request, true]);
    assert.deepEqual(await visible(), ["friends", "public"]);
    await as(alice);
    await assert.rejects(
      rpc("publish_activity", ["bad-private", payload, "private", [bob]]),
      /Súkromná/,
    );
    assert.equal(
      await rpc("publish_activity", [
        "friends",
        payload,
        "friends",
        [bob, bob],
      ]),
      friendId,
    );
    const invitation = (
      await db.query(
        "select id from public.activity_invitations where activity_id=$1",
        [friendId],
      )
    ).rows[0].id;
    await as(eve);
    assert.equal(
      (await db.query("select * from public.activity_invitations")).rows.length,
      0,
    );
    await assert.rejects(
      rpc("accept_activity_invitation", [invitation]),
      /nie je dostupná/,
    );
    await as(bob);
    assert.equal(
      (await db.query("select * from public.calendar_entries")).rows.length,
      0,
      "no calendar record without consent",
    );
    const calendarId = await rpc("accept_activity_invitation", [invitation]);
    assert.equal(
      await rpc("accept_activity_invitation", [invitation]),
      calendarId,
      "repeat acceptance cannot duplicate",
    );
    const entry = (await db.query("select * from public.calendar_entries"))
      .rows[0];
    assert.equal(entry.data.startTime, "18:30");
    assert.equal(entry.data.authorName, "Alice");
    assert.ok(!("privateNote" in entry.data));
    await as(eve);
    assert.equal(
      (await db.query("select * from public.calendar_entries")).rows.length,
      0,
    );
    await as(alice);
    await rpc("change_activity_visibility", [friendId, "private"]);
    await as(bob);
    assert.deepEqual(
      await visible(),
      ["public"],
      "making private immediately revokes read access",
    );
    assert.equal(
      (await db.query("select * from public.activity_invitations")).rows.length,
      0,
    );
    await assert.rejects(
      rpc("accept_activity_invitation", [invitation]),
      /nie je dostupná/,
    );
    assert.equal(
      (await db.query("select * from public.calendar_entries")).rows.length,
      1,
      "accepted snapshot belongs to recipient",
    );
    await as(alice);
    await rpc('publish_activity', ['revoke-invite', payload, 'friends', [bob]]);
    await rpc("remove_friend", [request]);
    await as(bob);
    assert.equal((await db.query('select * from public.activity_invitations')).rows.length, 0, 'removing a friend revokes old invitations');
    assert.ok(!(await visible()).includes('revoke-invite'));
    await as(alice);
    const uninvited = await rpc("publish_activity", [
      "uninvited",
      payload,
      "friends",
      [],
    ]);
    await as(bob);
    assert.deepEqual(
      await visible(),
      ["public"],
      "removed friendships cannot read uninvited friends-only data",
    );
    await as(null, "anon");
    assert.deepEqual(await visible(), ["public"]);
    await assert.rejects(rpc("request_friend", [alice]), /permission denied/);
    await as(alice);
    await rpc("unshare_activity", [publicId]);
    assert.ok(!(await visible()).includes("public"));
    assert.ok(uninvited);
    await as(bob);
    await rpc("unshare_local_activity", ["uninvited"]);
    await as(alice);
    assert.ok(
      (await visible()).includes("uninvited"),
      "another owner cannot remove a local ID",
    );
    await rpc("unshare_local_activity", ["uninvited"]);
    assert.ok(!(await visible()).includes("uninvited"));
    await rpc("unshare_all_activities", []);
    assert.deepEqual(
      await visible(),
      [],
      "reset removes all own shared activity rows",
    );
  } finally {
    await db.close();
  }
});
