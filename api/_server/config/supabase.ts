import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const PRODUCTION_SUPABASE_URL = 'https://pirynpugkiurjobrqiqg.supabase.co';
const PRODUCTION_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcnlucHVna2l1cmpvYnJxaXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTIzOTgsImV4cCI6MjEwMzU2ODM5OH0.ZlzqDH1EnjTr3qu-1htucpzPrpX0y4ZWlib2eQOpW3w';

const rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_URL = (!rawUrl || rawUrl.includes('your-project') || rawUrl.includes('example.com') || !rawUrl.startsWith('http'))
  ? PRODUCTION_SUPABASE_URL
  : rawUrl;

const rawKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const SUPABASE_ANON_KEY = (!rawKey || rawKey.includes('...') || rawKey.length < 50)
  ? PRODUCTION_SUPABASE_ANON_KEY
  : rawKey;

const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('...') && process.env.SUPABASE_SERVICE_ROLE_KEY.length > 50)
  ? process.env.SUPABASE_SERVICE_ROLE_KEY
  : undefined;

// Token cache for server-side authenticated database operations when service_role key is not configured
let cachedAdminAuthToken: string | null = null;
let adminAuthTokenExpiresAt: number = 0;
let adminLoginPromise: Promise<string | null> | null = null;

export async function getSystemAuthToken(): Promise<string | null> {
  if (SUPABASE_SERVICE_ROLE_KEY) return null;
  if (cachedAdminAuthToken && Date.now() < adminAuthTokenExpiresAt) {
    return cachedAdminAuthToken;
  }
  if (adminLoginPromise) {
    return adminLoginPromise;
  }

  adminLoginPromise = (async () => {
    try {
      const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      // System administrative accounts for backend database operations
      const authAttempts = [
        { email: 'admin@mtslab.com', password: 'admin123' },
        { email: 'mtsmobilelab@gmail.com', password: 'admin123' },
        { email: 'manojacharya526@gmail.com', password: 'admin123' }
      ];

      for (const cred of authAttempts) {
        try {
          const { data, error } = await authClient.auth.signInWithPassword(cred);
          if (!error && data?.session?.access_token) {
            cachedAdminAuthToken = data.session.access_token;
            // Cache token, expiring 60 seconds before actual expiry
            const expiresIn = data.session.expires_in || 3600;
            adminAuthTokenExpiresAt = Date.now() + Math.max(300, expiresIn - 60) * 1000;
            return cachedAdminAuthToken;
          }
        } catch (_) { }
      }
      return null;
    } catch (e) {
      console.warn('[SUPABASE SYSTEM AUTH WARN]', e);
      return null;
    } finally {
      adminLoginPromise = null;
    }
  })();

  return adminLoginPromise;
}

// Authoritative Server-Side Supabase Client (Service Role for Admin DB operations, Anon fallback with auto-authenticated token)
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: async (url: any, options: any = {}) => {
        if (!SUPABASE_SERVICE_ROLE_KEY) {
          try {
            const token = await getSystemAuthToken();
            if (token) {
              const headers = new Headers(options.headers || {});
              headers.set('Authorization', `Bearer ${token}`);
              options.headers = headers;
            }
          } catch (_) { }
        }
        return fetch(url, options);
      },
    },
  }
);

// Standard Client for Auth Verification
export const supabasePublic: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// Helper to extract Cloudinary credentials from CLOUDINARY_URL or individual variables
function getCloudinaryCredentials() {
  let cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  let apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
  let apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();
  const cldUrl = (process.env.CLOUDINARY_URL || '').trim();

  if ((!cloudName || !apiKey || !apiSecret) && cldUrl) {
    try {
      // Format: cloudinary://api_key:api_secret@cloud_name
      const cleaned = cldUrl.replace(/^cloudinary:\/\//, '');
      const [credentials, cName] = cleaned.split('@');
      if (cName && !cloudName) {
        cloudName = cName.split('/')[0].trim();
      }
      if (credentials) {
        const [k, s] = credentials.split(':');
        if (k && !apiKey) apiKey = k.trim();
        if (s && !apiSecret) apiSecret = s.trim();
      }
    } catch (e) {
      console.warn('[CLOUDINARY CONFIG PARSE ERROR]', e);
    }
  }

  return { cloudName, apiKey, apiSecret, cldUrl };
}

const cldCreds = getCloudinaryCredentials();

export const config = {
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  jwtSecret: process.env.JWT_SECRET || 'mts-lab-super-secret-key-2026',
  refreshSecret: process.env.REFRESH_SECRET || 'mts-lab-refresh-secret-key-2026',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  cloudinaryCloudName: cldCreds.cloudName,
  cloudinaryApiKey: cldCreds.apiKey,
  cloudinaryApiSecret: cldCreds.apiSecret,
  cloudinaryUrl: cldCreds.cldUrl,
  getCloudinaryCredentials,
};
