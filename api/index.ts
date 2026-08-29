import type { IncomingMessage, ServerResponse } from 'http';
import { createServerApp } from '../server';

export type VercelRequest = IncomingMessage & {
  body?: any;
  query?: any;
  cookies?: any;
};

export type VercelResponse = ServerResponse & {
  status?: (statusCode: number) => VercelResponse;
  json?: (body: any) => void;
  send?: (body: any) => void;
};

let serverAppPromise: Promise<any> | null = null;

async function getServerApp() {
  if (!serverAppPromise) {
    serverAppPromise = createServerApp();
  }
  return serverAppPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-refresh-token, X-Requested-With, Accept');
    res.statusCode = 200;
    res.end();
    return;
  }

  // Normalize URL so Express routes matching /api/* always match
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  return new Promise<void>((resolve, reject) => {
    // Keep Vercel serverless function alive until response is finished
    res.on('finish', () => resolve());
    res.on('close', () => resolve());
    res.on('error', (err) => reject(err));

    getServerApp()
      .then((app) => {
        app(req, res, (err: any) => {
          if (err) {
            console.error('[API SERVERLESS ROUTE ERROR]', err);
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: 'Internal Server Error',
                message: err?.message || 'Route execution error'
              }));
            }
            resolve();
          }
        });
      })
      .catch((err: any) => {
        console.error('[API SERVERLESS GATEWAY ERROR]', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Internal Server Error',
            message: err?.message || 'Serverless application handler encountered an error.'
          }));
        }
        resolve();
      });
  });
}

