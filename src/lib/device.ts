/**
 * Device metadata detection & secure persistent identifier management
 */

export interface DeviceInfo {
  deviceIdentifier: string;
  deviceName: string;
  deviceType: 'SMARTPHONE' | 'TABLET' | 'LAPTOP' | 'DESKTOP';
  browser: string;
  os: string;
  userAgent: string;
}

export function getDeviceIdentifier(): string {
  if (typeof window === 'undefined') return 'server-device';
  
  const KEY = 'mts_device_id_v2';
  let id = localStorage.getItem(KEY);
  if (!id || id.length < 16) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      id = crypto.randomUUID();
    } else {
      id = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    }
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function getDeviceDetails(): DeviceInfo {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const id = getDeviceIdentifier();

  // Detect OS
  let os = 'Unknown OS';
  if (/iPad|iPhone|iPod/.test(ua)) {
    os = 'iOS';
  } else if (/Android/.test(ua)) {
    os = 'Android';
  } else if (/Macintosh|Mac OS X/.test(ua)) {
    os = 'macOS';
  } else if (/Windows NT 10.0/.test(ua)) {
    os = 'Windows 11 / 10';
  } else if (/Windows NT/.test(ua)) {
    os = 'Windows';
  } else if (/CrOS/.test(ua)) {
    os = 'ChromeOS';
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
  }

  // Detect Browser
  let browser = 'Unknown Browser';
  if (/Edg\//.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/Chrome\//.test(ua) && !/Chromium|Edg/.test(ua)) {
    browser = 'Google Chrome';
  } else if (/Safari\//.test(ua) && !/Chrome|Chromium/.test(ua)) {
    browser = 'Apple Safari';
  } else if (/Firefox\//.test(ua)) {
    browser = 'Mozilla Firefox';
  } else if (/SamsungBrowser/.test(ua)) {
    browser = 'Samsung Internet';
  } else if (/OPR|Opera/.test(ua)) {
    browser = 'Opera';
  }

  // Detect Device Type
  let deviceType: 'SMARTPHONE' | 'TABLET' | 'LAPTOP' | 'DESKTOP' = 'DESKTOP';
  const isTouch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
  const width = typeof window !== 'undefined' ? window.innerWidth : 1200;

  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (isTouch && width >= 600 && width <= 1024 && os !== 'iOS' && os !== 'Android')) {
    deviceType = 'TABLET';
  } else if (/Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (isTouch && width < 600)) {
    deviceType = 'SMARTPHONE';
  } else if (os === 'macOS' || (isTouch && width > 1024) || /Laptop|Notebook/i.test(ua)) {
    deviceType = 'LAPTOP';
  } else {
    deviceType = 'DESKTOP';
  }

  // User-friendly Device Name
  let deviceName = `${browser} on ${os}`;
  if (deviceType === 'SMARTPHONE') {
    if (os === 'iOS') {
      deviceName = 'Apple iPhone';
    } else if (os === 'Android') {
      if (/Samsung/i.test(ua)) deviceName = 'Samsung Galaxy Smartphone';
      else if (/Pixel/i.test(ua)) deviceName = 'Google Pixel Smartphone';
      else if (/Xiaomi|Redmi/i.test(ua)) deviceName = 'Xiaomi Smartphone';
      else deviceName = 'Android Smartphone';
    } else {
      deviceName = 'Smartphone Device';
    }
  } else if (deviceType === 'TABLET') {
    if (os === 'iOS') deviceName = 'Apple iPad';
    else if (os === 'Android') deviceName = 'Android Tablet';
    else deviceName = 'Tablet Device';
  } else if (deviceType === 'LAPTOP') {
    if (os === 'macOS') deviceName = 'Apple MacBook';
    else deviceName = `${os} Laptop`;
  } else {
    deviceName = `${os} Workstation`;
  }

  return {
    deviceIdentifier: id,
    deviceName,
    deviceType,
    browser,
    os,
    userAgent: ua,
  };
}

/**
 * Standard brand casing lookup
 */
export const BRAND_CASING: Record<string, string> = {
  apple: 'Apple',
  samsung: 'Samsung',
  xiaomi: 'Xiaomi',
  redmi: 'Redmi',
  oneplus: 'OnePlus',
  google: 'Google',
  vivo: 'Vivo',
  oppo: 'Oppo',
  realme: 'Realme',
  honor: 'Honor',
  huawei: 'Huawei',
  sony: 'Sony',
  motorola: 'Motorola',
  nokia: 'Nokia',
  nothing: 'Nothing',
  asus: 'ASUS',
  lenovo: 'Lenovo',
  dell: 'Dell',
  hp: 'HP',
  acer: 'Acer',
};

export interface FormattedDevice {
  brand: string;
  model: string;
  fullName: string;
}

/**
 * Format brand and model safely, combining abbreviations like "apple 12" -> "Apple iPhone 12",
 * "samsung S23 ultra" -> "Samsung S23 Ultra", "google pixel 7" -> "Google Pixel 7".
 */
