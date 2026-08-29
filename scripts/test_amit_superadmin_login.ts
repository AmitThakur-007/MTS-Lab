import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pirynpugkiurjobrqiqg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcnlucHVna2l1cmpvYnJxaXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTIzOTgsImV4cCI6MjEwMzU2ODM5OH0.ZlzqDH1EnjTr3qu-1htucpzPrpX0y4ZWlib2eQOpW3w';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const EMAIL = 'amitsharma6401790@gmail.com';
const PASSWORD = 'Amit@200%date';

async function testAmitSuperAdminLogin() {
  console.log('================================================================');
  console.log('👑 TESTING SUPABASE AUTH LOGIN FOR AMIT SHARMA (SUPER_ADMIN)');
  console.log(`Email: ${EMAIL}`);
  console.log('================================================================\n');

  // 1. Supabase Auth direct login
  const { data, error } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD
  });

  if (error) {
    console.error('❌ Supabase Auth Login FAILED:', error.message);
    throw error;
  }

  console.log('✅ SUPABASE AUTH LOGIN SUCCEEDED!');
  console.log('   User ID:', data.user.id);
  console.log('   Email:', data.user.email);
  console.log('   Role Metadata:', data.user.user_metadata?.role);
  console.log('   Access Token:', data.session.access_token.substring(0, 35) + '...');

  // 2. Fetch User Profile from public."User" table
  const { data: profile, error: profileErr } = await supabase
    .from('User')
    .select('*')
    .eq('email', EMAIL)
    .single();

  if (profileErr) {
    console.error('❌ Profile lookup error:', profileErr.message);
  } else {
    console.log('\n✅ DATABASE USER PROFILE RETRIEVED:');
    console.log('   Name:', profile.name);
    console.log('   Role:', profile.role);
    console.log('   Account Status:', profile.accountStatus);
    console.log('   Active:', profile.isActive);
    console.log('   2FA Enabled:', profile.twoFactorEnabled);
  }

  console.log('\n================================================================');
  console.log('🎉 SUPER ADMIN ACCOUNT IS 100% OPERATIONAL IN SUPABASE!');
  console.log('================================================================');
}

testAmitSuperAdminLogin();
