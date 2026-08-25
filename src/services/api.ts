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


async function request(endpoint: string, options: any = {}) {
  const { token } = useAuthStore.getState();
  const cleanEndpoint = normalizeEndpoint(endpoint);
  
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let res;
  try {
    res = await fetch(`${API_BASE}${cleanEndpoint}`, { 
      ...options, 
      headers,
      credentials: 'include'
    });
  } catch (netErr: any) {
    console.error("[NETWORK ERROR]", netErr);
    throw new Error("Unable to connect to the API server. Please check your internet connection or verify the server is online.");
  }

  // Handle 401 - try synchronized refresh if token exists and endpoint is not auth/refresh or auth/login
  if (res.status === 401 && token && !cleanEndpoint.includes('/auth/refresh') && !cleanEndpoint.includes('/auth/login') && !cleanEndpoint.includes('/auth/resend-verification')) {
    // Peek at the error body to detect InactivityExpired — if so, skip refresh and logout immediately
    const errClone = res.clone();
    try {
      const errData = await errClone.json() as any;
      if (errData?.error === 'InactivityExpired') {
        const { logout } = useAuthStore.getState();
        if (_onInactivityExpired) {
          _onInactivityExpired();
        } else {
          logout();
          window.location.href = '/login?reason=inactivity';
        }
        const errObj = new Error(errData.message || 'Session expired due to inactivity.') as any;
        errObj.status = 401;
        errObj.code = 401;
        throw errObj;
      }
    } catch (peekErr: any) {
      // If the error has already been thrown (InactivityExpired), re-throw it
      if (peekErr?.status === 401 && peekErr?.code === 401 && peekErr?.message?.includes('inactivity')) {
        throw peekErr;
      }
      // Otherwise parse failure is OK — proceed to refresh
    }

    const newToken = await doRefreshToken();
    if (newToken) {
      // Retry original request with fresh token
      const retryHeaders = {
        ...options.headers,
        Authorization: `Bearer ${newToken}`,
      };
      try {
        res = await fetch(`${API_BASE}${cleanEndpoint}`, { 
          ...options, 
          headers: retryHeaders,
          credentials: 'include'
        });
      } catch {
        throw new Error("Unable to connect to the API server on request retry.");
      }
    } else {
      throw new Error('Session expired. Please login again.');
    }
  }

  if (!res.ok) {
    let errorData: any = {};
    const rawText = await res.text();
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
        errorMessage = 'Backend API endpoint not found (404). Please ensure the backend server is online or configure VITE_API_URL.';
      } else if (res.status === 502 || res.status === 503 || res.status === 504) {
        errorMessage = 'Backend server is temporarily unavailable. Please try again in a moment.';
      } else if (isHtmlOrEdgeError) {
        errorMessage = `Server returned error (${res.status}). Please check network connectivity or backend status.`;
      } else {
        errorMessage = rawText && rawText.length < 200 ? rawText : `Request failed with status ${res.status}`;
      }
    }

    const isFirebaseVerificationRequest = cleanEndpoint.includes('/auth/resend-verification');
    if (res.status === 429 && !isFirebaseVerificationRequest) {
      errorMessage = 'Rate limit exceeded. Please wait a moment before trying again.';
    } else if (res.status === 429 && isFirebaseVerificationRequest && !errorData.message) {
      errorMessage = 'Too many verification requests were made. Please wait before requesting another verification email.';
    }

    const errObj = new Error(errorMessage) as any;
    errObj.status = errorData.status || res.status;
    errObj.requestCount = errorData.requestCount;
    errObj.requestLimitReached = errorData.requestLimitReached;
    errObj.code = res.status;
    throw errObj;
  }

  const rawSuccessText = await res.text();
  if (!rawSuccessText || !rawSuccessText.trim()) {
    return null;
  }
  try {
    return JSON.parse(rawSuccessText);
  } catch {
    return rawSuccessText;
  }
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