export function formatDeviceName(rawBrand?: string | null, rawModel?: string | null): FormattedDevice {
  const cleanBrand = (rawBrand || '').trim();
  let model = (rawModel || '').trim();

  if (!cleanBrand && !model) {
    return {
      brand: 'Smartphone',
      model: 'Model Unspecified',
      fullName: 'Smartphone (Model Unspecified)',
    };
  }

  let brand = cleanBrand
    ? BRAND_CASING[cleanBrand.toLowerCase()] || (cleanBrand.charAt(0).toUpperCase() + cleanBrand.slice(1))
    : '';

  // If brand is 'Other' or empty, check if model starts with a known brand (e.g. "Honor 8x")
  if (!brand || brand.toLowerCase() === 'other') {
    for (const [key, pretty] of Object.entries(BRAND_CASING)) {
      const regex = new RegExp('^' + key + '\\b', 'i');
      if (regex.test(model)) {
        brand = pretty;
        model = model.replace(regex, '').trim();
        break;
      }
    }
  }

  // Handle Apple devices (e.g. '12', '13 pro max', 'ip 11', 'xs max', 'iphone 14')
  if (brand.toLowerCase() === 'apple' || /^(iphone|ipad|ipod|macbook)\b/i.test(model)) {
    brand = 'Apple';
    if (!model) {
      model = 'iPhone';
    } else {
      // Normalize 'ip 15' or 'ip15' to 'iPhone 15'
      model = model.replace(/^ip\s*(\d+)/i, 'iPhone $1');
      model = model.replace(/^ip\s+/i, 'iPhone ');
      // If it starts with just a number or series like '12', '12 pro', '13 pro max', 'xs max'
      if (/^(\d{1,2}|xs|xr|x|se)\b/i.test(model)) {
        model = 'iPhone ' + model;
      }
      // Ensure 'iphone' is cased as 'iPhone'
      model = model.replace(/^iphone\b/i, 'iPhone');
      // Fix typos like 'pron max' -> 'Pro Max'
      model = model.replace(/\bpron\b/gi, 'Pro');
      // Capitalize standard Apple suffixes
      model = model
        .replace(/\bpro\b/gi, 'Pro')
        .replace(/\bmax\b/gi, 'Max')
        .replace(/\bmini\b/gi, 'Mini')
        .replace(/\bplus\b/gi, 'Plus')
        .replace(/\bultra\b/gi, 'Ultra')
        .replace(/\bse\b/gi, 'SE')
        .replace(/\bxs\b/gi, 'XS')
        .replace(/\bxr\b/gi, 'XR')
        .replace(/\bx\b/gi, 'X');
    }
  }

  // Handle Samsung devices (e.g. 'S23 ultra', 'note 9', 'J7prime')
  if (brand.toLowerCase() === 'samsung') {
    brand = 'Samsung';
    if (model) {
      model = model
        .replace(/\bultra\b/gi, 'Ultra')
        .replace(/\bplus\b/gi, 'Plus')
        .replace(/\bprime\b/gi, 'Prime')
        .replace(/\bfe\b/gi, 'FE')
        .replace(/\bnote\b/gi, 'Note');
    }
  }

  // Handle OnePlus devices ('1+7 pro' -> '7 Pro')
  if (brand.toLowerCase() === 'oneplus') {
    brand = 'OnePlus';
    if (/^1\+\s*/.test(model)) {
      model = model.replace(/^1\+\s*/, '');
    }
  }

  // Handle Google devices ('pixel 7' -> 'Pixel 7')
  if (brand.toLowerCase() === 'google' || /^pixel\b/i.test(model)) {
    brand = 'Google';
    if (/^pixel\b/i.test(model)) {
      model = model.replace(/^pixel\b/i, 'Pixel');
    }
  }

  // Handle Xiaomi / Redmi
  if (brand.toLowerCase() === 'xiaomi' || brand.toLowerCase() === 'redmi') {
    if (/^redmi\b/i.test(model)) {
      model = model.replace(/^redmi\b/i, 'Redmi');
    }
  }

  // If brand is still unspecified or 'Other'
  if (!brand || brand.toLowerCase() === 'other') {
    brand = model ? 'Device' : 'Smartphone';
  }

  // Construct full name without duplicating brand
  let fullName = '';
  if (brand && model) {
    if (model.toLowerCase().startsWith(brand.toLowerCase())) {
      fullName = model;
    } else {
      fullName = `${brand} ${model}`;
    }
  } else if (brand) {
    fullName = `${brand} Device`;
  } else if (model) {
    fullName = model;
  } else {
    fullName = 'Smartphone (Model Unspecified)';
  }

  return {
    brand,
    model: model || 'Model Unspecified',
    fullName: fullName.trim(),
  };
}

/**
 * Safely extract device data from any repair record (supporting both camelCase and snake_case)
 */
export function getRepairDeviceDisplay(repair: any): FormattedDevice & { imei: string; color: string; condition: string; accessories: string } {
  if (!repair || typeof repair !== 'object') {
    return {
      brand: 'Smartphone',
      model: 'Model Unspecified',
      fullName: 'Smartphone (Model Unspecified)',
      imei: 'N/A',
      color: 'Standard',
      condition: 'Normal',
      accessories: 'None',
    };
  }

  const rawBrand = repair.deviceBrand || repair.device_brand || repair.brand || '';
  const rawModel = repair.deviceModel || repair.device_model || repair.model || '';
  const imei = repair.imeiNumber || repair.imei_sn || repair.imei || repair.serialNumber || 'N/A';
  const color = repair.deviceColor || repair.device_color || repair.color || 'Standard';
  const condition = repair.deviceCondition || repair.device_condition || repair.condition || 'Normal';
  const accessories = repair.accessoriesReceived || repair.accessories_received || repair.accessories || 'None';

  const formatted = formatDeviceName(rawBrand, rawModel);

  return {
    ...formatted,
    imei,
    color,
    condition,
    accessories,
  };
}

