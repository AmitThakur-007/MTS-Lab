import { createApp } from './_server/app';

const app = createApp();

/**
 * Vercel's native /api function entrypoint.
 *
 * The Express application keeps the canonical /api/* route contract. The
 * vercel.json rewrite sends the original API path through __mts_path so this
 * single serverless function can serve every existing API route.
 */
export default async function handler(req: any, res: any) {
  try {
    const rawUrl = String(req.url || '/');
    const parsed = new URL(rawUrl, 'http://vercel.local');
    const routedPath = parsed.searchParams.get('__mts_path');

    if (routedPath) {
      const cleanPath = routedPath.startsWith('/') ? routedPath : `/${routedPath}`;
      parsed.searchParams.delete('__mts_path');
      const remainingQuery = parsed.searchParams.toString();
      const reconstructedUrl = `/api${cleanPath}${remainingQuery ? `?${remainingQuery}` : ''}`;
      req.url = reconstructedUrl;
      req.originalUrl = reconstructedUrl;
    } else if (!req.url.startsWith('/api')) {
      req.url = `/api${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
      req.originalUrl = req.url;
    }

    return app(req, res);
  } catch (err: any) {
    console.error('[VERCEL HANDLER ERROR]', err);
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Serverless Function Error',
        message: err?.message || 'Internal Server Error',
      });
    }
  }
}

