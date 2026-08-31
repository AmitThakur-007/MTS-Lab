import { createApp } from './_server/app';

const app = createApp();

/**
 * Vercel's native /api function entrypoint.
 *
 * The Express application keeps the canonical /api/* route contract. The
 * vercel.json rewrite sends the original API path through __mts_path so this
 * single serverless function can serve every existing API route.
 */
export default function handler(req: any, res: any) {
  const originalUrl = String(req.url || '/');
  const parsed = new URL(originalUrl, 'http://vercel.local');
  const routedPath = parsed.searchParams.get('__mts_path');

  if (routedPath) {
    const cleanPath = routedPath.startsWith('/') ? routedPath : `/${routedPath}`;
    parsed.searchParams.delete('__mts_path');
    const remainingQuery = parsed.searchParams.toString();
    req.url = `/api${cleanPath}${remainingQuery ? `?${remainingQuery}` : ''}`;
  }

  return app(req, res);
}
