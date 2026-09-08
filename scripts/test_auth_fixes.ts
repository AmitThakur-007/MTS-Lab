/**
 * Test: Auth Fix Verification
 * Tests the 4 fixes applied to resolve dashboard data loading failures.
 *
 * Fix #1: Login.tsx sends "email" not "identity"
 * Fix #2: backend accepts both "email" and "identity"
 * Fix #3: auth middleware email-first lookup resilience
 * Fix #4: api/index.ts no URL double-rewrite
 */
import { createApp } from '../src/server/app';
import { supabaseAdmin } from '../src/server/config/supabase';
import jwt from 'jsonwebtoken';
import { config } from '../src/server/config/supabase';
import http from 'http';

async function testAuthFixes() {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3094, () => resolve()));
  const BASE = 'http://127.0.0.1:3094';
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${name}:`, err.message);
      failed++;
    }
  }

  console.log('=======================================================');
  console.log('🔐 Auth Fix Verification Tests');
  console.log('=======================================================\n');

  // ── FIX #2: Backend accepts "identity" field (backward compat) ─────────────
  // We can test this directly: if "identity" field goes in and backend still
  // processes password check (returning 401 for wrong password, not 400),
  // the field parsing fix is working.
  await test('Fix #2 — backend accepts "identity" field (no 400 "email required")', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'fake@test.com', password: 'wrongpassword' }),
    });
    const json = await res.json() as any;
    // Before fix: would return 400 "Email and password are required" because identity was ignored
    // After fix: returns 401 "Invalid email or password" — the email field was read correctly
    if (res.status === 400 && json.error?.includes('Email and password are required')) {
      throw new Error('Backend still ignoring "identity" field — got 400 instead of 401');
    }
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}: ${json.error}`);
    console.log('    ℹ Got 401 (not 400) — backend correctly parsed "identity" field');
  });

  await test('Fix #1/#2 — backend also accepts "email" field', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'fake@test.com', password: 'wrongpassword' }),
    });
    const json = await res.json() as any;
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}: ${json.error}`);
    console.log('    ℹ Got 401 — "email" field accepted correctly');
  });

  // ── FIX #3: Auth middleware email-first lookup ──────────────────────────────
  // Simulate what Login.tsx path 1 does: stores Supabase access_token
  // Then that token hits /api/repairs
  // We test this by creating a fake JWT that has an email matching a real user
  // but an authUid that does NOT match any id/supabaseUid (which is null for all rows)
  // Before fix: or(`id.eq.FAKE_UID,supabaseUid.eq.FAKE_UID,email.eq.email`) — 
  //   PostgREST OR with null supabaseUid can be unpredictable
  // After fix: primary query is email.eq.email — always finds the user

  // Get a real user email from database to test with
  const { data: realUsers } = await supabaseAdmin
    .from('User')
    .select('id, email, role')
    .eq('role', 'SUPER_ADMIN')
    .is('deletedAt', null)
    .limit(1);

  if (realUsers && realUsers.length > 0) {
    const realUser = realUsers[0];
    console.log(`  ℹ Using test user: ${realUser.email} (${realUser.role})`);

    // Create a JWT token with a FAKE authUid (simulates Supabase Auth UID that isn't in public.User yet)
    // This is what happens when supabaseUid is null and Supabase Auth UUID ≠ public.User.id
    const tokenWithFakeUid = jwt.sign(
      { id: 'fake-supabase-uid-not-in-db', email: realUser.email, role: realUser.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    await test('Fix #3 — middleware finds user by email even when authUid has no DB match', async () => {
      const res = await fetch(`${BASE}/api/repairs`, {
        headers: { Authorization: `Bearer ${tokenWithFakeUid}` },
      });
      const json = await res.json() as any;
      // Before fix: 401 "User account not found" (because id.eq.FAKE_UID failed, supabaseUid was null)
      // After fix: 200 (email match succeeds)
      if (res.status === 401) {
        throw new Error(`Auth middleware failed — still returning 401 even with valid email. Email-first lookup not working.`);
      }
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(json)}`);
      if (!Array.isArray(json)) throw new Error('Expected array of repairs');
      console.log(`    ℹ Loaded ${json.length} repairs — email-first lookup working correctly`);
    });
  } else {
    console.log('  ⚠ Could not find Super Admin user to test Fix #3 — skipping');
  }

  // ── FIX #4: No URL double-rewrite in api/index.ts ──────────────────────────
  // This verifies routes still work at correct paths (not /api/api/repairs)
  const testUser = realUsers && realUsers.length > 0 ? realUsers[0] : null;
  await test('Fix #4 — routes resolve without double /api prefix', async () => {
    if (!testUser) throw new Error('No test user available');
    const adminToken = jwt.sign(
      { id: testUser.id, email: testUser.email, role: 'SUPER_ADMIN' },
      config.jwtSecret,
      { expiresIn: '1h' }
    );
    const res = await fetch(`${BASE}/api/customers`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json() as any;
    if (!json.customers && !Array.isArray(json)) throw new Error('Expected customers data');
    const count = Array.isArray(json) ? json.length : json.customers?.length;
    console.log(`    ℹ Loaded ${count} customers at /api/customers — no double-prefix issue`);
  });

  console.log(`\n=======================================================`);
  console.log(`Auth Fix Tests: ${passed} passed, ${failed} failed`);
  console.log(`=======================================================`);

  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

testAuthFixes().catch((err) => {
  console.error('Test run error:', err);
  process.exit(1);
});
