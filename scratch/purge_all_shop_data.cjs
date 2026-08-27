const { PrismaClient } = require('@prisma/client');
const cloudinary = require('cloudinary').v2;
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/mts_lab?schema=public";
}

const prisma = new PrismaClient();

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

async function runCleanup() {
  console.log('--- STARTING SHOP DATA & CLOUDINARY PURGE ---');
  try {
    // 1. Initial counts
    const shopProductCount = await prisma.shopProduct.count();
    const productCount = await prisma.product.count();
    console.log(`Initial ShopProduct count: ${shopProductCount}`);
    console.log(`Initial Product count: ${productCount}`);

    // 2. Find MediaAttachments for Shop products
    const shopMedia = await prisma.mediaAttachment.findMany({
      where: {
        OR: [
          { entityType: 'PRODUCT' },
          { entityType: 'SHOP' },
          { folder: { contains: 'shop' } },
          { secureUrl: { contains: '/shop/' } }
        ]
      }
    });

    console.log(`Found ${shopMedia.length} Shop media attachments in database.`);

    let deletedCloudinaryCount = 0;
    if (process.env.CLOUDINARY_CLOUD_NAME && shopMedia.length > 0) {
      for (const media of shopMedia) {
        if (media.publicId && !media.publicId.startsWith('local_fallback_')) {
          try {
            await cloudinary.uploader.destroy(media.publicId);
            deletedCloudinaryCount++;
            console.log(`Deleted Cloudinary asset: ${media.publicId}`);
          } catch (err) {
            console.warn(`Could not delete Cloudinary asset ${media.publicId}:`, err.message);
          }
        }
      }
    }

    // 3. Delete MediaAttachments for Shop
    if (shopMedia.length > 0) {
      const mediaIds = shopMedia.map(m => m.id);
      await prisma.mediaAttachment.deleteMany({
        where: { id: { in: mediaIds } }
      });
      console.log(`Deleted ${shopMedia.length} MediaAttachment records.`);
    }

    // 4. Purge ShopProduct records
    const delShopProd = await prisma.shopProduct.deleteMany({});
    console.log(`Purged ${delShopProd.count} ShopProduct records.`);

    // 5. Purge Product records
    const delProd = await prisma.product.deleteMany({});
    console.log(`Purged ${delProd.count} Product records.`);

    const finalShopCount = await prisma.shopProduct.count();
    const finalProdCount = await prisma.product.count();
    console.log(`Final ShopProduct count: ${finalShopCount}`);
    console.log(`Final Product count: ${finalProdCount}`);
    console.log(`Cloudinary assets deleted: ${deletedCloudinaryCount}`);
    console.log('--- PURGE COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runCleanup();
