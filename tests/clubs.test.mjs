import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { sharedImportData, sharedImportId } from "../src/utils/sharedImport.ts";
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222",
  eve = "33333333-3333-4333-8333-333333333333";
const payload = {
  category: "tréning",
  date: "2026-02-10",
  startTime: "18:00",
  durationMinutes: 90,
  location: "Hala",
  focusDrills: ["FH"],
  publicNote: "Náplň",
  privateNote: "secret",
  photos: ["secret"],
  racketId: "secret",
};

test("shared import preserves occurrence and never publishes, completes or copies private data/results", () => {
  const imported = sharedImportData({
    ...payload,
    category: "liga",
    opponentName: "Someone",
    matchResult: "WIN",
    matchScore: "3:0",
    placing: "1",
  });
  assert.equal(imported.date, "2026-02-10");
  assert.equal(imported.startTime, "18:00");
  assert.equal(imported.planned, true);
  assert.equal(imported.visibility, "private");
  assert.equal(imported.addEquipmentWear, false);
  for (const key of [
    "privateNote",
    "photos",
    "racketId",
    "matchResult",
    "matchScore",
    "opponentName",
    "placing",
  ])
    assert.equal(imported[key], undefined);
  assert.equal(sharedImportId("club", "abc"), sharedImportId("club", "abc"));
  assert.notEqual(
    sharedImportId("club", "abc"),
    sharedImportId("community", "abc"),
  );
});

