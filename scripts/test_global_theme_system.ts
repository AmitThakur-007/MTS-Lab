import jwt from 'jsonwebtoken';
import { getSystemThemeConfig, updateSystemThemeConfig, VALID_THEMES } from '../api/_server/services/systemThemeService';

const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key-2026';

function generateTestToken(role: string, name: string = 'Test User', email: string = 'test@mtslab.com') {
  return jwt.sign(
    {
      id: 'test-user-id-' + role.toLowerCase(),
      name,
      email,
      role,
      user_metadata: { role, name },
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runThemeTests() {
  console.log('================================================================');
  console.log('🎨 MTS LAB: GLOBAL 8-THEME SYSTEM & SUPER ADMIN CONTROLLER TEST');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, title: string, details?: string) => {
    if (condition) {
      console.log(`✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${title} - ${details || ''}`);
      failed++;
    }
  };

  const superAdminToken = generateTestToken('SUPER_ADMIN', 'Amit Thakur', 'amitsharma64017900@gmail.com');
  const receptionistToken = generateTestToken('RECEPTIONIST', 'Pramila Shrestha', 'pramilashrestha597@gmail.com');
  const managerToken = generateTestToken('MANAGER', 'Aashish singh', 'aashishshing58@gmail.com');

  try {
    // 1. Public API Endpoint Test
    console.log('\n--- 1. Testing Public System Theme API ---');
    const publicRes = await fetch(`${BASE_URL}/api/public/system-theme`);
    assert(publicRes.status === 200, 'Public GET /api/public/system-theme returns 200 OK');
    const publicData: any = await publicRes.json();
    assert(typeof publicData === 'object' && publicData.effectiveTheme !== undefined, 'Returns valid theme config object', JSON.stringify(publicData));
    assert(VALID_THEMES.includes(publicData.effectiveTheme), `Effective theme '${publicData.effectiveTheme}' is one of 8 valid themes`);

    // 2. Authorization Guard Tests
    console.log('\n--- 2. Testing Super Admin Authorization Guards ---');
    // Unauthenticated
    const unauthRes = await fetch(`${BASE_URL}/api/admin/system-theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeTheme: 'dashain' }),
    });
    assert(unauthRes.status === 401, 'Unauthenticated POST /api/admin/system-theme is rejected with 401 Unauthorized');

    // Unauthorized role (RECEPTIONIST)
    const recepRes = await fetch(`${BASE_URL}/api/admin/system-theme`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${receptionistToken}`,
      },
      body: JSON.stringify({ activeTheme: 'dashain' }),
    });
    assert(recepRes.status === 403, 'Non-SuperAdmin (RECEPTIONIST) POST /api/admin/system-theme is rejected with 403 Forbidden');

    // Unauthorized role (MANAGER)
    const mgrRes = await fetch(`${BASE_URL}/api/admin/system-theme`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({ activeTheme: 'dashain' }),
    });
    assert(mgrRes.status === 403, 'Non-SuperAdmin (MANAGER) POST /api/admin/system-theme is rejected with 403 Forbidden');

    // 3. Validation: Reject Invalid Theme Identifier
    console.log('\n--- 3. Testing Theme Validation ---');
    const invalidRes = await fetch(`${BASE_URL}/api/admin/system-theme`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ activeTheme: 'cyberpunk-ai-slop' }),
    });
    assert(invalidRes.status === 400, 'Reject invalid theme identifier with 400 Bad Request');

    // 4. Test Super Admin applying all 8 themes
    console.log('\n--- 4. Testing All 8 Supported Themes ---');
    const testThemes = [
      'light',
      'dark',
      'night',
      'neutral-default',
      'dashain',
      'tihar',
      'holi',
      'nepali-new-year',
    ];

    for (const themeId of testThemes) {
      const applyRes = await fetch(`${BASE_URL}/api/admin/system-theme`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          activeTheme: themeId,
          customMessage: `Testing ${themeId} theme application`,
          schedule: { enabled: false },
        }),
      });

      assert(applyRes.status === 200, `Super Admin successfully applied '${themeId}' theme`);
      const body: any = await applyRes.json();
      assert(body.success === true && body.themeConfig.activeTheme === themeId, `Server confirmed activeTheme = '${themeId}'`);

      // Verify public endpoint immediately reflects this theme
      const verifyRes = await fetch(`${BASE_URL}/api/public/system-theme`);
      const verifyData: any = await verifyRes.json();
      assert(verifyData.activeTheme === themeId, `Public endpoint immediately reflects '${themeId}'`);
    }

    // 5. Test Festival Scheduling
    console.log('\n--- 5. Testing Festival Scheduling in Asia/Kathmandu ---');
    // Invalid schedule: start >= end
    const badSchedRes = await fetch(`${BASE_URL}/api/admin/system-theme`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        activeTheme: 'neutral-default',
        schedule: {
          enabled: true,
          themeId: 'tihar',
          startDate: '2026-11-10T00:00:00',
          endDate: '2026-11-05T00:00:00',
        },
      }),
    });
    assert(badSchedRes.status === 400, 'Rejects invalid schedule interval where start >= end with 400 Bad Request');

    // Active schedule now
    const now = Date.now();
    const activeStart = new Date(now - 100000).toISOString();
    const activeEnd = new Date(now + 100000).toISOString();

    const activeSchedRes = await fetch(`${BASE_URL}/api/admin/system-theme`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        activeTheme: 'neutral-default',
        schedule: {
          enabled: true,
          themeId: 'dashain',
          startDate: activeStart,
          endDate: activeEnd,
        },
      }),
    });
    assert(activeSchedRes.status === 200, 'Valid active schedule saved successfully');
    const schedBody: any = await activeSchedRes.json();
    assert(schedBody.themeConfig.effectiveTheme === 'dashain', `Schedule takes precedence: effectiveTheme = 'dashain' (base = '${schedBody.themeConfig.activeTheme}')`);

    // Reset to Neutral Default
    console.log('\n--- 6. Resetting Theme to Neutral Default ---');
    const resetRes = await fetch(`${BASE_URL}/api/admin/system-theme`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        activeTheme: 'neutral-default',
        schedule: { enabled: false },
      }),
    });
    assert(resetRes.status === 200, 'Reset theme to Neutral Default returned 200 OK');
    const resetData: any = await resetRes.json();
    assert(resetData.themeConfig.activeTheme === 'neutral-default', 'System safely restored to Neutral Default');

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed out of ${passed + failed} assertions.`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runThemeTests();
