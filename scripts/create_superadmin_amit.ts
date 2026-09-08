import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const prisma = new PrismaClient();
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pirynpugkiurjobrqiqg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcnlucHVna2l1cmpvYnJxaXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTIzOTgsImV4cCI6MjEwMzU2ODM5OH0.ZlzqDH1EnjTr3qu-1htucpzPrpX0y4ZWlib2eQOpW3w';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const EMAIL = 'amitsharma6401790@gmail.com';
const PASSWORD_RAW = 'Amit@200%date';
const NAME = 'Amit Sharma';
const USERNAME = 'amitsharma';
const ROLE = 'SUPER_ADMIN';

async function createSuperAdminAccount() {
  console.log(`================================================================`);
  console.log(`👑 CREATING SUPER ADMIN ACCOUNT`);
  console.log(`Email: ${EMAIL}`);
  console.log(`Role: ${ROLE}`);
  console.log(`================================================================\n`);

  const hashedPassword = await bcrypt.hash(PASSWORD_RAW, 10);

  // 1. Check existing user in local SQLite or generate a consistent UUID
  let existingUser = await prisma.user.findFirst({
    where: { email: EMAIL }
  });

  const userId = existingUser ? existingUser.id : uuidv4();

  // 2. Upsert in SQLite database
  await prisma.user.upsert({
    where: { id: userId },
    update: {
      email: EMAIL,
      name: NAME,
      username: USERNAME,
      password: hashedPassword,
      role: ROLE,
      accountStatus: 'ACTIVE',
      isActive: true,
      emailVerified: true,
      twoFactorEnabled: false
    },
    create: {
      id: userId,
      email: EMAIL,
      name: NAME,
      username: USERNAME,
      password: hashedPassword,
      role: ROLE,
      accountStatus: 'ACTIVE',
      isActive: true,
      emailVerified: true,
      twoFactorEnabled: false
    }
  });
  console.log(`✅ SQLite: User record saved (ID: ${userId})`);

  // 3. Upsert into Supabase public."User" table
  const { error: sbUserErr } = await supabase.from('User').upsert({
    id: userId,
    email: EMAIL,
    name: NAME,
    username: USERNAME,
    password: hashedPassword,
    role: ROLE,
    accountStatus: 'ACTIVE',
    isActive: true,
    emailVerified: true,
    twoFactorEnabled: false
  });

  if (sbUserErr) {
    console.error('⚠️ Supabase public.User upsert warning:', sbUserErr.message);
  } else {
    console.log(`✅ Supabase public."User": User record saved`);
  }

  // 4. Upsert into Supabase Auth (auth.users & auth.identities via SQL)
  console.log('\nSyncing to Supabase auth.users and auth.identities...');
  return { userId, hashedPassword };
}

createSuperAdminAccount()
  .then((res) => {
    console.log('\nAccount pre-configuration completed:', res);
  })
  .catch((err) => {
    console.error('Error creating superadmin:', err);
  })
  .finally(() => prisma.$disconnect());
