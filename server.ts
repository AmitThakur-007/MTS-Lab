import express from 'express';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import { createApp } from './api/_server/app';

dotenv.config();

// Ensure base-ui patch is applied if needed (fast in-process check)
try {
  const checkFile = path.join(process.cwd(), 'node_modules/@base-ui/react/floating-ui-react/hooks/useDismiss.mjs');
  if (fs.existsSync(checkFile)) {
    const text = fs.readFileSync(checkFile, 'utf8');
    if (!text.includes('passive: true') && fs.existsSync(path.join(process.cwd(), 'scripts', 'patch-base-ui.cjs'))) {
      execSync('node scripts/patch-base-ui.cjs', { stdio: 'ignore' });
    }
  }
} catch (_) {}

function resolvePort(): number {
  // Check CLI arguments (--port 3000)
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = Number(process.argv[portArgIndex + 1]);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // In AI Studio and local development, dev server must run on port 3000.
  // Port 8080 is reserved for nginx/ingress proxy in the container, so never bind to 8080.
  if (process.env.NODE_ENV !== 'production' || process.env.PORT === '8080') {
    return 3000;
  }

  return Number(process.env.PORT) || 3000;
}

async function startServer() {
  const app = createApp();
  const PORT = resolvePort();

  if (process.env.NODE_ENV !== 'production') {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          allowedHosts: true,
          hmr: false, // HMR disabled per environment constraints
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr: any) {
      console.warn('[VITE DEV SERVER NOTICE]', viteErr?.message || viteErr);
      const distPath = path.join(process.cwd(), 'dist');
      if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error(`[SERVER ERROR on port ${PORT}]:`, err?.message || err);
    if (err.code === 'EADDRINUSE') {
      console.warn(`[PORT IN USE] Port ${PORT} occupied. Exiting to allow supervisor restart.`);
      process.exit(1);
    }
  });

  const cleanup = () => {
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 1000).unref();
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
}

startServer().catch((err) => {
  console.error('[FATAL SERVER STARTUP ERROR]:', err);
  process.exit(1);
});

