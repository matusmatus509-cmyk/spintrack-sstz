import { parseTournamentImport } from "./tournamentImport.ts";

export interface SstzPlayerChoice {
  name: string;
  registryId?: string;
  leagueId?: string;
  clubName?: string;
  leagueCandidates?: { id: string; name: string }[];
}
export const sstzNameKey = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("sk")
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .sort()
    .join(" ");

// IDs belong to different systems. Pair only a unique full-name match on BOTH
// sides, never an equal numeric ID or the first of several homonyms.
export function pairSstzPlayers(
  registry: { id: string; name: string; clubName?: string }[],
  leagues: { id: string; name: string }[],
): SstzPlayerChoice[] {
  const official = [
    ...new Map(
      registry
        .filter((p) => /^\d+$/.test(p.id) && p.name.trim())
        .map((p) => [p.id, p]),
    ).values(),
  ];
  const league = [
    ...new Map(
      leagues
        .filter((p) => /^\d+$/.test(p.id) && p.name.trim())
        .map((p) => [p.id, p]),
    ).values(),
  ];
  const choices = official.map((p) => {
    const candidates = league.filter(
      (l) => sstzNameKey(l.name) === sstzNameKey(p.name),
    );
    const unique =
      official.filter((r) => sstzNameKey(r.name) === sstzNameKey(p.name))
        .length === 1 && candidates.length === 1;
    return {
      name: p.name,
      registryId: p.id,
      clubName: p.clubName,
      ...(unique
        ? { leagueId: candidates[0].id }
        : candidates.length
          ? { leagueCandidates: candidates }
          : {}),
    };
  });
  return [
    ...choices,
    ...league
      .filter(
        (p) =>
          !official.some((r) => sstzNameKey(r.name) === sstzNameKey(p.name)),
      )
      .map((p) => ({ name: p.name, leagueId: p.id })),
  ];
}

export async function loadSstzAccountImport(
  choice: SstzPlayerChoice,
  read: (url: string) => Promise<any>,
  signal: AbortSignal,
) {
  if (
    !choice.name.trim() ||
    (!choice.registryId && !choice.leagueId) ||
    [choice.registryId, choice.leagueId].some(
      (id) => id !== undefined && !/^\d+$/.test(id),
    )
  )
    throw new Error("Vyber svoj profil z výsledkov vyhľadávania SSTZ.");
  const [league, rawTournaments] = await Promise.all([
    choice.leagueId
      ? read(`/api/sstz/player/${choice.leagueId}?allSeasons=true`)
      : null,
    choice.registryId
      ? read(`/api/sstz/tournaments/player/${choice.registryId}`)
      : null,
  ]);
  signal.throwIfAborted();
  if (
    choice.leagueId &&
    (!league ||
      String(league.id) !== choice.leagueId ||
      !Array.isArray(league.matches) ||
      !Array.isArray(league.doublesMatches) ||
      league.isAllSeasons !== true ||
      typeof league.name !== "string" ||
      sstzNameKey(league.name) !== sstzNameKey(choice.name))
  )
    throw new Error(
      "Ligový profil nie je kompletný alebo nepatrí vybranému hráčovi. Spoločný import sa neuložil.",
    );
  if (league) {
    for (const rows of [league.matches, league.doublesMatches]) {
      const ids = new Set<string>();
      for (const row of rows) {
        if (
          !row ||
          !["string", "number"].includes(typeof row.id) ||
          !String(row.id).trim() ||
          ids.has(String(row.id)) ||
          typeof row.date !== "string" ||
          typeof row.score !== "string" ||
          !row.score.trim() ||
          !["WIN", "LOSS"].includes(row.result) ||
          (row.sets != null &&
            (!Array.isArray(row.sets) ||
              row.sets.some((set: unknown) => typeof set !== "string")))
        )
          throw new Error(
            "Ligová história obsahuje neúplný alebo duplicitný zápas. Spoločný import sa neuložil.",
          );
        ids.add(String(row.id));
      }
    }
    if (
      league.seasonsBreakdown != null &&
      !Array.isArray(league.seasonsBreakdown)
    )
      throw new Error(
        "Ligová história nemá platný prehľad sezón. Spoločný import sa neuložil.",
      );
  }
  const tournaments = choice.registryId
    ? parseTournamentImport(rawTournaments, choice.registryId)
    : null;
  if (
    tournaments &&
    sstzNameKey(tournaments.profile.name) !== sstzNameKey(choice.name)
  )
    throw new Error(
      "Turnajový profil nepatrí vybranému hráčovi. Spoločný import sa neuložil.",
    );
  return { league, tournaments };
}
