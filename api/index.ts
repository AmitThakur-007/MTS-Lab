import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const { getApp } = await import('../server');
    const app = await getApp();
    return app(req, res);
  } catch (error: any) {
    console.error('[VERCEL LAMBDA ERROR]', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Serverless Function Error',
      message: error?.message || 'Failed to initialize serverless application.'
    }));
  }
}
