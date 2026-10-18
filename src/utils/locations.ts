export const locationKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("sk");

// The first occurrence wins, so newly used places can be moved to the front.
export function mergeLocationHistory(...groups: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const value of group) {
      if (typeof value !== "string") continue;
      const label = value.trim().replace(/\s+/g, " ").slice(0, 200);
      const key = locationKey(label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(label);
    }
  }
  return result;
}
