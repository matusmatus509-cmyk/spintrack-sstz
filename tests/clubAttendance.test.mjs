import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const coach = "11111111-1111-4111-8111-111111111111",
  player = "22222222-2222-4222-8222-222222222222",
  outsider = "33333333-3333-4333-8333-333333333333";

test("club attendance restricts access, deadlines and coach confirmation independently of RSVP", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth,public to anon,authenticated;
   grant execute on function auth.uid() to anon,authenticated;`);
    for (const file of [
      "202610100001_community.sql",
      "202610180001_club_attendance.sql",
    ])
      await db.exec(
        await fs.readFile(
          new URL("../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    for (const [id, name] of [
      [coach, "Coach"],
      [player, "Player"],
      [outsider, "Outsider"],
    ])
      await db.query("insert into auth.users values($1,$2)", [
        id,
        { display_name: name, handle: name.toLowerCase() },
      ]);
    const as = async (id) => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      await db.exec("set role authenticated");
    };
    await as(coach);
    await db.query("select public.request_friend($1)", [player]);
    await as(player);
    const request = (await db.query("select id from friend_requests")).rows[0]
      .id;
    await db.query("select public.respond_friend($1,true)", [request]);
    await as(coach);
    const args = [
      "Spoločný tréning",
      "Herňa",
      "18:00",
      90,
      ["Príjem"],
      [player],
    ];
    const training = (
      await db.query(
        `select public.create_club_training($1,$2,current_date+2,$3,$4,$5,now()+interval '1 day',$6) as id`,
        args,
      )
    ).rows[0].id;
    await assert.rejects(
      db.query(
        `select public.create_club_training($1,$2,current_date+2,$3,$4,$5,now()+interval '1 day',$6)`,
        [...args.slice(0, 5), [outsider]],
      ),
      /friends/,
    );
    await assert.rejects(
      db.query(
        "insert into club_training_members(training_id,player_id) values($1,$2)",
        [training, outsider],
      ),
      /permission denied/,
    );
    await as(outsider);
    assert.equal(
      (await db.query("select * from club_trainings")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from club_training_members")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.respond_club_training($1,$2)", [training, "yes"]),
      /Invitation required/,
    );
    await as(player);
    assert.equal(
      (await db.query("select * from club_trainings")).rows.length,
      1,
    );
    await db.query("select public.respond_club_training($1,$2)", [
      training,
      "yes",
    ]);
    await db.query("select public.respond_club_training($1,$2)", [
      training,
      "unsure",
    ]);
    assert.equal(
      (await db.query("select response from club_training_members")).rows[0]
        .response,
      "unsure",
    );
    await assert.rejects(
      db.query("select public.confirm_club_attendance($1,$2,true)", [
        training,
        player,
      ]),
      /Only the coach/,
    );
    await as(coach);
    await assert.rejects(
      db.query("select public.confirm_club_attendance($1,$2,true)", [
        training,
        player,
      ]),
      /not finished/,
    );
    await db.exec("reset role");
    await db.query(
      "update club_trainings set training_date=current_date-1,response_deadline=now()-interval '1 day' where id=$1",
      [training],
    );
    await as(player);
    await assert.rejects(
      db.query("select public.respond_club_training($1,$2)", [training, "no"]),
      /deadline passed/,
    );
    await as(coach);
    await db.query("select public.confirm_club_attendance($1,$2,true)", [
      training,
      player,
    ]);
    await as(player);
    assert.equal(
      (await db.query("select attended from club_training_members")).rows[0]
        .attended,
      true,
    );
    await assert.rejects(
      db.query("update club_training_members set attended=false"),
      /permission denied/,
    );
    await as(outsider);
    await assert.rejects(
      db.query("select public.confirm_club_attendance($1,$2,false)", [
        training,
        player,
      ]),
      /Only the coach/,
    );
    await db.exec("reset role; set role anon");
    await assert.rejects(
      db.query("select * from club_trainings"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
