export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.floor(totalMinutes || 0));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) return `${remainder}min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}min`;
}
