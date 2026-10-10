// These are owner-scoped record IDs, not authentication tokens. getRandomValues
// also works on the HTTP LAN addresses used by the mobile development server.
export function newActivityId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return `act-${Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')}`;
  }
  return `act-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
