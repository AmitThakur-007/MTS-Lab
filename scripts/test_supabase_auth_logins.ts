import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pirynpugkiurjobrqiqg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcnlucHVna2l1cmpvYnJxaXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTIzOTgsImV4cCI6MjEwMzU2ODM5OH0.ZlzqDH1EnjTr3qu-1htucpzPrpX0y4ZWlib2eQOpW3w';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testSupabaseLogin(email: string, password: string,roleDescription: string) {
  console.log(`\nTesting Supabase Auth login for ${roleDescription} (${email})...`);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error(`❌ Failed login for ${email}:`, error.message);
    return false;
  }

  console.log(`✅ SUCCESS! Logged in as: ${data.user?.email}`);
  console.log(`   - Supabase User ID: ${data.user?.id}`);
  console.log(`   - Access Token received: ${data.session?.access_token.substring(0, 30)}...`);
  console.log(`   - User Metadata Role: ${data.user?.user_metadata?.role || 'N/A'}`);
  return true;
}

async function runAllAuthTests() {
  console.log('================================================================');
  console.log('🔐 TESTING SUPABASE AUTH & CREDENTIAL TRANSFERS');
  console.log('Project URL:', SUPABASE_URL);
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  // Real staff accounts with their active password 'admin123'
  const accountsToTest = [
    { email: 'admin@mtslab.com', role: 'SUPER_ADMIN' },
    { email: 'mtsmobilelab@gmail.com', role: 'SUPER_ADMIN' },
    { email: 'manishmts17900@gmail.com', role: 'MANAGER' },
    { email: 'amitthakur63017900@gmail.com', role: 'TECHNICIAN' },
    { email: 'omprakashthakur950rt@gmail.com', role: 'RECEPTIONIST' },
    { email: 'manojacharya526@gmail.com', role: 'TECHNICIAN' },
    { email: 'pramila123@gmail.com', role: 'RECEPTIONIST' }
  ];

  for (const acc of accountsToTest) {
    const success = await testSupabaseLogin(acc.email, 'admin123', acc.role);
    if (success) passed++;
    else failed++;
  }

  console.log('\n================================================================');
  console.log(`AUTHENTICATION TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllAuthTests();
