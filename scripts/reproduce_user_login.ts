import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BASE_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3000';

async function testTargetLogin() {
  console.log('--- Checking User Record in Database ---');
  const user = await prisma.user.findFirst({
    where: { email: 'amitsharma64017900@gmail.com' }
  });
  console.log('Database User:', user);

  console.log('\n--- Attempting POST /api/auth/login ---');
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: 'amitsharma64017900@gmail.com',
        password: 'Ganesh@200%life',
        device: {
          deviceIdentifier: 'dev_test_reproduce',
          deviceName: 'Chrome on Windows',
          deviceType: 'DESKTOP'
        },
        isClientVerified: true
      })
    });

    console.log('Status Code:', res.status);
    const text = await res.text();
    console.log('Response Body:', text);
  } catch (err: any) {
    console.error('Fetch Error:', err);
  }
}

testTargetLogin()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
