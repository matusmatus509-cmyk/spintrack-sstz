import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Read-only: no test users, emails, invitations or database writes.
export async function checkCommunity(env = process.env, request = fetch) {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password ||
      endpoint.pathname !== '/' || endpoint.search || endpoint.hash) {
    throw new Error('Use the HTTPS Supabase project origin.');
  }
  let publicKey = key.startsWith('sb_publishable_');
  if (!publicKey && key.split('.').length === 3) {
    try {
      publicKey = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon';
    } catch { /* invalid legacy key */ }
  }
  if (!publicKey) throw new Error('Only a publishable or legacy anon key is allowed. Never use a secret/service_role key.');

  const get = async (path) => {
    const response = await request(new URL(path, endpoint), {
      headers: { apikey: key },
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    });
    let body;
    try { body = await response.json(); } catch { throw new Error('The Supabase endpoint did not return JSON.'); }
    return { status: response.status, body };
  };

  const auth = await get('/auth/v1/settings');
  if (auth.status !== 200 || auth.body.external?.email !== true || auth.body.disable_signup !== false) {
    throw new Error('Email sign-in and registration must be enabled in Supabase Auth.');
  }
  if (auth.body.mailer_autoconfirm !== false) {
    throw new Error('Email confirmation must remain enabled for public registration.');
  }
  // limit=0 validates table/API access without downloading player records.
  for (const table of ['profiles', 'shared_activities']) {
    const result = await get(`/rest/v1/${table}?select=id&limit=0`);
    if (result.status !== 200 || !Array.isArray(result.body)) {
      throw new Error(`Community table ${table} is not available through the Data API.`);
    }
  }
  for (const table of ['user_data', 'friend_requests', 'activity_invitations', 'calendar_entries']) {
    const result = await get(`/rest/v1/${table}?select=*&limit=0`);
    if (![401, 403].includes(result.status) || result.body.code !== '42501') {
      throw new Error(`Anonymous access to ${table} does not match the migration grants.`);
    }
  }
  return ['Supabase Auth and email confirmation: OK', 'Community Data API tables: OK',
    'Anonymous access to private tables: denied',
    'SMTP delivery and signed-in RLS still require the documented end-to-end checks.'];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (existsSync('.env.local')) process.loadEnvFile('.env.local');
    for (const line of await checkCommunity()) console.log(line);
  } catch (error) {
    // Do not print request bodies, credentials, or unknown network errors.
    console.error(error instanceof TypeError ? 'Community check failed: invalid configuration or network connection.' : error.message);
    process.exitCode = 1;
  }
}
