import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pirynpugkiurjobrqiqg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcnlucHVna2l1cmpvYnJxaXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTIzOTgsImV4cCI6MjEwMzU2ODM5OH0.ZlzqDH1EnjTr3qu-1htucpzPrpX0y4ZWlib2eQOpW3w';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function pullSupabaseDataToLocal() {
  console.log('Pulling all records from Supabase to local SQLite...');

  // 1. Users
  const { data: users } = await supabase.from('User').select('*');
  if (users) {
    for (const u of users) {
      await prisma.user.upsert({
        where: { id: u.id },
        update: u,
        create: u
      }).catch((e) => console.warn('User upsert warn:', u.email, e.message));
    }
    console.log(`✅ Users: ${users.length} records pulled`);
  }

  // 2. Customers
  const { data: customers } = await supabase.from('Customer').select('*');
  if (customers) {
    for (const c of customers) {
      await prisma.customer.upsert({
        where: { id: c.id },
        update: c,
        create: c
      }).catch((e) => console.warn('Customer upsert warn:', e.message));
    }
    console.log(`✅ Customers: ${customers.length} records pulled`);
  }

  // 3. Repairs
  const { data: repairs } = await supabase.from('Repair').select('*');
  if (repairs) {
    for (const r of repairs) {
      await prisma.repair.upsert({
        where: { id: r.id },
        update: r,
        create: r
      }).catch((e) => console.warn('Repair upsert warn:', e.message));
    }
    console.log(`✅ Repairs: ${repairs.length} records pulled`);
  }

  // 4. BatteryWarranties
  const { data: warranties } = await supabase.from('BatteryWarranty').select('*');
  if (warranties) {
    for (const w of warranties) {
      await prisma.batteryWarranty.upsert({
        where: { id: w.id },
        update: w,
        create: w
      }).catch((e) => console.warn('Warranty upsert warn:', e.message));
    }
    console.log(`✅ Battery Warranties: ${warranties.length} records pulled`);
  }

  // 5. Inventory Items
  const { data: items } = await supabase.from('InventoryItem').select('*');
  if (items) {
    for (const item of items) {
      await prisma.inventoryItem.upsert({
        where: { id: item.id },
        update: item,
        create: item
      }).catch((e) => console.warn('Item upsert warn:', e.message));
    }
    console.log(`✅ Inventory Items: ${items.length} records pulled`);
  }

  console.log('🎉 Supabase to SQLite synchronization finished!');
}

pullSupabaseDataToLocal().finally(() => prisma.$disconnect());
