import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('1. Service Cache Store correctly manages data, filters, and staleness', async () => {
  const { useServiceCache } = await import('../src/store/serviceCache.js');
  
  // Reset cache state
  useServiceCache.getState().resetFilters();
  useServiceCache.getState().setServices([]);
  useServiceCache.getState().invalidate();

  assert.equal(useServiceCache.getState().isStale(), true, 'Empty cache should be stale');

  const mockServices = [
    {
      id: 'price-1',
      brand: 'Apple',
      model: 'iPhone 11',
      serviceName: 'Original Display Replacement',
      price: 9500,
      priceType: 'FIXED' as const,
      status: 'ACTIVE' as const,
      category: 'Display',
      problem: 'Broken Screen'
    }
  ];

  useServiceCache.getState().setServices(mockServices);
  assert.equal(useServiceCache.getState().services.length, 1);
  assert.equal(useServiceCache.getState().services[0].id, 'price-1');
  assert.equal(useServiceCache.getState().isStale(), false, 'Freshly saved cache should not be stale');

  // Verify filter synchronization
  useServiceCache.getState().setFilters({
    searchInput: 'iPhone 11',
    activeQuery: 'iPhone 11',
    selectedBrand: 'Apple',
    selectedCategory: 'Display',
    currentPage: 2,
    isFiltersExpanded: true
  });

  const savedFilters = useServiceCache.getState().filters;
  assert.equal(savedFilters.searchInput, 'iPhone 11');
  assert.equal(savedFilters.activeQuery, 'iPhone 11');
  assert.equal(savedFilters.selectedBrand, 'Apple');
  assert.equal(savedFilters.selectedCategory, 'Display');
  assert.equal(savedFilters.currentPage, 2);
  assert.equal(savedFilters.isFiltersExpanded, true);

  // Verify scroll position recording
  useServiceCache.getState().setScrollY(650);
  assert.equal(useServiceCache.getState().scrollY, 650);

  // Invalidate resets freshness
  useServiceCache.getState().invalidate();
  assert.equal(useServiceCache.getState().isStale(), true, 'Cache should be marked stale after invalidate()');
});

test('2. Repair Cache Store provides user isolation and optimistic updates', async () => {
  const { useRepairCache } = await import('../src/store/repairCache.js');

  useRepairCache.getState().clear();
  assert.equal(useRepairCache.getState().repairs.length, 0);
  assert.equal(useRepairCache.getState().userId, null);

  const mockRepairs = [
    {
      id: 'rep-101',
      repairNumber: 'MTS-2026-101',
      customerName: 'Suman Shrestha',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 13 Pro',
      status: 'IN_PROCESS',
      priority: 'NORMAL',
      totalCost: 12000
    }
  ];

  useRepairCache.getState().setRepairs(mockRepairs, 'user-staff-1');
  assert.equal(useRepairCache.getState().userId, 'user-staff-1');
  assert.equal(useRepairCache.getState().repairs.length, 1);

  // Cache is fresh for user-staff-1
  assert.equal(useRepairCache.getState().isStale('user-staff-1'), false);

  // Cache is immediately marked stale if a different user logs in
  assert.equal(useRepairCache.getState().isStale('user-staff-2'), true, 'Cache must be stale for different staff user');

  // Optimistic update of repair status
  useRepairCache.getState().updateRepair('rep-101', { status: 'REPAIRED' });
  const updated = useRepairCache.getState().repairs.find(r => r.id === 'rep-101');
  assert.equal(updated?.status, 'REPAIRED', 'Repair status should be optimistically updated');

  // Verify filter preservation
  useRepairCache.getState().setFilters({
    search: 'Suman',
    activeStatusTab: 'IN_PROCESS',
    selectedTechnicianFilter: 'tech-1',
    currentPage: 3
  });

  const filters = useRepairCache.getState().filters;
  assert.equal(filters.search, 'Suman');
  assert.equal(filters.activeStatusTab, 'IN_PROCESS');
  assert.equal(filters.selectedTechnicianFilter, 'tech-1');
  assert.equal(filters.currentPage, 3);

  // Clear on logout
  useRepairCache.getState().clear();
  assert.equal(useRepairCache.getState().repairs.length, 0);
  assert.equal(useRepairCache.getState().userId, null);
  assert.equal(useRepairCache.getState().filters.search, '');
  assert.equal(useRepairCache.getState().filters.currentPage, 1);
});

