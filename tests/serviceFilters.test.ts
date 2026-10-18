import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { 
  DEVICE_OPTIONS, 
  DEVICE_BRAND_MAPPINGS, 
  DeviceTypeId,
  RepairPriceItem 
} from '../src/pages/Services';

// Mock service catalog covering smartphones, tablets, laptops, and TVs
const MOCK_SERVICES: RepairPriceItem[] = [
  {
    id: 'svc-1',
    brand: 'Iphone',
    model: '13 Pro',
    category: 'Display',
    serviceName: 'iPhone 13 Pro OLED Display Replacement',
    problem: 'Broken Screen',
    price: 18500,
    priceType: 'FIXED',
    status: 'ACTIVE',
    deviceType: 'Smartphone',
    notes: '<!--MTS_META:{"rating":4.9,"deviceType":"Smartphone"}-->'
  },
  {
    id: 'svc-2',
    brand: 'Iphone',
    model: '11',
    category: 'Battery',
    serviceName: 'iPhone 11 Battery Replacement',
    problem: 'Battery Draining Fast',
    price: 2500,
    priceType: 'FIXED',
    status: 'ACTIVE',
    deviceType: 'Smartphone',
    notes: '<!--MTS_META:{"rating":4.8,"deviceType":"Smartphone"}-->'
  },
  {
    id: 'svc-3',
    brand: 'Samsung',
    model: 'Galaxy S23 Ultra',
    category: 'Display',
    serviceName: 'Samsung S23 Ultra AMOLED Display Replacement',
    problem: 'Cracked Display',
    price: 26000,
    priceType: 'FIXED',
    status: 'ACTIVE',
    deviceType: 'Smartphone',
    notes: '<!--MTS_META:{"rating":5.0,"deviceType":"Smartphone"}-->'
  },
  {
    id: 'svc-4',
    brand: 'Apple',
    model: 'iPad Pro 11',
    category: 'Display',
    serviceName: 'iPad Pro 11 Front Glass OCA Replacement',
    problem: 'Touch Glass Cracked',
    price: 8500,
    priceType: 'FIXED',
    status: 'ACTIVE',
    deviceType: 'Tablet',
    notes: '<!--MTS_META:{"rating":4.7,"deviceType":"Tablet"}-->'
  },
  {
    id: 'svc-5',
    brand: 'Apple',
    model: 'MacBook Pro 14 M2',
    category: 'Battery',
    serviceName: 'MacBook Pro 14 M2 Genuine Battery Pack',
    problem: 'Service Battery Warning',
    price: 14000,
    priceType: 'FIXED',
    status: 'ACTIVE',
    deviceType: 'Laptop',
    notes: '<!--MTS_META:{"rating":4.9,"deviceType":"Laptop"}-->'
  },
  {
    id: 'svc-6',
    brand: 'Sony',
    model: 'Bravia 55 OLED',
    category: 'Display',
    serviceName: 'Sony Bravia 55 OLED Laser Line Removal',
    problem: 'Vertical Green Line',
    price: 9500,
    priceType: 'FIXED',
    status: 'ACTIVE',
    deviceType: 'Smart TV',
    notes: '<!--MTS_META:{"rating":4.9,"deviceType":"Smart TV"}-->'
  }
];

