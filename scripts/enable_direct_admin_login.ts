import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const prisma = new PrismaClient();
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pirynpugkiurjobrqiqg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcnlucHVna2l1cmpvYnJxaXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTIzOTgsImV4cCI6MjEwMzU2ODM5OH0.ZlzqDH1EnjTr3qu-1htucpzPrpX0y4ZWlib2eQOpW3w';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function enableDirectLoginForAdmin() {
  console.log('Enabling direct password login for Super Admin (admin@mtslab.com)...');

  // 1. Update SQLite
  await prisma.user.updateMany({
    where: { email: 'admin@mtslab.com' },
    data: { twoFactorEnabled: false, emailVerified: true, accountStatus: 'ACTIVE' }
  });

  // 2. Update Supabase
  await supabase.from('User').update({ twoFactorEnabled: false, emailVerified: true, accountStatus: 'ACTIVE' }).eq('email', 'admin@mtslab.com');

  console.log('✅ Updated settings for admin@mtslab.com.');

  // 3. Test direct login
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identity: 'admin@mtslab.com',
      password: 'admin123'
    })
  });

  const data: any = await res.json();
  console.log('\n--- Direct Login Test Result ---');
  console.log('HTTP Status:', res.status);
  console.log('Login Response:', JSON.stringify(data, null, 2));

  if (res.status === 200 && data.token) {
    console.log('\n🎉 DIRECT SUPER ADMIN LOGIN SUCCEEDED!');
    console.log(`Token: ${data.token.substring(0, 30)}...`);
    console.log(`User: ${data.user?.name} (${data.user?.role})`);
  }
}

enableDirectLoginForAdmin().finally(() => prisma.$disconnect());
