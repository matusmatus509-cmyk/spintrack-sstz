import type { MatchRecord, DoublesMatchRecord, SSTZProfile } from "../types";
/** Replace only explicitly scanned seasons; older seasons and manual/tournament results stay intact. */
export function mergeLeagueRefresh(
  data: any,
  profile: SSTZProfile | null,
  singles: MatchRecord[],
  doubles: DoublesMatchRecord[],
) {
  const seasons = new Set<string>(
    (data.seasonsBreakdown || []).map((s: any) => s.season),
  );
  if (!seasons.size || [...seasons].some((s) => !s))
    throw new Error(
      "SSTZ nepotvrdilo sezónu obnovovaných zápasov. História zostala zachovaná.",
    );
  if (profile && String(data.id) !== profile.id)
    throw new Error("Obnovovaný profil nepatrí pripojenému hráčovi.");
  const oldSingles = singles
    .filter((m) => m.source === "SSTZ" && !seasons.has(m.season || ""))
    .map((m) => ({ ...m, id: m.sstzMatchId || m.id.replace(/^sstz-/, "") }));
  const oldDoubles = doubles.filter(
    (m) => m.source === "SSTZ" && !seasons.has(m.season || ""),
  );
  const merge = (old: any[], fresh: any[]) => [
    ...new Map([...old, ...fresh].map((m) => [String(m.id), m])).values(),
  ];
  const matches = merge(oldSingles, data.matches);
  const doublesMatches = merge(oldDoubles, data.doublesMatches);
  const stats = (rows: any[]) => {
    const won = rows.filter((m) => m.result === "WIN").length;
    return {
      played: rows.length,
      won,
      lost: rows.length - won,
      winRate: rows.length ? Math.round((won / rows.length) * 100) : 0,
    };
  };
  const seasonsBreakdown = [
    ...(data.seasonsBreakdown || []),
    ...(profile?.seasonsBreakdown || []).filter((s) => !seasons.has(s.season)),
  ];
  return {
    ...data,
    matches,
    doublesMatches,
    singlesStats: stats(matches),
    doublesStats: stats(doublesMatches),
    seasonsBreakdown,
    isAllSeasons: profile?.isAllSeasons || false,
    syncedSeasonsCount: seasonsBreakdown.length,
  };
}
