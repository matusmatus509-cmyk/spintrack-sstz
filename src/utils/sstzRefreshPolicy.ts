export interface RefreshAttempt { next: number; failures: number; limited?: boolean }
export function refreshSuccess(now: number): RefreshAttempt {
  return { next: now + 5 * 60000, failures: 0 };
}
export function refreshFailure(previous: RefreshAttempt | undefined, message: string, now: number): RefreshAttempt {
  const failures = Math.min(8, (previous?.failures || 0) + 1);
  const limited = /429|priveľa|prilis vela|too many/i.test(message);
  const minimum = limited ? 60000 : 5 * 60000;
  return { next: now + Math.min(15 * 60000, minimum * 2 ** (failures - 1)), failures, limited };
}
