import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://pirynpugkiurjobrqiqg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcnlucHVna2l1cmpvYnJxaXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTIzOTgsImV4cCI6MjEwMzU2ODM5OH0.ZlzqDH1EnjTr3qu-1htucpzPrpX0y4ZWlib2eQOpW3w';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Authoritative Server-Side Supabase Client (Service Role for Admin DB operations, Anon fallback)
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

export const config = {
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  jwtSecret: process.env.JWT_SECRET || 'mts-lab-super-secret-key-2026',
  refreshSecret: process.env.REFRESH_SECRET || 'mts-lab-refresh-secret-key-2026',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
};