test("clubs isolate members, protect roles and schedules, allow coach feedback and idempotent shares", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;`);
    const dir = new URL("../supabase/migrations/", import.meta.url);
    for (const file of (await fs.readdir(dir))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(await fs.readFile(new URL(file, dir), "utf8"));
    for (const [id, handle] of [
      [alice, "alice"],
      [bob, "bob"],
      [eve, "eve"],
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
    const count = async (table) =>
      (await db.query(`select * from public.${table}`)).rows.length;
    await as(alice);
    const club = await rpc("create_club", ["Test klub"]);
    const code = (await db.query("select code from club_invite_codes")).rows[0]
      .code;
    const scheduled = await rpc("publish_club_activity", [
      club,
      "schedule",
      payload,
      true,
      [alice],
    ]);
    assert.equal(
      (await db.query("select activity_date::text from club_activities"))
        .rows[0].activity_date,
      "2026-02-10",
    );
    const clean = (await db.query("select payload from club_activities"))
      .rows[0].payload;
    assert.equal(clean.publicNote, "Náplň");
    assert.equal(clean.privateNote, undefined);
    assert.equal(clean.photos, undefined);
    assert.equal(clean.racketId, undefined);
    await as(eve);
    for (const table of [
      "clubs",
      "club_members",
      "club_activities",
      "club_invite_codes",
      "club_notes",
    ])
      assert.equal(await count(table), 0, table);
    await assert.rejects(
      rpc("publish_club_activity", [club, "attack", payload, false, []]),
      /pridaj/,
    );
    await assert.rejects(rpc("join_club", ["bad"]), /Neplatný/);
    await assert.rejects(
      rpc("manage_club_member", [club, eve, "coach"]),
      /zakladateľ/,
    );
    await assert.rejects(
      db.query("insert into club_notes(activity_id,body) values($1,$2)", [
        scheduled,
        "attack",
      ]),
      /row-level security/,
    );
    await as(bob);
    assert.equal(await rpc("join_club", [code]), club);
    await rpc("join_club", [code]);
    assert.equal(await count("club_members"), 2);
    assert.equal(await count("club_invite_codes"), 0);
    await assert.rejects(
      rpc("manage_club_member", [club, bob, "coach"]),
      /zakladateľ/,
    );
    await assert.rejects(
      db.query("update club_members set role='coach' where user_id=$1", [bob]),
      /permission denied/,
    );
    await assert.rejects(
      rpc("publish_club_activity", [club, "bad", payload, true, []]),
      /iba tréner/,
    );
    await assert.rejects(
      rpc("publish_club_activity", [club, "bad", payload, false, [eve]]),
      /iba členov/,
    );
    const playerPost = await rpc("publish_club_activity", [
      club,
      "diary-1",
      payload,
      false,
      [alice],
    ]);
    assert.equal(
      await rpc("publish_club_activity", [
        club,
        "diary-1",
        { ...payload, publicNote: "Updated" },
        false,
        [alice],
      ]),
      playerPost,
    );
    assert.equal(await count("club_activities"), 2);
    await assert.rejects(
      db.query("insert into club_notes(activity_id,body) values($1,$2)", [
        playerPost,
        "not coach",
      ]),
      /row-level security/,
    );
    await assert.rejects(
      rpc("delete_club_activity", [scheduled]),
      /nie je dostupná/,
    );
    await as(alice);
    await db.query("insert into club_notes(activity_id,body) values($1,$2)", [
      playerPost,
      "Výborný tréning, pracuj na príjme.",
    ]);
    await assert.rejects(
      rpc("manage_club_member", [club, alice, "player"]),
      /Zakladateľ/,
    );
    await rpc("manage_club_member", [club, bob, "coach"]);
    await as(bob);
    assert.equal(await count("club_notes"), 1);
    await db.query("insert into club_notes(activity_id,body) values($1,$2)", [
      playerPost,
      "Coach reply",
    ]);
    await rpc("publish_club_activity", [club, "coach-plan", payload, true, []]);
    await assert.rejects(
      db.query(
        "insert into club_notes(activity_id,body,author_id) values($1,$2,$3)",
        [playerPost, "fake", alice],
      ),
      /permission denied/,
    );
    await as(eve);
    assert.equal(await count("club_notes"), 0);
    const other = await rpc("create_club", ["Other club"]);
    await assert.rejects(
      db.query("insert into club_notes(activity_id,body) values($1,$2)", [
        playerPost,
        "Other club coach",
      ]),
      /row-level security/,
    );
    await as(alice);
    await rpc("rotate_club_code", [club]);
    await as(eve);
    await assert.rejects(rpc("join_club", [code]), /Neplatný/);
    await as(alice);
    await rpc("manage_club_member", [club, bob, "player"]);
    await as(bob);
    await assert.rejects(
      db.query("insert into club_notes(activity_id,body) values($1,$2)", [
        playerPost,
        "Demoted",
      ]),
      /row-level security/,
    );
    await rpc("manage_club_member", [club, bob, "remove"]);
    for (const table of [
      "clubs",
      "club_members",
      "club_activities",
      "club_notes",
    ])
      assert.equal(await count(table), 0, "former member: " + table);
    await assert.rejects(
      rpc("delete_club_activity", [playerPost]),
      /nie je dostupná/,
    );
    // Tagging existing community shares adds recipients without replacing old invitations.
    await as(alice);
    const friendship = await rpc("request_friend", [bob]);
    await as(bob);
    await rpc("respond_friend", [friendship, true]);
    await as(alice);
    const share = await rpc("publish_activity", [
      "share",
      payload,
      "friends",
      [],
    ]);
    await rpc("tag_shared_activity", [share, bob]);
    await rpc("tag_shared_activity", [share, bob]);
    assert.equal(await count("activity_invitations"), 1);
    await assert.rejects(
      rpc("tag_shared_activity", [share, eve]),
      /prijatých priateľov/,
    );
    await as(bob);
    await assert.rejects(
      rpc("tag_shared_activity", [share, alice]),
      /nie je dostupná/,
    );
    await as(null, "anon");
    await assert.rejects(rpc("create_club", ["anon"]), /permission denied/);
    await assert.rejects(db.query("select * from clubs"), /permission denied/);
    assert.ok(other);
  } finally {
    await db.close();
  }
});