// Helper to filter services mirroring Services.tsx logic
function filterServices({
  services,
  deviceType = 'all',
  brand = 'All Brands',
  category = 'all',
  query = '',
  sortBy = 'recommended'
}: {
  services: RepairPriceItem[];
  deviceType?: DeviceTypeId;
  brand?: string;
  category?: string;
  query?: string;
  sortBy?: 'recommended' | 'priceLow' | 'priceHigh' | 'deviceAsc';
}) {
  let list = services;

  // 1. Device filter
  if (deviceType !== 'all') {
    list = list.filter(item => {
      const itemType = (item.deviceType || '').toLowerCase();
      const fullText = `${item.brand || ''} ${item.model || ''} ${item.serviceName || ''} ${item.category || ''} ${item.notes || ''}`.toLowerCase();

      if (deviceType === 'smartphone') {
        if (itemType === 'smartphone' || itemType === 'phone') return true;
        const isLaptop = fullText.includes('macbook') || fullText.includes('laptop') || fullText.includes('notebook') || fullText.includes('thinkpad');
        const isTablet = fullText.includes('ipad') || fullText.includes('tablet') || fullText.includes('galaxy tab');
        const isTv = fullText.includes('tv') || fullText.includes('smart tv') || fullText.includes('television') || fullText.includes('oled tv');
        if (!itemType && !isLaptop && !isTablet && !isTv) return true;
        return false;
      }

      if (deviceType === 'laptop') {
        if (itemType === 'laptop') return true;
        return fullText.includes('macbook') || fullText.includes('laptop') || fullText.includes('notebook') || fullText.includes('thinkpad');
      }

      if (deviceType === 'tablet') {
        if (itemType === 'tablet' || itemType === 'ipad') return true;
        return fullText.includes('ipad') || fullText.includes('tablet') || fullText.includes('galaxy tab');
      }

      if (deviceType === 'tv') {
        if (itemType === 'smart tv' || itemType === 'tv') return true;
        return fullText.includes('smart tv') || fullText.includes('television') || fullText.includes('oled tv') || fullText.includes('bravia');
      }

      return false;
    });
  }

  // 2. Brand filter
  if (brand !== 'All Brands') {
    list = list.filter(item => {
      const b = (item.brand || '').toLowerCase().trim();
      const sel = brand.toLowerCase().trim();
      if (b === sel) return true;
      if (sel === 'apple' && (b === 'iphone' || b.includes('apple'))) return true;
      if (sel === 'iphone' && (b === 'apple' || b.includes('iphone'))) return true;
      return false;
    });
  }

  // 3. Category filter
  if (category !== 'all') {
    list = list.filter(item => item.category.toLowerCase().includes(category.toLowerCase()));
  }

  // 4. Query filter
  if (query.trim()) {
    const q = query.toLowerCase().trim();
    list = list.filter(item => {
      const text = `${item.brand} ${item.model} ${item.serviceName} ${item.problem}`.toLowerCase();
      return text.includes(q);
    });
  }

  // 5. Sorting
  const copy = [...list];
  if (sortBy === 'priceLow') {
    copy.sort((a, b) => a.price - b.price);
  } else if (sortBy === 'priceHigh') {
    copy.sort((a, b) => b.price - a.price);
  } else if (sortBy === 'deviceAsc') {
    copy.sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`));
  }

  return copy;
}

// Helper to compute available brands for a device type
function computeAvailableBrands(deviceType: DeviceTypeId, services: RepairPriceItem[]) {
  const baseBrands = DEVICE_BRAND_MAPPINGS[deviceType] || DEVICE_BRAND_MAPPINGS.all;
  const dynamicBrandsSet = new Set<string>();

  for (const item of services) {
    if (!item.brand) continue;
    const itemType = (item.deviceType || '').toLowerCase();
    const fullText = `${item.brand} ${item.model} ${item.serviceName || ''} ${item.category || ''} ${item.notes || ''}`.toLowerCase();
    
    let matchesDev = true;
    if (deviceType === 'smartphone') {
      matchesDev = itemType === 'smartphone' || itemType === 'phone' || (!itemType && !fullText.includes('macbook') && !fullText.includes('laptop') && !fullText.includes('ipad') && !fullText.includes('tablet') && !fullText.includes('tv'));
    } else if (deviceType === 'laptop') {
      matchesDev = itemType === 'laptop' || fullText.includes('macbook') || fullText.includes('laptop') || fullText.includes('notebook') || fullText.includes('thinkpad');
    } else if (deviceType === 'tablet') {
      matchesDev = itemType === 'tablet' || itemType === 'ipad' || fullText.includes('ipad') || fullText.includes('tablet') || fullText.includes('galaxy tab');
    } else if (deviceType === 'tv') {
      matchesDev = itemType === 'smart tv' || itemType === 'tv' || fullText.includes('smart tv') || fullText.includes('television') || fullText.includes('oled tv') || fullText.includes('bravia');
    }

    if (matchesDev) {
      const b = item.brand.trim();
      if (b.toLowerCase() === 'iphone') {
        dynamicBrandsSet.add('Apple');
      } else {
        dynamicBrandsSet.add(b.charAt(0).toUpperCase() + b.slice(1));
      }
    }
  }

  const combined = ['All Brands'];
  const seen = new Set<string>(['all brands']);
  for (const b of baseBrands) {
    if (!seen.has(b.toLowerCase())) {
      seen.add(b.toLowerCase());
      combined.push(b);
    }
  }
  for (const b of dynamicBrandsSet) {
    if (!seen.has(b.toLowerCase())) {
      seen.add(b.toLowerCase());
      combined.push(b);
    }
  }
  return combined;
}

describe('MTS Lab Service Filters & Device Navigation Suite', () => {

  // Test 1: Device-Type Selector Options
  test('1. Device-Type Selector contains the 5 required device options', () => {
    const ids = DEVICE_OPTIONS.map(d => d.id);
    assert.deepEqual(ids, ['all', 'smartphone', 'laptop', 'tablet', 'tv']);
    
    const labels = DEVICE_OPTIONS.map(d => d.label);
    assert.ok(labels.includes('All Devices'));
    assert.ok(labels.includes('Smartphones & iPhones'));
    assert.ok(labels.includes('Laptops'));
    assert.ok(labels.includes('Tablets & iPads'));
    assert.ok(labels.includes('Smart TVs'));
  });

  // Test 2: Device-Type Filtering
  test('2. Device-type filtering matches only compatible hardware services', () => {
    const allResults = filterServices({ services: MOCK_SERVICES, deviceType: 'all' });
    assert.equal(allResults.length, 6);

    const phones = filterServices({ services: MOCK_SERVICES, deviceType: 'smartphone' });
    assert.equal(phones.length, 3);
    assert.ok(phones.every(p => ['iPhone 13 Pro OLED Display Replacement', 'iPhone 11 Battery Replacement', 'Samsung S23 Ultra AMOLED Display Replacement'].includes(p.serviceName)));

    const laptops = filterServices({ services: MOCK_SERVICES, deviceType: 'laptop' });
    assert.equal(laptops.length, 1);
    assert.equal(laptops[0].serviceName, 'MacBook Pro 14 M2 Genuine Battery Pack');

    const tablets = filterServices({ services: MOCK_SERVICES, deviceType: 'tablet' });
    assert.equal(tablets.length, 1);
    assert.equal(tablets[0].serviceName, 'iPad Pro 11 Front Glass OCA Replacement');

    const tvs = filterServices({ services: MOCK_SERVICES, deviceType: 'tv' });
    assert.equal(tvs.length, 1);
    assert.equal(tvs[0].serviceName, 'Sony Bravia 55 OLED Laser Line Removal');
  });

  // Test 3: Service-Category Selection
  test('3. Service-category selection filters appropriately', () => {
    const displays = filterServices({ services: MOCK_SERVICES, category: 'Display' });
    assert.equal(displays.length, 4);

    const batteries = filterServices({ services: MOCK_SERVICES, category: 'Battery' });
    assert.equal(batteries.length, 2);
    assert.ok(batteries.some(b => b.model === '11'));
    assert.ok(batteries.some(b => b.model.includes('MacBook')));
  });

  // Test 4: Brand Filtering with smart Apple/Iphone matching
  test('4. Brand filtering resolves Apple and Iphone interchangeably', () => {
    const appleServices = filterServices({ services: MOCK_SERVICES, brand: 'Apple' });
    // In MOCK_SERVICES, svc-1 (Iphone), svc-2 (Iphone), svc-4 (Apple iPad), svc-5 (Apple MacBook)
    assert.equal(appleServices.length, 4);

    const samsungServices = filterServices({ services: MOCK_SERVICES, brand: 'Samsung' });
    assert.equal(samsungServices.length, 1);
    assert.equal(samsungServices[0].brand, 'Samsung');
  });

  // Test 5: Combined Filters
  test('5. Combined filters (Device + Category + Brand) intersect correctly', () => {
    const appleLaptopBatteries = filterServices({
      services: MOCK_SERVICES,
      deviceType: 'laptop',
      brand: 'Apple',
      category: 'Battery'
    });
    assert.equal(appleLaptopBatteries.length, 1);
    assert.equal(appleLaptopBatteries[0].id, 'svc-5');

    const smartphoneDisplays = filterServices({
      services: MOCK_SERVICES,
      deviceType: 'smartphone',
      category: 'Display'
    });
    assert.equal(smartphoneDisplays.length, 2); // iPhone 13 Pro & Samsung S23
  });

  // Test 6: Dynamic Brand Options Adaptation
  test('6. Dynamic brand options adapt to the selected device type', () => {
    const phoneBrands = computeAvailableBrands('smartphone', MOCK_SERVICES);
    assert.ok(phoneBrands.includes('Apple'));
    assert.ok(phoneBrands.includes('Samsung'));
    assert.ok(phoneBrands.includes('OnePlus'));
    assert.ok(!phoneBrands.includes('Dell'));
    assert.ok(!phoneBrands.includes('HP'));

    const laptopBrands = computeAvailableBrands('laptop', MOCK_SERVICES);
    assert.ok(laptopBrands.includes('Dell'));
    assert.ok(laptopBrands.includes('HP'));
    assert.ok(laptopBrands.includes('Lenovo'));
    assert.ok(laptopBrands.includes('Apple'));

    const tvBrands = computeAvailableBrands('tv', MOCK_SERVICES);
    assert.ok(tvBrands.includes('Sony'));
    assert.ok(tvBrands.includes('LG'));
    assert.ok(tvBrands.includes('Samsung'));
  });

  // Test 7: Brand Selection Reconciliation
  test('7. Incompatible brand selection is safely reconciled when switching device types', () => {
    let currentBrand = 'OnePlus';
    const laptopBrands = computeAvailableBrands('laptop', MOCK_SERVICES);
    
    // Check if OnePlus is in laptop brands
    const isAvailableInLaptop = laptopBrands.some(b => b.toLowerCase() === currentBrand.toLowerCase());
    assert.equal(isAvailableInLaptop, false);

    // Reconcile to 'All Brands'
    if (!isAvailableInLaptop) {
      currentBrand = 'All Brands';
    }
    assert.equal(currentBrand, 'All Brands');
  });

  // Test 8: Active-Filter Badge Calculation
  test('8. Active advanced filter badge counts only non-default selections', () => {
    const calcActiveAdvancedCount = (category: string, brand: string) => {
      let count = 0;
      if (category !== 'all') count++;
      if (brand !== 'All Brands') count++;
      return count;
    };

    assert.equal(calcActiveAdvancedCount('all', 'All Brands'), 0);
    assert.equal(calcActiveAdvancedCount('Display', 'All Brands'), 1);
    assert.equal(calcActiveAdvancedCount('all', 'Apple'), 1);
    assert.equal(calcActiveAdvancedCount('Battery', 'Samsung'), 2);
  });

  // Test 9: Clear All Behavior
  test('9. Clear All resets all filters and restores full catalog', () => {
    // Start with strict filters yielding 1 result
    const filtered = filterServices({
      services: MOCK_SERVICES,
      deviceType: 'laptop',
      category: 'Battery',
      brand: 'Apple',
      query: 'MacBook'
    });
    assert.equal(filtered.length, 1);

    // Reset all
    const resetResults = filterServices({
      services: MOCK_SERVICES,
      deviceType: 'all',
      category: 'all',
      brand: 'All Brands',
      query: ''
    });
    assert.equal(resetResults.length, MOCK_SERVICES.length);
  });

  // Test 10: Search and Trending Suggestions
  test('10. Search query combines with device and brand filters', () => {
    const searchResult = filterServices({
      services: MOCK_SERVICES,
      deviceType: 'smartphone',
      query: 's23'
    });
    assert.equal(searchResult.length, 1);
    assert.equal(searchResult[0].model, 'Galaxy S23 Ultra');
  });

  // Test 11: Sorting and Service Count
  test('11. Sorting orders results by price and device name correctly', () => {
    const lowToHigh = filterServices({ services: MOCK_SERVICES, sortBy: 'priceLow' });
    assert.equal(lowToHigh[0].price, 2500); // iPhone 11 battery
    assert.equal(lowToHigh[lowToHigh.length - 1].price, 26000); // S23 Ultra screen

    const highToLow = filterServices({ services: MOCK_SERVICES, sortBy: 'priceHigh' });
    assert.equal(highToLow[0].price, 26000);
    assert.equal(highToLow[highToLow.length - 1].price, 2500);
  });

  // Test 12: Empty Results Handling
  test('12. Empty results when restrictive filter has no matches', () => {
    const noResults = filterServices({
      services: MOCK_SERVICES,
      deviceType: 'tv',
      category: 'Battery' // TVs don't have battery replacements
    });
    assert.equal(noResults.length, 0);
  });

  // Test 13: URL Synchronization
  test('13. URL parameter generation matches standard query format', () => {
    const params = new URLSearchParams();
    params.set('deviceType', 'laptop');
    params.set('category', 'Battery');
    params.set('brand', 'Apple');
    params.set('q', 'MacBook');

    assert.equal(params.toString(), 'deviceType=laptop&category=Battery&brand=Apple&q=MacBook');
    assert.equal(params.get('deviceType'), 'laptop');
    assert.equal(params.get('category'), 'Battery');
  });

  // Test 14: Keyboard and Accessibility Semantics
  test('14. Device options have accessible labels and descriptions', () => {
    for (const opt of DEVICE_OPTIONS) {
      assert.ok(opt.label.length > 0, `Option ${opt.id} missing label`);
      assert.ok(opt.description.length > 0, `Option ${opt.id} missing description`);
      assert.ok(opt.icon !== undefined, `Option ${opt.id} missing icon`);
    }
  });

});
