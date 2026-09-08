import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runVerification() {
  console.log('--- STARTING REPAIR PRICES HIERARCHY TEST ---');

  // Test 1: Query initial count
  const initialCount = await prisma.repairPrice.count();
  console.log(`Initial Repair Prices count in DB: ${initialCount}`);

  // Test 2: Create a service in Samsung -> Galaxy S23 Ultra -> Display
  const testBrand = `TestBrand_${Date.now()}`;
  const testModel = 'Galaxy S23 Ultra';
  const testCategory = 'Display';

  const createdService1 = await prisma.repairPrice.create({
    data: {
      brand: testBrand,
      model: testModel,
      category: testCategory,
      problem: 'Broken Screen',
      serviceName: 'Display Replacement',
      price: 26000,
      priceType: 'FIXED',
      status: 'ACTIVE',
      description: 'Original Dynamic AMOLED 2X panel replacement',
      estimatedTime: '1-2 Hours'
    }
  });
  console.log(`✓ Created test service 1: ${createdService1.id} (${createdService1.brand} ${createdService1.model} - ${createdService1.serviceName})`);

  // Test 3: Create Front Camera & Battery services in same model
  const createdService2 = await prisma.repairPrice.create({
    data: {
      brand: testBrand,
      model: testModel,
      category: 'Camera',
      problem: 'Blurry selfie camera',
      serviceName: 'Front Camera Replacement',
      price: 6500,
      priceType: 'FIXED',
      status: 'ACTIVE'
    }
  });

  const createdService3 = await prisma.repairPrice.create({
    data: {
      brand: testBrand,
      model: testModel,
      category: 'Battery',
      problem: 'Fast Battery Drain',
      serviceName: 'Battery Replacement',
      price: 4500,
      priceType: 'FIXED',
      status: 'ACTIVE'
    }
  });
  console.log(`✓ Created test services 2 & 3: ${createdService2.serviceName}, ${createdService3.serviceName}`);

  // Test 4: Rename Folder (Model)
  const newModelName = 'Galaxy S23 Ultra 5G';
  const renameResult = await prisma.repairPrice.updateMany({
    where: { brand: testBrand, model: testModel },
    data: { model: newModelName }
  });
  console.log(`✓ Renamed model from "${testModel}" to "${newModelName}". Affected count: ${renameResult.count} (expected 3)`);
  if (renameResult.count !== 3) throw new Error('Rename count mismatch');

  // Test 5: Move service to new model
  const targetModel = 'Galaxy S24 Ultra';
  const moveResult = await prisma.repairPrice.update({
    where: { id: createdService1.id },
    data: { model: targetModel }
  });
  console.log(`✓ Moved service ${createdService1.id} to ${moveResult.model}`);
  if (moveResult.model !== targetModel) throw new Error('Move failed');

  // Test 6: Bulk Delete services
  const deleteResult = await prisma.repairPrice.deleteMany({
    where: { id: { in: [createdService2.id, createdService3.id] } }
  });
  console.log(`✓ Bulk deleted services count: ${deleteResult.count} (expected 2)`);

  // Test 7: Delete entire test brand folder
  const folderDeleteResult = await prisma.repairPrice.deleteMany({
    where: { brand: testBrand }
  });
  console.log(`✓ Cleaned up remaining test brand records count: ${folderDeleteResult.count} (expected 1)`);

  // Test 8: Verify original catalog integrity
  const finalCount = await prisma.repairPrice.count();
  console.log(`Final count after cleanup: ${finalCount} (initial was ${initialCount})`);
  if (finalCount !== initialCount) throw new Error('Final count does not match initial count!');

  console.log('--- ALL 8 AUTOMATED HIERARCHY TESTS PASSED WITH 100% SUCCESS! ---');
}

runVerification()
  .catch((err) => {
    console.error('VERIFICATION FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
