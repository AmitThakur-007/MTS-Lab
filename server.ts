import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createApp } from './api/_server/app';

dotenv.config();

// Ensure unhandled exceptions don't terminate the dev server
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]:', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]:', reason);
});

// Ensure base-ui patch is applied if needed (fast in-process string patch without spawning node)
try {
  const checkFile = path.join(process.cwd(), 'node_modules/@base-ui/react/floating-ui-react/hooks/useDismiss.mjs');
  if (fs.existsSync(checkFile)) {
    const text = fs.readFileSync(checkFile, 'utf8');
    if (!text.includes('passive: true')) {
      const updated = text.replace(
        'addEventListener(target, event.type, () => {\n      listener(event);\n      unsubscribe();\n    })',
        'addEventListener(target, event.type, () => {\n      listener(event);\n      unsubscribe();\n    }, event.type === \'touchstart\' || event.type === \'touchmove\' ? { passive: true } : undefined)'
      );
      if (updated !== text) {
        fs.writeFileSync(checkFile, updated, 'utf8');
      }
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

function listenWithRetry(app: express.Application, port: number, maxRetries = 10, delayMs = 1000): Promise<any> {
  return new Promise((resolve, reject) => {
    let retries = 0;

    function attempt() {
      const server = app.listen(port, '0.0.0.0', () => {
        console.log(`Server running on port ${port}`);
        resolve(server);
      });

      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE' && retries < maxRetries) {
          retries++;
          console.warn(`[PORT ${port} IN USE] Socket occupied; retrying in ${delayMs}ms (${retries}/${maxRetries})...`);
          setTimeout(attempt, delayMs);
        } else {
          console.error(`[SERVER ERROR on port ${port}]:`, err?.message || err);
          reject(err);
        }
      });
    }

    attempt();
  });
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
        app.get('*', (_req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = await listenWithRetry(app, PORT);

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

