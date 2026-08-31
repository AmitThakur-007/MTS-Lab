import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// These public Supabase values are safe to use as server-side configuration fallbacks.
// The service-role key and authentication secrets are NEVER hardcoded here.
const DEFAULT_SUPABASE_URL = 'https://pirynpugkiurjobrqiqg.supabase.co';
const DEFAULT_SUPABASE_PUBLIC_KEY = 'sb_publishable_qdk-qGpTDF77ZDV_S2JTew_ClZAAls9';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
const SUPABASE_ANON_KEY = (
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_PUBLIC_KEY
).trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

// Do not throw at module initialization. A missing optional deployment variable
// must not crash the entire Vercel function and turn public endpoints into 500s.
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

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

// Authentication secrets are intentionally optional at module load time.
// Public/read-only endpoints must remain available even if auth secrets are
// misconfigured. Protected authentication flows must validate these before
// issuing/verifying local JWTs.
const jwtSecret = process.env.JWT_SECRET?.trim() || '';
const refreshSecret = process.env.REFRESH_SECRET?.trim() || '';

export function requireAuthSecrets() {
  if (!jwtSecret || !refreshSecret) {
    throw new Error('Authentication is not configured: JWT_SECRET and REFRESH_SECRET are required.');
  }
  return { jwtSecret, refreshSecret };
}

export const config = {
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  jwtSecret,
  refreshSecret,
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
};
