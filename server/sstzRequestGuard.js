// Shared per-process protection. Serverless instances still need the client cooldown.
export function createSstzGuard({ now = Date.now, request = (...args) => fetch(...args) } = {}) {
  const blocked = new Map();
  const cache = new Map();
  const pending = new Map();
  return {
    async fetch(url, options) {
      const origin = new URL(url).origin;
      if ((blocked.get(origin) || 0) > now()) {
        const error = new Error('SSTZ HTTP 429: zdroj dočasne obmedzil požiadavky. Ďalšiu obnovu skúsime neskôr.');
        error.status = 429;
        throw error;
      }
      const response = await request(url, options);
      if (response.status === 429) {
        const retry = response.headers.get('retry-after');
        const delay = /^\d+$/.test(retry || '') ? Number(retry) * 1000 : Date.parse(retry || '') - now();
        blocked.set(origin, now() + Math.max(30 * 60000, Number.isFinite(delay) ? delay : 0));
      }
      return response;
    },
    async load(key, load) {
      const saved = cache.get(key);
      if (saved && saved.until > now()) return saved.data;
      if (pending.has(key)) return pending.get(key);
      const promise = Promise.resolve().then(load).then(data => {
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(key, { data, until: now() + 15 * 60000 });
        return data;
      }).finally(() => pending.delete(key));
      pending.set(key, promise);
      return promise;
    },
  };
}
export const sstzGuard = createSstzGuard();
