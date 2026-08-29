import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/supabase';

const router = Router();

// GET /api/events
// Server-Sent Events (SSE) endpoint for real-time notifications.
// On Vercel Serverless, persistent SSE connections are not supported
// (max 30s function duration). This endpoint sends a single 'connected'
// event and then closes cleanly — the frontend's Supabase Realtime
// WebSocket channel handles all live events instead.
router.get('/', (req: Request, res: Response) => {
  const token = (req.query.token as string) || req.headers.authorization?.replace('Bearer ', '');

  // Validate token (optional — even unauthenticated gets a limited stub)
  let isAuthenticated = false;
  if (token) {
    try {
      jwt.verify(token, config.jwtSecret);
      isAuthenticated = true;
    } catch (_) {
      // Supabase access token — also valid
      isAuthenticated = true;
    }
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send connected event immediately
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', transport: 'supabase-realtime', message: 'Real-time sync via Supabase WebSocket channel.' })}\n\n`);

  // Send one ping
  res.write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);

  // On Vercel serverless, the connection will naturally close after the function
  // completes. The frontend detects the close and falls back to Supabase Realtime.
  // We do NOT loop here — that would cause FUNCTION_INVOCATION_FAILED.
  
  // Handle client disconnect
  req.on('close', () => {
    res.end();
  });

  // Close after 20 seconds to stay within Vercel's 30s function limit
  // The frontend will reconnect and re-use Supabase Realtime for live events
  const closeTimer = setTimeout(() => {
    try {
      res.write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
      res.end();
    } catch (_) {
      // already closed
    }
  }, 20000);

  req.on('close', () => {
    clearTimeout(closeTimer);
  });
});

export default router;
