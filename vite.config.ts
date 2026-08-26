import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Preload .env.local and .env into process.env for local builds
dotenv.config({ path: path.resolve(__dirname, '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

let defaultFirebase: any = {};
try {
  const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    defaultFirebase = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  }
} catch {
  // ignore
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };

  const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || defaultFirebase.apiKey || 'AIzaSyDw4d4eSahPP6KL-0qZzzIr8V5BJaHtpNs';
  const authDomain = env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || defaultFirebase.authDomain || 'mts-lab-eb8d2.firebaseapp.com';
  const databaseURL = env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || defaultFirebase.databaseURL || 'https://mts-lab-eb8d2-default-rtdb.firebaseio.com';
  const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || defaultFirebase.projectId || 'mts-lab-eb8d2';
  const storageBucket = env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || defaultFirebase.storageBucket || 'mts-lab-eb8d2.firebasestorage.app';
  const messagingSenderId = env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || defaultFirebase.messagingSenderId || '473440131766';
  const appId = env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID || defaultFirebase.appId || '1:473440131766:web:ebf94beed416c789b3e417';

  return {
    plugins: [react(), tailwindcss()],
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: {
      'process.env.NEXT_PUBLIC_FIREBASE_API_KEY': JSON.stringify(apiKey),
      'process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN': JSON.stringify(authDomain),
      'process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL': JSON.stringify(databaseURL),
      'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': JSON.stringify(projectId),
      'process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET': JSON.stringify(storageBucket),
      'process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(messagingSenderId),
      'process.env.NEXT_PUBLIC_FIREBASE_APP_ID': JSON.stringify(appId),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_API_KEY': JSON.stringify(apiKey),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN': JSON.stringify(authDomain),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL': JSON.stringify(databaseURL),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': JSON.stringify(projectId),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET': JSON.stringify(storageBucket),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(messagingSenderId),
      'import.meta.env.NEXT_PUBLIC_FIREBASE_APP_ID': JSON.stringify(appId),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

