import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCommunity } from '../scripts/check-community.mjs';

const env = { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
const auth = { external: { email: true }, disable_signup: false, mailer_autoconfirm: false };
const healthy = (url) => url.pathname === '/auth/v1/settings' ? response(auth)
  : /\/(profiles|shared_activities)$/.test(url.pathname) ? response([])
  : response({ code: '42501' }, 401);

test('deployment check is read-only and fetches no player records', async () => {
  const calls = [];
  const result = await checkCommunity(env, async (url, options) => {
    calls.push(url);
    assert.equal(options.method, undefined);
    assert.equal(options.redirect, 'error');
    if (url.pathname.startsWith('/rest/')) assert.equal(url.searchParams.get('limit'), '0');
    return healthy(url);
  });
  assert.equal(calls.length, 7);
  assert.match(result.at(-1), /SMTP delivery/);
});

test('rejects private keys and unsafe URLs before making requests', async () => {
  const never = () => assert.fail('Must not send a request');
  const serviceRole = `a.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.c`;
  for (const key of ['sb_secret_test', serviceRole]) {
    await assert.rejects(checkCommunity({ ...env, VITE_SUPABASE_PUBLISHABLE_KEY: key }, never), /Only a publishable/);
  }
  await assert.rejects(checkCommunity({ ...env, VITE_SUPABASE_URL: 'https://user:pass@example.com' }, never), /project origin/);
});

test('does not pass when private table grants drift', async () => {
  await assert.rejects(checkCommunity(env, (url) => url.pathname.endsWith('/user_data') ? response([]) : healthy(url)), /Anonymous access to user_data/);
});

test('does not pass when a migration table is missing', async () => {
  await assert.rejects(checkCommunity(env, (url) => url.pathname.endsWith('/shared_activities') ? response({ code: 'PGRST205' }, 404) : healthy(url)), /shared_activities/);
});

test('does not pass when email confirmation is disabled', async () => {
  await assert.rejects(checkCommunity(env, (url) => url.pathname === '/auth/v1/settings' ? response({ ...auth, mailer_autoconfirm: true }) : healthy(url)), /confirmation must remain enabled/);
});
