import { rtdb, db, auth, ensureFirebaseAuth } from '@/lib/firebase';
import { 
  ref as rtdbRef, 
  get as rtdbGet, 
  set as rtdbSet, 
  update as rtdbUpdate, 
  remove as rtdbRemove 
} from 'firebase/database';
import { useAuthStore } from '@/store/authStore';

// Helper to touch root syncTimestamp so all connected browser tabs & devices instantly refresh
export async function touchSync() {
  if (!rtdb) return;
  try {
    const syncRef = rtdbRef(rtdb, 'syncTimestamp');
    await rtdbSet(syncRef, Date.now());
  } catch (e) {
    // Non-blocking
  }
}

// Generate unique, collision-resistant IDs
export function generateId(prefix: string): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${randomStr}`;
}

export function generateNumber(prefix: string): string {
  const year = new Date().getFullYear();
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${year}-${num}`;
}

/**
 * Direct Firebase Realtime Database Data Provider
 * Ensures 100% data persistence on Vercel and multi-device cloud environments
 */
export async function handleFirebaseGet(cleanEndpoint: string): Promise<any> {
  if (!rtdb) return null;
  await ensureFirebaseAuth().catch(() => {});

  const url = new URL(cleanEndpoint, 'http://localhost');
  const path = url.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  const segments = path.split('/');
  const primaryResource = segments[0]; // e.g. 'customers', 'repairs', 'inventory'
  const resourceId = segments[1];

  // 1. Customers
  if (primaryResource === 'customers') {
    if (resourceId && resourceId !== 'export') {
      const snap = await rtdbGet(rtdbRef(rtdb, `customers/${resourceId}`));
      if (!snap.exists()) {
        throw new Error('Customer not found');
      }
      const customer = snap.val();
      // Fetch customer's repairs
      const repairsSnap = await rtdbGet(rtdbRef(rtdb, 'repairs'));
      const repairsMap = repairsSnap.exists() ? repairsSnap.val() : {};
      const repairs = Object.values(repairsMap).filter((r: any) => r && (r.customerId === resourceId || r.customerPhone === customer.phone));
      return {
        ...customer,
        repairs,
        totalRepairs: repairs.length,
        activeRepairs: repairs.filter((r: any) => !['DELIVERED', 'CANCELLED', 'CANNOT_REPAIR'].includes(r.status)).length
      };
    }

    const snap = await rtdbGet(rtdbRef(rtdb, 'customers'));
    const map = snap.exists() ? snap.val() : {};
    let list = Object.values(map).filter(Boolean);

    // Apply includeArchived filter
    const includeArchived = url.searchParams.get('includeArchived') === 'true';
    if (!includeArchived) {
      list = list.filter((c: any) => !c.archived);
    }

    // Apply search filter
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    if (search) {
      list = list.filter((c: any) => 
        (c.name && c.name.toLowerCase().includes(search)) ||
        (c.phone && c.phone.includes(search)) ||
        (c.email && c.email.toLowerCase().includes(search)) ||
        (c.customerId && c.customerId.toLowerCase().includes(search))
      );
    }

    // Sort
    const sortBy = url.searchParams.get('sortBy') || 'updatedAt';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    list.sort((a: any, b: any) => {
      const valA = a[sortBy] || a.createdAt || '';
      const valB = b[sortBy] || b.createdAt || '';
      return sortOrder === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
    });

    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const paginated = list.slice((page - 1) * limit, page * limit);

    return {
      customers: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    };
  }

  // 2. Repairs
  if (primaryResource === 'repairs') {
    if (resourceId && resourceId !== 'stats' && resourceId !== 'export') {
      const snap = await rtdbGet(rtdbRef(rtdb, `repairs/${resourceId}`));
      if (!snap.exists()) {
        throw new Error('Repair not found');
      }
      return snap.val();
    }

    const snap = await rtdbGet(rtdbRef(rtdb, 'repairs'));
    const map = snap.exists() ? snap.val() : {};
    let list = Object.values(map).filter(Boolean);

    // Apply status filter
    const status = url.searchParams.get('status');
    if (status && status !== 'ALL') {
      list = list.filter((r: any) => r.status === status);
    }

    // Apply technician filter
    const technicianId = url.searchParams.get('technicianId');
    if (technicianId) {
      list = list.filter((r: any) => r.technicianId === technicianId);
    }

    // Sort by createdAt desc
    list.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return list;
  }

  // 3. Inventory
  if (primaryResource === 'inventory') {
    if (resourceId === 'categories') {
      const snap = await rtdbGet(rtdbRef(rtdb, 'inventoryCategories'));
      return snap.exists() ? Object.values(snap.val()) : [];
    }
    if (resourceId === 'transactions') {
      const snap = await rtdbGet(rtdbRef(rtdb, 'inventoryTransactions'));
      return snap.exists() ? Object.values(snap.val()) : [];
    }
    if (resourceId && !['items', 'stats'].includes(resourceId)) {
      const snap = await rtdbGet(rtdbRef(rtdb, `inventory/${resourceId}`));
      return snap.exists() ? snap.val() : null;
    }

    const snap = await rtdbGet(rtdbRef(rtdb, 'inventory'));
    const map = snap.exists() ? snap.val() : {};
    return Object.values(map).filter(Boolean);
  }

  // 4. Staff / Users
  if (primaryResource === 'staff' || primaryResource === 'users') {
    if (resourceId) {
      const snap = await rtdbGet(rtdbRef(rtdb, `users/${resourceId}`));
      return snap.exists() ? snap.val() : null;
    }
    const snap = await rtdbGet(rtdbRef(rtdb, 'users'));
    const map = snap.exists() ? snap.val() : {};
    let users = Object.values(map).filter(Boolean);
    if (users.length === 0) {
      // Return default admin user if database is freshly initialized
      users = [{
        id: 'usr_admin_default',
        name: 'MTS Lab Super Admin',
        email: 'mtsmobilelab@gmail.com',
        role: 'SUPER_ADMIN',
        accountStatus: 'ACTIVE',
        isActive: true,
        emailVerified: true
      }];
    }
    return users;
  }

  // 5. Battery Warranties
  if (primaryResource === 'battery-warranties') {
    if (resourceId === 'claims') {
      const snap = await rtdbGet(rtdbRef(rtdb, 'batteryWarrantyClaims'));
      return snap.exists() ? Object.values(snap.val()) : [];
    }
    if (resourceId) {
      const snap = await rtdbGet(rtdbRef(rtdb, `batteryWarranties/${resourceId}`));
      return snap.exists() ? snap.val() : null;
    }
    const snap = await rtdbGet(rtdbRef(rtdb, 'batteryWarranties'));
    return snap.exists() ? Object.values(snap.val()) : [];
  }

  // 6. Couriers
  if (primaryResource === 'couriers') {
    const snap = await rtdbGet(rtdbRef(rtdb, 'couriers'));
    const map = snap.exists() ? snap.val() : {};
    return Object.values(map).filter(Boolean);
  }

  // 7. Attendance
  if (primaryResource === 'attendance') {
    const snap = await rtdbGet(rtdbRef(rtdb, 'attendances'));
    const map = snap.exists() ? snap.val() : {};
    return Object.values(map).filter(Boolean);
  }

  // 8. Damage Records
  if (primaryResource === 'damage-records') {
    const snap = await rtdbGet(rtdbRef(rtdb, 'damageRecords'));
    const map = snap.exists() ? snap.val() : {};
    return Object.values(map).filter(Boolean);
  }

  // 9. Repair Prices
  if (primaryResource === 'repair-prices' || (primaryResource === 'public' && segments[1] === 'repair-prices')) {
    const snap = await rtdbGet(rtdbRef(rtdb, 'repairPrices'));
    const map = snap.exists() ? snap.val() : {};
    return Object.values(map).filter(Boolean);
  }

  // 10. Notifications
  if (primaryResource === 'notifications') {
    const snap = await rtdbGet(rtdbRef(rtdb, 'notifications'));
    const map = snap.exists() ? snap.val() : {};
    return Object.values(map).filter(Boolean);
  }

  // 11. Access Requests
  if (primaryResource === 'access-requests') {
    const snap = await rtdbGet(rtdbRef(rtdb, 'accessRequests'));
    const map = snap.exists() ? snap.val() : {};
    return Object.values(map).filter(Boolean);
  }

  // 12. Products
  if (primaryResource === 'products') {
    const snap = await rtdbGet(rtdbRef(rtdb, 'products'));
    const map = snap.exists() ? snap.val() : {};
    return Object.values(map).filter(Boolean);
  }

  // 13. Home Slides
  if (primaryResource === 'home-slides') {
    const snap = await rtdbGet(rtdbRef(rtdb, 'homeSlides'));
    const map = snap.exists() ? snap.val() : {};
    return Object.values(map).filter(Boolean);
  }

  return null;
}

