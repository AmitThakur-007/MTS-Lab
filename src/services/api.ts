import { useAuthStore } from '@/store/authStore';
import { getDeviceIdentifier } from '@/lib/device';

const API_BASE = '/api';

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


async function request<T = any>(endpoint: string, options: any = {}): Promise<T> {
  const { token } = useAuthStore.getState();
  const deviceId = getDeviceIdentifier();

  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(deviceId ? { 'x-device-identifier': deviceId } : {}),
  };

  let res;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include'
    });
  } catch (netErr: any) {
    console.error("[NETWORK ERROR]", netErr);
    throw new Error("Unable to connect to the API server. Please check your internet connection or verify the server is online.");
  }

  // Handle 401 - try synchronized refresh if token exists and endpoint is not auth/refresh or auth/login
  if (res.status === 401 && token && !endpoint.includes('/auth/refresh') && !endpoint.includes('/auth/login')) {
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
        res = await fetch(`${API_BASE}${endpoint}`, {
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
    try {
      errorData = rawText ? JSON.parse(rawText) : {};
    } catch {
      // Server or reverse proxy returned plain text (e.g. "Rate exceeded.", "Bad Gateway")
      errorData = {
        message: rawText && rawText.length < 300 ? rawText : `Server returned status ${res.status}: ${res.statusText}`
      };
    }

    let errorMessage = errorData.message || errorData.error || rawText || `Request failed with status ${res.status}`;
    if (res.status === 429 || (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('rate'))) {
      errorMessage = 'Rate limit exceeded. Please wait a moment before trying again.';
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
  get: <T = any>(endpoint: string, options?: { params?: Record<string, any> }) => {
    let url = endpoint;
    if (options?.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          searchParams.append(key, String(val));
        }
      });
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }
    return request<T>(url);
  },
  getBlob: async (endpoint: string, options: any = {}) => {
    const { token } = useAuthStore.getState();
    const headers = {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    let res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include'
    });
    if (res.status === 401 && token && !endpoint.includes('/auth/refresh')) {
      const newToken = await doRefreshToken();
      if (newToken) {
        res = await fetch(`${API_BASE}${endpoint}`, {
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
    const headers: any = {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    let res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'GET',
      headers,
      credentials: 'include'
    });
    if (res.status === 401 && token && !endpoint.includes('/auth/refresh')) {
      const newToken = await doRefreshToken();
      if (newToken) {
        res = await fetch(`${API_BASE}${endpoint}`, {
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
  post: <T = any>(endpoint: string, data?: any, options: any = {}) => {
    const isFormData = data instanceof FormData;
    return request<T>(endpoint, {
      method: 'POST',
      headers: isFormData ? {} : { 'Content-Type': 'application/json', ...options.headers },
      body: isFormData ? data : data !== undefined ? JSON.stringify(data) : undefined,
      ...options
    });
  },
  put: <T = any>(endpoint: string, data?: any) => request<T>(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: data !== undefined ? JSON.stringify(data) : undefined,
  }),
  patch: <T = any>(endpoint: string, data?: any) => request<T>(endpoint, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: data !== undefined ? JSON.stringify(data) : undefined,
  }),
  delete: <T = any>(endpoint: string, data?: any) => request<T>(endpoint, {
    method: 'DELETE',
    headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined
  }),
};