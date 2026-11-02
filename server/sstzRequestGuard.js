// Shared per-process protection. Serverless instances still need the client cooldown.
export function createSstzGuard({
  now = Date.now,
  request = (...args) => fetch(...args),
  spacing = 750,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const blocked = new Map();
  const queues = new Map();
  const lastRequest = new Map();
  const cache = new Map();
  const pending = new Map();
  return {
    async fetch(url, options = {}) {
      const origin = new URL(url).origin;
      const previous = queues.get(origin) || Promise.resolve();
      const operation = previous
        .catch(() => {})
        .then(async () => {
          const delay = Math.max((blocked.get(origin) || 0) - now(), 0);
          if (delay > 5000) {
            const error = new Error(
              "SSTZ HTTP 429: zdroj požaduje prestávku. Obnova sa zopakuje neskôr.",
            );
            error.status = 429;
            throw error;
          }
          const gap = Math.max(
            delay,
            (lastRequest.get(origin) ?? -Infinity) + spacing - now(),
            0,
          );
          if (gap) await sleep(gap);
          options.signal?.throwIfAborted();
          lastRequest.set(origin, now());
          let response = await request(url, options);
          // One bounded retry for transient throttling; never loop on a long Retry-After.
          if (response.status === 429) {
            const retry = response.headers.get("retry-after");
            const rawDelay = /^\d+$/.test(retry || "")
              ? Number(retry) * 1000
              : Date.parse(retry || "") - now();
            const wait = Number.isFinite(rawDelay)
              ? Math.max(1000, rawDelay)
              : 2000;
            blocked.set(origin, now() + wait);
            if (wait <= 5000) {
              await response.body?.cancel();
              await sleep(wait);
              options.signal?.throwIfAborted();
              lastRequest.set(origin, now());
              response = await request(url, options);
              if (response.status === 429) {
                const nextRetry = response.headers.get("retry-after");
                const nextDelay = /^\d+$/.test(nextRetry || "")
                  ? Number(nextRetry) * 1000
                  : Date.parse(nextRetry || "") - now();
                blocked.set(
                  origin,
                  now() +
                    Math.max(60000, Number.isFinite(nextDelay) ? nextDelay : 0),
                );
              } else blocked.delete(origin);
            }
          }
          return response;
        });
      const settled = operation.catch(() => {});
      queues.set(origin, settled);
      try {
        return await operation;
      } finally {
        if (queues.get(origin) === settled) queues.delete(origin);
      }
    },
    async load(key, load) {
      const saved = cache.get(key);
      if (saved && saved.until > now()) return saved.data;
      if (pending.has(key)) return pending.get(key);
      const promise = Promise.resolve()
        .then(load)
        .then((data) => {
          if (cache.size >= 100) cache.delete(cache.keys().next().value);
          cache.set(key, { data, until: now() + 5 * 60000 });
          return data;
        })
        .finally(() => pending.delete(key));
      pending.set(key, promise);
      return promise;
    },
  };
}
export const sstzGuard = createSstzGuard();
