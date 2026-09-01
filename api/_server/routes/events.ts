import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/supabase';
import { registerSSEClient } from '../services/realtimeSync';

const router = Router();

// GET /api/events
// Server-Sent Events (SSE) endpoint for real-time notifications & database synchronization.
router.get('/', (req: Request, res: Response) => {
  const token = (req.query.token as string) || req.headers.authorization?.replace('Bearer ', '');

  let user: { id?: string; role?: string } | null = null;
  if (token) {
    try {
      const decoded: any = jwt.verify(token, config.jwtSecret);
      if (decoded && decoded.id) {
        user = { id: decoded.id, role: decoded.role };
      }
    } catch (_) {
      try {
        const decoded: any = jwt.decode(token);
        if (decoded) {
          user = { id: decoded.id || decoded.sub, role: decoded.role || decoded.user_metadata?.role };
        }
      } catch (e) { }
    }
  }

  // Set standard SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const clientId = uuidv4();
  const unregister = registerSSEClient(clientId, res, user);

  // Send connected handshake
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', clientId, timestamp: Date.now() })}\n\n`);

  // Keep-alive heartbeat interval
  const pingInterval = setInterval(() => {
    try {
      res.write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
    } catch (err) {
      clearInterval(pingInterval);
      unregister();
    }
  }, 15000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(pingInterval);
    unregister();
    res.end();
  });
});

export default router;

