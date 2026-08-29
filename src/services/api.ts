import { useAuthStore } from '@/store/authStore';

const getApiBase = (): string => {
  const envUrl = (
    (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL)) ||
    ''
  ).trim();

  if (!envUrl) {
    return '/api';
  }
  const cleanUrl = envUrl.replace(/\/+$/, '');
  return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
};

export const API_BASE = getApiBase();

export function normalizeEndpoint(endpoint: string): string {
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (clean.startsWith('/api/')) {
    return clean.slice(4);
  }
  if (clean === '/api') {
    return '';
  }
  return clean;
}

function isServerAuthoritativeEndpoint(cleanEndpoint: string): boolean {
  return (
    cleanEndpoint.startsWith('/auth') ||
    cleanEndpoint.startsWith('/users') ||
    cleanEndpoint.startsWith('/admin') ||
    cleanEndpoint.startsWith('/system') ||
    cleanEndpoint.startsWith('/access-requests') ||
    cleanEndpoint.startsWith('/wipe') ||
    cleanEndpoint.startsWith('/backup')
  );
}

// Global callback to trigger InactivityGuard logout flow from api.ts (set by InactivityGuard on mount)
let _onInactivityExpired: (() => void) | null = null;
export function registerInactivityExpiredHandler(handler: () => void) {
  _onInactivityExpired = handler;
}

let refreshPromise: Promise<string | null> | null = null;

async function doRefreshToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const { token, refreshToken, setToken, setRefreshToken, updateUser, logout } = useAuthStore.getState();
      
      const refreshHeaders: any = { 
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
      if (refreshToken) {
        refreshHeaders['x-refresh-token'] = refreshToken;
      }
      
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, { 
        method: 'POST',
        headers: refreshHeaders,
        body: JSON.stringify({ refreshToken }),
        credentials: 'include'
      });

      if (refreshRes.ok) {
        let refreshData: any = {};
        const refreshText = await refreshRes.text();
        try {
          refreshData = refreshText ? JSON.parse(refreshText) : {};
        } catch {
          console.warn("[REFRESH PARSE] Non-JSON session refresh response:", refreshText);
          throw new Error("Invalid session refresh response from server.");
        }
        
        const { token: newToken, refreshToken: newRefreshToken, user: updatedUser } = refreshData;
        if (newToken) {
          setToken(newToken);
          if (newRefreshToken) {
            setRefreshToken(newRefreshToken);
          }
          if (updatedUser) {
            updateUser(updatedUser);
          }
          return newToken;
        }
      }
      
      if (refreshRes.status === 401 || refreshRes.status === 403) {
        // Check if this is specifically an inactivity expiry vs. other auth failure
        try {
          const errData = await refreshRes.json().catch(() => ({})) as any;
          if (errData?.error === 'InactivityExpired') {
            // 2-hour inactivity: fire global handler (shows warning then redirects to /login?reason=inactivity)
            if (_onInactivityExpired) {
              _onInactivityExpired();
            } else {
              logout();
              window.location.href = '/login?reason=inactivity';
            }
            return null;
          }
        } catch {
          // ignore
        }
        // Refresh token is revoked or expired on server
        logout();
        return null;
      }
      
      return null;
    } catch (err) {
      console.warn("[REFRESH RESILIENCE NOTICE] Network interruption during session refresh; preserving session.");
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}


import { 
  handleFirebaseGet, 
  handleFirebasePost, 
  handleFirebaseUpdate, 
  handleFirebaseDelete 
} from './firebasePersistence';

