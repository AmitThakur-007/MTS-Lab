import { Router, Request, Response } from 'express';
import { getRecentEvents } from '../services/realtimeSync';

const router = Router();

// GET /api/events
// Real-time notifications and synchronization are handled directly by Supabase Realtime
// over WebSockets (avoiding long-lived serverless function execution on Vercel Fluid Compute).
// This endpoint provides an immediate handshake/status response without hanging the runtime.
router.get('/', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const acceptsSSE = req.headers.accept && req.headers.accept.includes('text/event-stream');
  if (acceptsSSE) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Connection', 'close');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', engine: 'supabase', timestamp: Date.now() })}\n\n`);
    return res.end();
  }

  return res.json({
    status: 'active',
    engine: 'supabase-realtime',
    timestamp: Date.now(),
  });
});

/**
 * GET /api/events/recent — Retrieve events missed during temporary disconnection
 */
router.get('/recent', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const since = req.query.since ? parseInt(String(req.query.since), 10) : 0;
  const events = getRecentEvents(since);
  return res.json({
    success: true,
    count: events.length,
    events,
    serverTimestamp: Date.now(),
  });
});

export default router;