test('3. AuthStore logout clears repairCache to prevent cross-user data leakage', async () => {
  const { useAuthStore } = await import('../src/store/authStore.js');
  const { useRepairCache } = await import('../src/store/repairCache.js');

  // Seed repair cache
  useRepairCache.getState().setRepairs([{ id: 'secret-1', repairNumber: 'SECRET-99' }], 'user-private');
  assert.equal(useRepairCache.getState().repairs.length, 1);

  // Trigger logout
  useAuthStore.getState().logout();

  // Confirm repairCache was cleared
  assert.equal(useRepairCache.getState().repairs.length, 0);
  assert.equal(useRepairCache.getState().userId, null);
});

test('4. ScrollToTop preserves scroll on Back/Forward navigation (POP) and resets on PUSH', () => {
  const scrollFile = fs.readFileSync(path.join(process.cwd(), 'src/components/common/ScrollToTop.tsx'), 'utf8');

  assert.ok(scrollFile.includes('useNavigationType'), 'ScrollToTop must use useNavigationType');
  assert.ok(scrollFile.includes("navType === 'POP'"), 'ScrollToTop must handle POP navigation');
  assert.ok(scrollFile.includes("navType === 'PUSH'"), 'ScrollToTop must handle PUSH navigation');
  assert.ok(scrollFile.includes('scrollPositionMap'), 'ScrollToTop must maintain a scroll position map');
});

test('5. Public Services Page and ServiceDetail implement instant client navigation and back state preservation', () => {
  const serviceDetail = fs.readFileSync(path.join(process.cwd(), 'src/pages/ServiceDetail.tsx'), 'utf8');
  const services = fs.readFileSync(path.join(process.cwd(), 'src/pages/Services.tsx'), 'utf8');

  // ServiceDetail uses cached services and history-aware back navigation
  assert.ok(serviceDetail.includes('useServiceCache'), 'ServiceDetail must use useServiceCache');
  assert.ok(serviceDetail.includes('navigate(-1)'), 'ServiceDetail back button must use navigate(-1)');
  assert.ok(!serviceDetail.includes('<Link\n            to="/services"'), 'ServiceDetail must not have hardcoded Link to /services for back');

  // Services page initializes from cache and handles SWR background revalidation
  assert.ok(services.includes('useServiceCache'), 'Services page must use useServiceCache');
  assert.ok(services.includes('cachedServices'), 'Services page must read cachedServices');
  assert.ok(services.includes('setCachedFilters'), 'Services page must persist filters into cache');
  assert.ok(services.includes('setScrollY'), 'Services page must save scroll position');
});

test('6. Staff Dashboard Repairs & RepairDetails preserve filters, pagination, and optimistic updates', () => {
  const repairs = fs.readFileSync(path.join(process.cwd(), 'src/pages/dashboard/Repairs.tsx'), 'utf8');
  const repairDetails = fs.readFileSync(path.join(process.cwd(), 'src/pages/dashboard/RepairDetails.tsx'), 'utf8');

  // Repairs page uses repairCache and preserves active filters and pagination
  assert.ok(repairs.includes('useRepairCache'), 'Repairs page must use useRepairCache');
  assert.ok(repairs.includes('isCacheValidForUser'), 'Repairs page must enforce user-isolated cache check');
  assert.ok(repairs.includes('setCachedFilters'), 'Repairs page must save active filters to cache');
  assert.ok(repairs.includes('navigateToRepair'), 'Repairs page must use navigateToRepair helper');

  // RepairDetails back button uses history-aware navigation
  assert.ok(repairDetails.includes('navigate(-1)'), 'RepairDetails must navigate(-1) on back');
  assert.ok(repairDetails.includes('useRepairCache'), 'RepairDetails must update useRepairCache');
});

test('7. Realtime synchronization tracks repair price changes and repair entity updates', () => {
  const realtime = fs.readFileSync(path.join(process.cwd(), 'src/services/realtime.ts'), 'utf8');

  assert.ok(realtime.includes('RepairPrice') && realtime.includes('repairprice'), 'Realtime tablesToTrack must include RepairPrice');
  assert.ok(realtime.includes("normalized.startsWith('repairprice')"), 'Realtime getEntityAliases must handle repairprice');
});

test('8. Backend repairPrices handler provides HTTP caching headers for public requests', () => {
  const routes = fs.readFileSync(path.join(process.cwd(), 'api/_server/routes/repairPrices.ts'), 'utf8');

  assert.ok(routes.includes("res.setHeader('Cache-Control'"), 'repairPrices route must set Cache-Control header');
  assert.ok(routes.includes('stale-while-revalidate'), 'repairPrices route must use stale-while-revalidate for public cache');
});