async function request(endpoint: string, options: any = {}) {
  const { token } = useAuthStore.getState();
  const cleanEndpoint = normalizeEndpoint(endpoint);
  const method = (options.method || 'GET').toUpperCase();
  
  let headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let res: any;
  let serverData: any = null;
  let serverHandled = false;

  try {
    res = await fetch(`${API_BASE}${cleanEndpoint}`, { 
      ...options, 
      headers,
      credentials: 'include'
    });

    // Handle token expiration & automatic seamless renewal on 401
    if (res && res.status === 401 && token && !cleanEndpoint.includes('/auth/refresh') && !cleanEndpoint.includes('/auth/login')) {
      const newToken = await doRefreshToken();
      if (newToken) {
        headers = {
          ...options.headers,
          Authorization: `Bearer ${newToken}`
        };
        res = await fetch(`${API_BASE}${cleanEndpoint}`, {
          ...options,
          headers,
          credentials: 'include'
        });
      }
    }

    if (res && res.ok) {
      const rawSuccessText = await res.text();
      if (rawSuccessText && rawSuccessText.trim()) {
        try {
          serverData = JSON.parse(rawSuccessText);
        } catch {
          serverData = rawSuccessText;
        }
      }
      // If server returned a dummy serverless fallback on a data route, trigger Firebase persistence
      if (serverData && serverData.service === 'MTS Lab Serverless API' && !isServerAuthoritativeEndpoint(cleanEndpoint)) {
        serverHandled = false;
      } else {
        serverHandled = true;
        return serverData;
      }
    }
  } catch (netErr: any) {
    serverHandled = false;
  }

  // Handle Firebase Direct Cloud Persistence Fallback ONLY if server was completely unreachable (offline/network error)
  // and NEVER on server-authoritative endpoints (users, admin, auth, system, access-requests, wipe)
  if (!serverHandled && !res && !isServerAuthoritativeEndpoint(cleanEndpoint)) {
    try {
      if (method === 'GET') {
        const fbResult = await handleFirebaseGet(cleanEndpoint);
        if (fbResult !== null) return fbResult;
      } else if (method === 'POST') {
        const parsedBody = options.body 
          ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body)
          : {};
        const fbResult = await handleFirebasePost(cleanEndpoint, parsedBody);
        if (fbResult !== null) return fbResult;
      } else if (method === 'PATCH' || method === 'PUT') {
        const parsedBody = options.body 
          ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body)
          : {};
        const fbResult = await handleFirebaseUpdate(cleanEndpoint, parsedBody);
        if (fbResult !== null) return fbResult;
      } else if (method === 'DELETE') {
        const fbResult = await handleFirebaseDelete(cleanEndpoint);
        if (fbResult !== null) return fbResult;
      }
    } catch (fbErr) {
      console.warn('[FIREBASE CLOUD PERSISTENCE]', fbErr);
    }
  }

  if (serverData !== null) {
    return serverData;
  }

  if (res && !res.ok) {
    let errorData: any = {};
    const rawText = await res.text().catch(() => '');
    const isHtmlOrEdgeError = rawText && (
      rawText.includes('<!DOCTYPE') || 
      rawText.includes('<html') || 
      rawText.includes('NOT_FOUND') ||
      rawText.includes('could not be found')
    );

    try {
      errorData = (!isHtmlOrEdgeError && rawText) ? JSON.parse(rawText) : {};
    } catch {
      errorData = {};
    }

    let errorMessage = errorData.message || errorData.error;
    if (!errorMessage) {
      if (res.status === 404) {
        errorMessage = 'Requested record or endpoint not found.';
      } else if (res.status === 429) {
        errorMessage = 'Too many requests. Please wait before trying again.';
      } else if (res.status === 502 || res.status === 503 || res.status === 504) {
        errorMessage = 'Server is temporarily busy. Please try again.';
      } else {
        errorMessage = `Request failed with status ${res.status}`;
      }
    }

    const retryAfter = res.headers.get('retry-after');
    const errObj = new Error(errorMessage) as any;
    errObj.status = res.status;
    errObj.code = errorData.code || res.status;
    errObj.emailNotVerified = errorData.emailNotVerified;
    errObj.data = errorData;
    if (retryAfter) {
      errObj.retryAfter = parseInt(retryAfter, 10) || 60;
    }
    throw errObj;
  }

  return null;
}

export const api = {
  get: (endpoint: string) => request(endpoint),
  getBlob: async (endpoint: string, options: any = {}) => {
    const { token } = useAuthStore.getState();
    const cleanEndpoint = normalizeEndpoint(endpoint);
    const headers = {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    let res = await fetch(`${API_BASE}${cleanEndpoint}`, {
      ...options,
      headers,
      credentials: 'include'
    });
    if (res.status === 401 && token && !cleanEndpoint.includes('/auth/refresh')) {
      const newToken = await doRefreshToken();
      if (newToken) {
        res = await fetch(`${API_BASE}${cleanEndpoint}`, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${newToken}`
          },
          credentials: 'include'
        });
      }
    }
    if (!res.ok) {
      let errText = await res.text().catch(() => '');
      let errMsg = 'Failed to download file';
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error || errJson.message || errMsg;
      } catch {
        errMsg = errText || errMsg;
      }
      throw new Error(errMsg);
    }
    return res.blob();
  },
  download: async (endpoint: string, fallbackFilename?: string) => {
    const { token } = useAuthStore.getState();
    const cleanEndpoint = normalizeEndpoint(endpoint);
    const headers: any = {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    let res = await fetch(`${API_BASE}${cleanEndpoint}`, {
      method: 'GET',
      headers,
      credentials: 'include'
    });
    if (res.status === 401 && token && !cleanEndpoint.includes('/auth/refresh')) {
      const newToken = await doRefreshToken();
      if (newToken) {
        res = await fetch(`${API_BASE}${cleanEndpoint}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${newToken}`
          },
          credentials: 'include'
        });
      }
    }
    if (!res.ok) {
      let errText = await res.text().catch(() => '');
      let errMsg = 'Failed to download file';
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error || errJson.message || errMsg;
      } catch {
        errMsg = errText || errMsg;
      }
      throw new Error(errMsg);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition');
    let filename = fallbackFilename || 'download.xlsx';
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  post: (endpoint: string, data: any, options: any = {}) => {
    const isFormData = data instanceof FormData;
    return request(endpoint, {
      method: 'POST',
      headers: isFormData ? {} : { 'Content-Type': 'application/json', ...options.headers },
      body: isFormData ? data : JSON.stringify(data),
      ...options
    });
  },
  put: (endpoint: string, data: any) => request(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  patch: (endpoint: string, data: any) => request(endpoint, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
  delete: (endpoint: string, data?: any) => request(endpoint, { 
    method: 'DELETE',
    headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined
  }),
};
