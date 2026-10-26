/** Refresh only while usable; focus/connection changes retry after a short cooldown. */
export function startSstzAutoRefresh(
  refresh: () => void,
  environment: {
    visible: () => boolean;
    online: () => boolean;
    now: () => number;
    every: (callback: () => void, milliseconds: number) => () => void;
    listen: (event: 'focus' | 'online' | 'visibilitychange', callback: () => void) => () => void;
  },
) {
  let last = -Infinity;
  const attempt = () => {
    if (!environment.visible() || !environment.online() || environment.now() - last < 60000) return;
    last = environment.now();
    refresh();
  };
  attempt();
  const cleanups = [
    environment.every(attempt, 5 * 60000),
    ...(['focus', 'online', 'visibilitychange'] as const).map(event => environment.listen(event, attempt)),
  ];
  return () => cleanups.forEach(cleanup => cleanup());
}
