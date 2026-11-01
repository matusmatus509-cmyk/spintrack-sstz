export interface RefreshAttempt { next: number; failures: number; limited?: boolean }
export function refreshSuccess(now: number): RefreshAttempt {
  return { next: now + 15 * 60000, failures: 0 };
}
export function refreshFailure(previous: RefreshAttempt | undefined, message: string, now: number): RefreshAttempt {
  const failures = Math.min(8, (previous?.failures || 0) + 1);
  const limited = /429|priveľa|prilis vela|too many/i.test(message);
  const minimum = limited ? 30 * 60000 : 15 * 60000;
  return { next: now + Math.min(6 * 3600000, minimum * 2 ** (failures - 1)), failures, limited };
}
