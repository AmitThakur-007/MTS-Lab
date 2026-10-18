import jwt from 'jsonwebtoken';
import { 
  getSystemThemeConfig, 
  getSystemThemeConfigAsync, 
  hydrateSystemThemeFromSupabase, 
  updateSystemThemeConfig, 
  VALID_THEMES,
  FESTIVAL_THEMES,
  GlobalThemeId 
} from '../api/_server/services/systemThemeService';
import { supabaseAdmin } from '../api/_server/config/supabase';

const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'mts-lab-super-secret-key-2026';

function generateSuperAdminToken() {
  return jwt.sign(
    {
      id: '4b8a6081-1f1e-4140-8a76-e6e0ef1dfa45', // Valid Super Admin UUID
      name: 'Amit Sharma',
      email: 'amitsharma6401790@gmail.com',
      role: 'SUPER_ADMIN',
      user_metadata: { role: 'SUPER_ADMIN', name: 'Amit Sharma' },
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runPersistenceTests() {
  console.log('========================================================================');
  console.log('🧪 TESTING FESTIVAL THEME REFRESH PERSISTENCE & DATABASE INTEGRITY');
  console.log('========================================================================\n');

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

  const token = generateSuperAdminToken();

  try {
    // Test 1: Apply Dashain festival theme via Super Admin API
    console.log('\n--- 1. Applying Festival Theme: Dashain ---');
    const applyRes = await fetch(`${BASE_URL}/api/admin/system-theme`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        activeTheme: 'dashain',
        festivalGreeting: 'बडा दशैंको हार्दिक मंगलमय शुभकामना | Happy Dashain',
        customMessage: 'Festive blessings from MTS Lab Team',
        schedule: { enabled: false },
      }),
    });

    assert(applyRes.status === 200, 'POST /api/admin/system-theme for Dashain returned 200 OK');
    const applyData: any = await applyRes.json();
    assert(applyData.themeConfig?.activeTheme === 'dashain', 'Active theme is dashain');
    assert(applyData.themeConfig?.effectiveTheme === 'dashain', 'Effective theme is dashain');
    assert(applyData.themeConfig?.festivalModeEnabled === true, 'Festival mode is enabled');

    // Test 2: Verify Supabase database AuditLog table holds the authoritative record
    console.log('\n--- 2. Verifying Supabase Database Persistence ---');
    const { data: dbRecords, error: dbErr } = await supabaseAdmin
      .from('AuditLog')
      .select('id, details, createdAt')
      .eq('resource', 'SystemTheme')
      .order('createdAt', { ascending: false })
      .limit(1);

    assert(!dbErr, 'Supabase query succeeded without error');
    assert(Array.isArray(dbRecords) && dbRecords.length > 0, 'Supabase AuditLog contains at least one SystemTheme record');
    
    const dbParsed = typeof dbRecords![0].details === 'string' ? JSON.parse(dbRecords![0].details) : dbRecords![0].details;
    assert(dbParsed.activeTheme === 'dashain', `Database persisted theme is 'dashain' (got: ${dbParsed.activeTheme})`);
    assert(dbParsed.effectiveTheme === 'dashain', 'Database persisted effectiveTheme is dashain');

    // Test 3: Simulating Full Server / Lambda Cold Start / Browser Refresh
    // Re-hydrating directly from Supabase database into a clean state
    console.log('\n--- 3. Simulating Full Server Restart / Browser Refresh (Cold Start) ---');
    const rehydrated = await hydrateSystemThemeFromSupabase();
    assert(rehydrated.activeTheme === 'dashain', `Rehydrated theme after restart is 'dashain' (not reset to default)`);
    assert(rehydrated.effectiveTheme === 'dashain', 'Rehydrated effective theme is dashain');
    assert(rehydrated.festivalModeEnabled === true, 'Festival mode preserved after refresh');

    // Test 4: Verifying Public API reflects restored festival theme
    console.log('\n--- 4. Checking Public API Returns Restored Festival Theme ---');
    const pubRes = await fetch(`${BASE_URL}/api/public/system-theme`);
    const pubData: any = await pubRes.json();
    assert(pubRes.status === 200, 'Public API returns 200 OK');
    assert(pubData.activeTheme === 'dashain', `Public API returns restored activeTheme 'dashain'`);
    assert(pubData.effectiveTheme === 'dashain', `Public API returns restored effectiveTheme 'dashain'`);
    assert(pubData.festivalGreeting.includes('Dashain'), 'Festival greeting is preserved');

    // Test 5: Verify All 8 Themes Persist Accurately
    console.log('\n--- 5. Verifying All 8 Supported Themes Persist ---');
    const allThemes: GlobalThemeId[] = [
      'light',
      'dark',
      'night',
      'neutral-default',
      'dashain',
      'tihar',
      'holi',
      'nepali-new-year',
    ];

    for (const theme of allThemes) {
      const res = await fetch(`${BASE_URL}/api/admin/system-theme`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          activeTheme: theme,
          schedule: { enabled: false },
        }),
      });
      assert(res.status === 200, `Theme '${theme}' persisted via API`);

      // Verify public API returns it
      const pRes = await fetch(`${BASE_URL}/api/public/system-theme`);
      const pData: any = await pRes.json();
      assert(pData.activeTheme === theme, `Public API returned '${theme}'`);
    }

    // Test 6: Apply Tihar festival theme and verify
    console.log('\n--- 6. Applying Festival Theme: Tihar & Verifying ---');
    await fetch(`${BASE_URL}/api/admin/system-theme`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        activeTheme: 'tihar',
        schedule: { enabled: false },
      }),
    });

    const finalHydrate = await hydrateSystemThemeFromSupabase();
    assert(finalHydrate.activeTheme === 'tihar', `Final hydration confirmed 'tihar' is actively saved in database`);
    assert(finalHydrate.festivalModeEnabled === true, 'Festival mode active for Tihar');

    console.log('\n========================================================================');
    console.log(`PERSISTENCE TEST SUMMARY: ${passed} passed, ${failed} failed out of ${passed + failed} assertions.`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runPersistenceTests();
