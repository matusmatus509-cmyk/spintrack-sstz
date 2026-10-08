# SSTZ tournaments — work in progress

The mobile tournament screen, client import validation, persistence and backup,
repeat-import merging, diary filtering and opponent history are implemented.
Tournament data uses `SSTZ_TOURNAMENT`; existing league sync only replaces `SSTZ`
records. Tournament player IDs belong to sstz.sk and must not be substituted with
stolnytenis.info player IDs.

**The feature is not ready to merge or use for live imports.** The backend search
and import endpoints have not been implemented. This environment's outbound proxy
returned `403 CONNECT tunnel failed` for the supplied source:
https://www.sstz.sk/hraci/18534/turnaje. A network configuration draft was saved
with sstz.sk, www.sstz.sk, stolnytenis.info and www.stolnytenis.info. Saving a draft
does not apply it to the running environment; the user needs to save the settings.

## Remaining work after network access is available

1. Inspect the real SSTZ player search, tournament archive, season and pagination
   controls, and each event's match protocols. Capture sanitized real HTML fixtures.
2. Implement `GET /api/sstz/tournaments/search?q=…` returning
   `{ players: [{ id, name, clubName? }] }` with the actual tournament-site IDs.
3. Implement `GET /api/sstz/tournaments/player/:id` returning
   `{ id, name, clubName?, complete: true, matches, doublesMatches }` only after
   every available archive page/event/protocol has been loaded and validated.
   Propagate failures without claiming completeness or returning partial imports.
4. Normalize each duel from the actual protocol into stable IDs, ISO dates,
   tournamentName, season/category/round when published, opponentName (singles)
   or partnerName/opponentPair (doubles), result, score, sets and optional exact
   setDetails/point totals. Never invent absent scores or points. Preserve walkovers.
5. Verify real imports for player 18534 and other players, empty archives,
   multi-season history, pagination, doubles, repeated imports and upstream failure.
6. Complete the backend tests, rerun the build/type check and mobile browser flows,
   and mark the feature ready only after the live integration works.

## Validation completed so far

TypeScript check, production build and 20 Node tests pass. The three new import
contract tests use **synthetic** data. Browser flows with a **mock API** validate
UI and local state; they do not validate live SSTZ search, parsing or completeness.
The UI handles unavailable/non-JSON API responses without replacing saved data.
