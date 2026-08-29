import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../src/server/app';

let cachedApp: any = null;

function getAppInstance() {
  if (!cachedApp) {
    cachedApp = createApp();
  }
  return cachedApp;
}

export default async function handler(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  // CORS Preflight Handler
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-refresh-token, X-Requested-With, Accept');
    res.statusCode = 200;
    res.end();
    return;
  }

  // Normalize URL to always start with /api
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  const app = getAppInstance();

  return new Promise<void>((resolve, reject) => {
    res.on('finish', () => resolve());
    res.on('close', () => resolve());
    res.on('error', (err) => reject(err));

    app(req, res, (err: any) => {
      if (err) {
        console.error('[API SERVERLESS EXECUTION ERROR]', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Internal Server Error',
            message: err?.message || 'Serverless route execution failure',
          }));
        }
      }
      resolve();
    });
  });
}
