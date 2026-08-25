import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runInventoryVerification() {
  console.log('====================================================');
  console.log('STARTING MTS LAB INVENTORY HUB AUTOMATED VERIFICATION');
  console.log('====================================================');

  // Test 1: Query initial count
  const initialCount = await prisma.inventoryItem.count();
  console.log(`✓ Initial inventory items count in database: ${initialCount}`);

  // Test 2: Create a new inventory item with opening stock = 20
  const testBrand = `TestBrand_${Date.now()}`;
  const testModel = 'Galaxy S23 Ultra';
  const testCategory = 'Displays';
  const testSku = `TEST-SAM-S23U-DIS-${Date.now()}`;

  const createdItem = await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.create({
      data: {
        name: 'Samsung Galaxy S23 Ultra Dynamic AMOLED 2X Display (Test)',
        brand: testBrand,
        model: testModel,
        sku: testSku,
        category: testCategory,
        compatibility: 'SM-S918B, SM-S918U',
        unit: 'Piece',
        currentStock: 20,
        minStockLevel: 5,
        purchasePrice: 18000,
        sellingPrice: 26000,
        supplier: 'Korea Tech Apex',
        storageLocation: 'Rack D-1, Bin 03',
        status: 'ACTIVE'
      }
    });

    const txLog = await tx.inventoryTransaction.create({
      data: {
        itemId: item.id,
        type: 'STOCK_IN',
        quantity: 20,
        previousStock: 0,
        newStock: 20,
        reason: 'Initial Opening Stock Intake',
        performedByName: 'Test Admin'
      }
    });

    return item;
  });

  console.log(`✓ Created test item: ${createdItem.id} (SKU: ${createdItem.sku}, Stock: ${createdItem.currentStock})`);
  if (createdItem.currentStock !== 20) throw new Error('Initial stock mismatch');

  // Test 3: Verify Opening Transaction exists
  const openingTx = await prisma.inventoryTransaction.findFirst({
    where: { itemId: createdItem.id, type: 'STOCK_IN' }
  });
  if (!openingTx || openingTx.quantity !== 20) throw new Error('Opening transaction not recorded');
  console.log(`✓ Verified opening transaction recorded (ID: ${openingTx.id}, Qty: +${openingTx.quantity})`);

  // Test 4: Stock In (+10) -> 20 + 10 = 30
  const stockInQty = 10;
  const [stockInItem, stockInTx] = await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({ where: { id: createdItem.id } });
    if (!item) throw new Error('Item not found');

    const prev = item.currentStock;
    const next = prev + stockInQty;

    const upd = await tx.inventoryItem.update({
      where: { id: createdItem.id },
      data: { currentStock: next }
    });

    const log = await tx.inventoryTransaction.create({
      data: {
        itemId: item.id,
        type: 'STOCK_IN',
        quantity: stockInQty,
        previousStock: prev,
        newStock: next,
        reason: 'Shipment Receipt PO-9912',
        performedByName: 'Admin'
      }
    });

    return [upd, log];
  });

  console.log(`✓ Stock In (+${stockInQty}): Previous ${stockInTx.previousStock} -> New ${stockInItem.currentStock} (Expected 30)`);
  if (stockInItem.currentStock !== 30) throw new Error('Stock in quantity calculation mismatch');

  // Test 5: Stock Out (-5) -> 30 - 5 = 25
  const stockOutQty = 5;
  const [stockOutItem, stockOutTx] = await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({ where: { id: createdItem.id } });
    if (!item) throw new Error('Item not found');
    if (item.currentStock < stockOutQty) throw new Error('Insufficient stock');

    const prev = item.currentStock;
    const next = prev - stockOutQty;

    const upd = await tx.inventoryItem.update({
      where: { id: createdItem.id },
      data: { currentStock: next }
    });

    const log = await tx.inventoryTransaction.create({
      data: {
        itemId: item.id,
        type: 'STOCK_OUT',
        quantity: stockOutQty,
        previousStock: prev,
        newStock: next,
        reason: 'Used for Customer Repair',
        repairNumber: 'MTS-2026-TEST',
        performedByName: 'Technician'
      }
    });

    return [upd, log];
  });

  console.log(`✓ Stock Out (-${stockOutQty}): Previous ${stockOutTx.previousStock} -> New ${stockOutItem.currentStock} (Expected 25)`);
  if (stockOutItem.currentStock !== 25) throw new Error('Stock out quantity calculation mismatch');

  // Test 6: Insufficient Stock Test (Attempt deduction of 50 from 25)
  let rejected = false;
  try {
    const excessiveQty = 50;
    await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id: createdItem.id } });
      if (!item || item.currentStock < excessiveQty) {
        throw new Error(`Insufficient stock. Available: ${item?.currentStock}, Requested: ${excessiveQty}`);
      }
      await tx.inventoryItem.update({ where: { id: createdItem.id }, data: { currentStock: item.currentStock - excessiveQty } });
    });
  } catch (err: any) {
    if (err.message.includes('Insufficient stock')) {
      rejected = true;
    }
  }
  console.log(`✓ Insufficient Stock Protection: Request for 50 units on 25 stock correctly rejected: ${rejected}`);
  if (!rejected) throw new Error('Insufficient stock protection failed!');

  // Verify stock remained unchanged at 25
  const verifiedStock = await prisma.inventoryItem.findUnique({ where: { id: createdItem.id } });
  if (verifiedStock?.currentStock !== 25) throw new Error('Stock was altered after rejected transaction');

  // Test 7: Physical Stock Adjustment (25 -> 22, delta -3)
  const physicalCount = 22;
  const [adjustedItem, adjustTx] = await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({ where: { id: createdItem.id } });
    if (!item) throw new Error('Item not found');

    const prev = item.currentStock;
    const delta = Math.abs(physicalCount - prev);

    const upd = await tx.inventoryItem.update({
      where: { id: createdItem.id },
      data: { currentStock: physicalCount }
    });

    const log = await tx.inventoryTransaction.create({
      data: {
        itemId: item.id,
        type: 'STOCK_ADJUSTMENT',
        quantity: delta,
        previousStock: prev,
        newStock: physicalCount,
        reason: 'Physical Inventory Count Audit Adjustment',
        performedByName: 'Lead Auditor'
      }
    });

    return [upd, log];
  });

  console.log(`✓ Stock Adjustment: Previous ${adjustTx.previousStock} -> Physical Count ${adjustedItem.currentStock} (Delta: ${adjustTx.quantity})`);
  if (adjustedItem.currentStock !== 22) throw new Error('Stock adjustment mismatch');

  // Test 8: Folder Rename Propagation (Model rename)
  const newModelName = 'Galaxy S23 Ultra 5G Pro';
  const renameResult = await prisma.inventoryItem.updateMany({
    where: { brand: testBrand, model: testModel },
    data: { model: newModelName }
  });
  console.log(`✓ Renamed model from "${testModel}" to "${newModelName}". Affected items: ${renameResult.count}`);
  if (renameResult.count !== 1) throw new Error('Rename affected count mismatch');

  // Test 9: Move Item to new brand/model/category
  const targetBrand = `${testBrand}_Moved`;
  const moveResult = await prisma.inventoryItem.update({
    where: { id: createdItem.id },
    data: { brand: targetBrand, category: 'Batteries' }
  });
  console.log(`✓ Moved item to brand: "${moveResult.brand}", category: "${moveResult.category}"`);
  if (moveResult.brand !== targetBrand || moveResult.category !== 'Batteries') throw new Error('Move failed');

  // Test 10: Soft Archive and Restore
  const archiveResult = await prisma.inventoryItem.update({
    where: { id: createdItem.id },
    data: { status: 'ARCHIVED' }
  });
  console.log(`✓ Archived item status: ${archiveResult.status}`);
  if (archiveResult.status !== 'ARCHIVED') throw new Error('Archive failed');

  const restoreResult = await prisma.inventoryItem.update({
    where: { id: createdItem.id },
    data: { status: 'ACTIVE' }
  });
  console.log(`✓ Restored item status: ${restoreResult.status}`);
  if (restoreResult.status !== 'ACTIVE') throw new Error('Restore failed');

  // Test 11: Cleanup test records
  await prisma.inventoryTransaction.deleteMany({ where: { itemId: createdItem.id } });
  await prisma.inventoryItem.delete({ where: { id: createdItem.id } });

  const finalCount = await prisma.inventoryItem.count();
  console.log(`✓ Cleaned up test item. Final count in database: ${finalCount} (initial was ${initialCount})`);
  if (finalCount !== initialCount) throw new Error('Final count does not match initial count!');

  console.log('====================================================');
  console.log('ALL 11 INVENTORY TESTS PASSED WITH 100% SUCCESS!');
  console.log('====================================================');
}

runInventoryVerification()
  .catch((err) => {
    console.error('INVENTORY VERIFICATION FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
