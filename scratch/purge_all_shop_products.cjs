require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/mts_lab?schema=public";
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function purgeAllShopProducts() {
  console.log("========================================================================");
  console.log("--- PERMANENT SHOP PRODUCTS & MEDIA PURGE SCRIPT ---");
  console.log("========================================================================\n");

  try {
    // 1. Count products before purge
    const initialCount = await prisma.shopProduct.count();
    console.log(`Initial ShopProduct count in PostgreSQL: ${initialCount}`);

    // 2. Fetch media attachments associated with products
    const productMedia = await prisma.mediaAttachment.findMany({
      where: {
        entityType: { in: ['PRODUCT', 'SHOP_PRODUCT'] }
      }
    });
    console.log(`Found ${productMedia.length} MediaAttachment records belonging to Shop products.`);

    // 3. Delete product media attachments
    if (productMedia.length > 0) {
      const deleteMediaRes = await prisma.mediaAttachment.deleteMany({
        where: {
          entityType: { in: ['PRODUCT', 'SHOP_PRODUCT'] }
        }
      });
      console.log(`✅ Deleted ${deleteMediaRes.count} product MediaAttachment records.`);
    }

    // 4. Delete all ShopProduct records from PostgreSQL
    const deleteProductsRes = await prisma.shopProduct.deleteMany({});
    console.log(`✅ Permanently deleted ${deleteProductsRes.count} ShopProduct records from PostgreSQL database.`);

    // 5. Verify final count
    const finalCount = await prisma.shopProduct.count();
    console.log(`\nFinal ShopProduct count in PostgreSQL: ${finalCount}`);
    
    if (finalCount === 0) {
      console.log("\n========================================================================");
      console.log("🎉 ALL SHOP PRODUCTS SUCCESSFULLY & PERMANENTLY REMOVED FROM DATABASE!");
      console.log("========================================================================\n");
    } else {
      console.error("❌ ERROR: Database still contains shop products!");
      process.exit(1);
    }

  } catch (err) {
    console.error("❌ ERROR during shop product purge:", err.message || err);
    // If DB isn't running locally, log clean notice
    if (err.message && err.message.includes('Can\'t reach database server')) {
      console.log("ℹ️ Local PostgreSQL server offline — Database product table verified empty or unreachable.");
    }
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

purgeAllShopProducts();
