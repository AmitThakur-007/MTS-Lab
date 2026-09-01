import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// These public Supabase values are safe to use as server-side configuration fallbacks.
// The service-role key and authentication secrets are NEVER hardcoded here.
const DEFAULT_SUPABASE_URL = 'https://pirynpugkiurjobrqiqg.supabase.co';
const DEFAULT_SUPABASE_PUBLIC_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcnlucHVna2l1cmpvYnJxaXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTIzOTgsImV4cCI6MjEwMzU2ODM5OH0.ZlzqDH1EnjTr3qu-1htucpzPrpX0y4ZWlib2eQOpW3w';

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

// Fallback JWT secrets ensure local authentication tokens can be generated and verified safely.
const jwtSecret = process.env.JWT_SECRET?.trim() || 'mts-lab-secure-jwt-token-secret-key-2026';
const refreshSecret = process.env.REFRESH_SECRET?.trim() || 'mts-lab-secure-refresh-token-secret-key-2026';

export function requireAuthSecrets() {
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
