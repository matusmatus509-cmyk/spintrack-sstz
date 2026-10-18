import type { MatchRecord } from "../types";

const nameKey = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
export function matchDay(value: string) {
  const iso = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const parts = value.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  return parts
    ? `${parts[3]}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`
    : "";
}
export function mergeCandidates(
  matches: MatchRecord[],
  ignored: string[] = [],
) {
  const official = matches.filter(
    (m) => m.source === "SSTZ" || m.source === "SSTZ_TOURNAMENT",
  );
  return matches
    .filter((m) => !m.source || m.source === "manual")
    .flatMap((manual) =>
      official
        .filter(
          (imported) =>
            matchDay(manual.date) &&
            matchDay(manual.date) === matchDay(imported.date) &&
            nameKey(manual.opponentName) === nameKey(imported.opponentName) &&
            !ignored.includes(`${manual.id}|${imported.id}`),
        )
        .map((imported) => ({ manual, imported })),
    );
}
export function mergeMatchNotes(
  manual: MatchRecord,
  imported: MatchRecord,
): MatchRecord {
  const join = (a?: string, b?: string) =>
    [...new Set([a?.trim(), b?.trim()].filter(Boolean))].join("\n\n");
  return {
    ...imported,
    notes: join(manual.notes, imported.notes),
    tacticsNote: join(manual.tacticsNote, imported.tacticsNote),
    racketId: manual.racketId || imported.racketId,
    sourceActivityId: manual.sourceActivityId || imported.sourceActivityId,
  };
}
