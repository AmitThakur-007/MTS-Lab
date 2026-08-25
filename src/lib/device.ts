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