/**
 * Handle POST Persistence
 */
export async function handleFirebasePost(cleanEndpoint: string, payload: any): Promise<any> {
  if (!rtdb) throw new Error('Firebase Database not initialized');
  await ensureFirebaseAuth().catch(() => {});

  const path = cleanEndpoint.split('?')[0].replace(/^\/+/, '').replace(/\/+$/, '');
  const segments = path.split('/');
  const primaryResource = segments[0];
  const subAction = segments[1];

  const now = new Date().toISOString();
  const currentUser = useAuthStore.getState().user;

  // 1. POST /customers
  if (primaryResource === 'customers') {
    if (subAction && segments[2] === 'restore') {
      const customerId = subAction;
      const ref = rtdbRef(rtdb, `customers/${customerId}`);
      await rtdbUpdate(ref, { archived: false, updatedAt: now });
      await touchSync();
      return { success: true, message: 'Customer restored' };
    }

    const id = payload.id || generateId('cust');
    const customerId = payload.customerId || `CUST-${Date.now().toString().slice(-6)}`;
    const newCustomer = {
      ...payload,
      id,
      customerId,
      archived: false,
      createdAt: payload.createdAt || now,
      updatedAt: now
    };

    await rtdbSet(rtdbRef(rtdb, `customers/${id}`), newCustomer);
    await touchSync();
    return newCustomer;
  }

  // 2. POST /repairs
  if (primaryResource === 'repairs') {
    // Handle /repairs/batch
    if (subAction === 'batch' && Array.isArray(payload.repairs)) {
      const createdRepairs = [];
      for (const item of payload.repairs) {
        const id = item.id || generateId('rep');
        const repairNumber = item.repairNumber || generateNumber('MTS');
        const newRepair = {
          ...item,
          id,
          repairNumber,
          status: item.status || 'RECEIVED',
          priority: item.priority || 'NORMAL',
          advancePaid: Number(item.advancePaid || 0),
          totalPaid: Number(item.totalPaid || item.advancePaid || 0),
          paymentStatus: item.paymentStatus || 'UNPAID',
          createdById: currentUser?.id || 'usr_staff',
          createdAt: item.createdAt || now,
          updatedAt: now
        };
        await rtdbSet(rtdbRef(rtdb, `repairs/${id}`), newRepair);
        createdRepairs.push(newRepair);
      }
      await touchSync();
      return { success: true, count: createdRepairs.length, repairs: createdRepairs };
    }

    // Handle /repairs/:id/notes
    if (subAction && segments[2] === 'notes') {
      const noteId = generateId('note');
      const note = {
        ...payload,
        id: noteId,
        repairId: subAction,
        createdAt: now
      };
      await rtdbSet(rtdbRef(rtdb, `technicianNotes/${subAction}/${noteId}`), note);
      await touchSync();
      return note;
    }

    // Handle /repairs/:id/logs
    if (subAction && segments[2] === 'logs') {
      const logId = generateId('log');
      const log = {
        ...payload,
        id: logId,
        repairId: subAction,
        createdAt: now
      };
      await rtdbSet(rtdbRef(rtdb, `repairLogs/${subAction}/${logId}`), log);
      await touchSync();
      return log;
    }

    // Handle /repairs/:id/payments
    if (subAction && segments[2] === 'payments') {
      const paymentId = generateId('pay');
      const payment = {
        ...payload,
        id: paymentId,
        repairId: subAction,
        createdAt: now
      };
      await rtdbSet(rtdbRef(rtdb, `payments/${paymentId}`), payment);
      await touchSync();
      return payment;
    }

    const id = payload.id || generateId('rep');
    const repairNumber = payload.repairNumber || generateNumber('MTS');
    const newRepair = {
      ...payload,
      id,
      repairNumber,
      status: payload.status || 'RECEIVED',
      priority: payload.priority || 'NORMAL',
      advancePaid: Number(payload.advancePaid || 0),
      totalPaid: Number(payload.totalPaid || payload.advancePaid || 0),
      paymentStatus: payload.paymentStatus || 'UNPAID',
      createdById: currentUser?.id || 'usr_staff',
      createdAt: payload.createdAt || now,
      updatedAt: now
    };

    await rtdbSet(rtdbRef(rtdb, `repairs/${id}`), newRepair);

    // Also update/sync customer repair count
    if (newRepair.customerId) {
      const custRef = rtdbRef(rtdb, `customers/${newRepair.customerId}`);
      const custSnap = await rtdbGet(custRef);
      if (custSnap.exists()) {
        const cust = custSnap.val();
        await rtdbUpdate(custRef, {
          totalRepairs: (cust.totalRepairs || 0) + 1,
          updatedAt: now
        });
      }
    }

    await touchSync();
    return newRepair;
  }

  // 3. POST /inventory
  if (primaryResource === 'inventory') {
    if (subAction === 'transactions') {
      const txId = generateId('tx');
      const transaction = {
        ...payload,
        id: txId,
        performedById: currentUser?.id,
        performedByName: currentUser?.name,
        createdAt: now
      };
      await rtdbSet(rtdbRef(rtdb, `inventoryTransactions/${txId}`), transaction);

      // Adjust item stock
      if (payload.itemId && payload.quantity !== undefined) {
        const itemRef = rtdbRef(rtdb, `inventory/${payload.itemId}`);
        const itemSnap = await rtdbGet(itemRef);
        if (itemSnap.exists()) {
          const item = itemSnap.val();
          let newStock = item.currentStock || 0;
          if (payload.type === 'STOCK_IN') newStock += Number(payload.quantity);
          else if (payload.type === 'STOCK_OUT') newStock -= Number(payload.quantity);
          else if (payload.type === 'STOCK_ADJUSTMENT') newStock = Number(payload.quantity);
          await rtdbUpdate(itemRef, { currentStock: newStock, updatedAt: now });
        }
      }
      await touchSync();
      return transaction;
    }

    const id = payload.id || generateId('inv');
    const newItem = {
      ...payload,
      id,
      currentStock: Number(payload.currentStock || 0),
      minStockLevel: Number(payload.minStockLevel || 5),
      createdAt: now,
      updatedAt: now
    };
    await rtdbSet(rtdbRef(rtdb, `inventory/${id}`), newItem);
    await touchSync();
    return newItem;
  }

  // 4. POST /staff or /users
  if (primaryResource === 'staff' || primaryResource === 'users') {
    const id = payload.id || generateId('usr');
    const newUser = {
      ...payload,
      id,
      accountStatus: payload.accountStatus || 'ACTIVE',
      isActive: payload.isActive !== false,
      createdAt: now,
      updatedAt: now
    };
    await rtdbSet(rtdbRef(rtdb, `users/${id}`), newUser);
    await touchSync();
    return newUser;
  }

  // 5. POST /battery-warranties
  if (primaryResource === 'battery-warranties') {
    if (subAction === 'claims') {
      const claimId = generateId('bwc');
      const claimNumber = generateNumber('BWC');
      const claim = {
        ...payload,
        id: claimId,
        claimNumber,
        processedById: currentUser?.id || 'usr_staff',
        processedByName: currentUser?.name || 'Staff Member',
        createdAt: now,
        updatedAt: now
      };
      await rtdbSet(rtdbRef(rtdb, `batteryWarrantyClaims/${claimId}`), claim);
      await touchSync();
      return claim;
    }

    const id = payload.id || generateId('bw');
    const warrantyNumber = payload.warrantyNumber || generateNumber('BW');
    const newWarranty = {
      ...payload,
      id,
      warrantyNumber,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };
    await rtdbSet(rtdbRef(rtdb, `batteryWarranties/${id}`), newWarranty);
    await touchSync();
    return newWarranty;
  }

  // 6. POST /couriers
  if (primaryResource === 'couriers') {
    const id = payload.id || generateId('cour');
    const newCourier = {
      ...payload,
      id,
      createdAt: now,
      updatedAt: now
    };
    await rtdbSet(rtdbRef(rtdb, `couriers/${id}`), newCourier);
    await touchSync();
    return newCourier;
  }

  // 7. POST /attendance
  if (primaryResource === 'attendance') {
    const id = payload.id || generateId('att');
    const newAttendance = {
      ...payload,
      id,
      markedById: currentUser?.id || 'usr_staff',
      markedByName: currentUser?.name || 'Staff',
      markedByRole: currentUser?.role || 'STAFF',
      createdAt: now,
      updatedAt: now
    };
    await rtdbSet(rtdbRef(rtdb, `attendances/${id}`), newAttendance);
    await touchSync();
    return newAttendance;
  }

  // 8. POST /damage-records
  if (primaryResource === 'damage-records') {
    const id = payload.id || generateId('rrd');
    const recordNumber = payload.recordNumber || generateNumber('RRD');
    const newDamage = {
      ...payload,
      id,
      recordNumber,
      recordedById: currentUser?.id || 'usr_staff',
      recordedByName: currentUser?.name || 'Staff Member',
      recordedByRole: currentUser?.role || 'STAFF',
      createdAt: now,
      updatedAt: now
    };
    await rtdbSet(rtdbRef(rtdb, `damageRecords/${id}`), newDamage);
    await touchSync();
    return newDamage;
  }

  // 9. POST /repair-prices
  if (primaryResource === 'repair-prices') {
    if (subAction === 'bulk-delete') {
      const ids: string[] = payload.ids || [];
      for (const id of ids) {
        await rtdbRemove(rtdbRef(rtdb, `repairPrices/${id}`));
      }
      await touchSync();
      return { success: true, count: ids.length };
    }

    const id = payload.id || generateId('rp');
    const newPrice = {
      ...payload,
      id,
      createdAt: now,
      updatedAt: now
    };
    await rtdbSet(rtdbRef(rtdb, `repairPrices/${id}`), newPrice);
    await touchSync();
    return newPrice;
  }

  // 10. POST /notifications
  if (primaryResource === 'notifications') {
    const id = payload.id || generateId('notif');
    const newNotif = {
      ...payload,
      id,
      isRead: false,
      createdAt: now
    };
    await rtdbSet(rtdbRef(rtdb, `notifications/${id}`), newNotif);
    await touchSync();
    return newNotif;
  }

  return { success: true, message: 'Saved successfully' };
}

