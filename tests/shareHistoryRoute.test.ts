import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { config } from '../api/_server/config/supabase.js';

after(() => {
  setTimeout(() => process.exit(0), 100);
});

test('Share History API Endpoints Verification', async (t) => {
  const superAdminToken = jwt.sign(
    {
      id: 'bd2bd9a4-f6a6-4168-871f-7ed8f9731591',
      email: 'amitsharma64017900@gmail.com',
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
    },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  await t.test('1. GET /api/share/history requires authentication', async () => {
    const res = await fetch('http://localhost:3000/api/share/history');
    assert.strictEqual(res.status, 401, 'Unauthenticated request must return 401');
    const json = await res.json();
    assert.strictEqual(json.error, 'Unauthorized');
  });

  await t.test('2. GET /api/share/history returns 200 with data for SUPER_ADMIN', async () => {
    const res = await fetch('http://localhost:3000/api/share/history', {
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });
    assert.strictEqual(res.status, 200, 'Authenticated request must return 200 OK');
    const json = await res.json();
    assert.strictEqual(json.success, true, 'Response must have success: true');
    assert.ok(Array.isArray(json.data), 'Response data must be an array');
  });

  await t.test('3. POST /api/share/applet creates a share record', async () => {
    const payload = {
      appletName: 'Test Shared MTS Suite',
      description: 'End-to-end verification of share history',
      visibility: 'PUBLIC',
    };

    const res = await fetch('http://localhost:3000/api/share/applet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(payload),
    });

    assert.strictEqual(res.status, 201, 'Creation must return 201 Created');
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.shareToken, 'Share token must be generated');
    assert.ok(json.url, 'Share url must be generated');

    // Verify GET /api/share/history now includes this share
    const historyRes = await fetch('http://localhost:3000/api/share/history', {
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });
    const historyJson = await historyRes.json();
    assert.strictEqual(historyRes.status, 200);
    const found = historyJson.data.find((item: any) => item.shareToken === json.shareToken);
    assert.ok(found, 'Created share token must appear in share history');
    assert.strictEqual(found.appletName, 'Test Shared MTS Suite');
  });
});