/**
 * Handle PATCH / PUT Persistence
 */
export async function handleFirebaseUpdate(cleanEndpoint: string, payload: any): Promise<any> {
  if (!rtdb) throw new Error('Firebase Database not initialized');
  await ensureFirebaseAuth().catch(() => {});

  const path = cleanEndpoint.split('?')[0].replace(/^\/+/, '').replace(/\/+$/, '');
  const segments = path.split('/');
  const primaryResource = segments[0];
  const resourceId = segments[1];

  const now = new Date().toISOString();
  const updates = { ...payload, updatedAt: now };

  let targetCollection = primaryResource;
  if (primaryResource === 'staff') targetCollection = 'users';
  if (primaryResource === 'battery-warranties') targetCollection = 'batteryWarranties';
  if (primaryResource === 'damage-records') targetCollection = 'damageRecords';
  if (primaryResource === 'repair-prices') targetCollection = 'repairPrices';

  if (resourceId) {
    const targetRef = rtdbRef(rtdb, `${targetCollection}/${resourceId}`);
    await rtdbUpdate(targetRef, updates);
    const snap = await rtdbGet(targetRef);
    await touchSync();
    return snap.val() || { id: resourceId, ...updates };
  }

  // Handle /profile
  if (primaryResource === 'profile') {
    const currentUser = useAuthStore.getState().user;
    if (currentUser?.id) {
      const userRef = rtdbRef(rtdb, `users/${currentUser.id}`);
      await rtdbUpdate(userRef, updates);
      await touchSync();
      return { ...currentUser, ...updates };
    }
  }

  return { success: true, ...updates };
}

/**
 * Handle DELETE Persistence
 */
export async function handleFirebaseDelete(cleanEndpoint: string): Promise<any> {
  if (!rtdb) throw new Error('Firebase Database not initialized');
  await ensureFirebaseAuth().catch(() => {});

  const path = cleanEndpoint.split('?')[0].replace(/^\/+/, '').replace(/\/+$/, '');
  const segments = path.split('/');
  const primaryResource = segments[0];
  const resourceId = segments[1];

  let targetCollection = primaryResource;
  if (primaryResource === 'staff') targetCollection = 'users';
  if (primaryResource === 'battery-warranties') targetCollection = 'batteryWarranties';
  if (primaryResource === 'damage-records') targetCollection = 'damageRecords';
  if (primaryResource === 'repair-prices') targetCollection = 'repairPrices';

  if (resourceId) {
    // For customers, soft archive
    if (primaryResource === 'customers') {
      await rtdbUpdate(rtdbRef(rtdb, `customers/${resourceId}`), {
        archived: true,
        archivedAt: new Date().toISOString()
      });
    } else {
      await rtdbRemove(rtdbRef(rtdb, `${targetCollection}/${resourceId}`));
    }
    await touchSync();
    return { success: true, id: resourceId };
  }

  return { success: true };
}
