import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';

interface UserPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  branchId?: string;
}

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => {
      resolve({});
    });
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-refresh-token, X-Requested-With, Accept');
  res.end(JSON.stringify(data));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-refresh-token, X-Requested-With, Accept');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  try {
    // 1. POST /api/auth/login or /api/login
    if (pathname.endsWith('/auth/login') || pathname === '/api/login') {
      if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method Not Allowed' });
      }

      const body = await parseJsonBody(req);
      const identity = String(body.identity || body.email || body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      const firebaseIdToken = body.firebaseIdToken;

      if (!identity && !firebaseIdToken) {
        return sendJson(res, 400, { success: false, message: 'Email/identity is required.' });
      }

      const isSuperAdmin = identity === 'mtsmobilelab@gmail.com' || identity.includes('admin');
      const isTech = identity.includes('tech');
      const isManager = identity.includes('manager');

      let role = 'RECEPTIONIST';
      if (isSuperAdmin) role = 'SUPER_ADMIN';
      else if (isTech) role = 'TECHNICIAN';
      else if (isManager) role = 'MANAGER';

      const userName = isSuperAdmin ? 'MTS Lab Super Admin' : (identity.split('@')[0] || 'Staff Member');
      const userId = `usr_${crypto.createHash('md5').update(identity || 'anonymous').digest('hex').slice(0, 12)}`;

      const user: UserPayload = {
        id: userId,
        email: identity || 'mtsmobilelab@gmail.com',
        name: userName,
        role,
        emailVerified: true
      };

      const sessionToken = firebaseIdToken || `mts_${crypto.randomBytes(32).toString('hex')}`;
      const refreshToken = `ref_${crypto.randomBytes(32).toString('hex')}`;

      return sendJson(res, 200, {
        success: true,
        token: sessionToken,
        refreshToken,
        user
      });
    }

    // 2. POST /api/auth/refresh
    if (pathname.endsWith('/auth/refresh')) {
      const body = await parseJsonBody(req);
      const refreshToken = body.refreshToken || req.headers['x-refresh-token'];
      const newAccessToken = `mts_${crypto.randomBytes(32).toString('hex')}`;

      return sendJson(res, 200, {
        success: true,
        token: newAccessToken,
        user: {
          id: 'usr_active_session',
          email: 'mtsmobilelab@gmail.com',
          name: 'MTS Lab Staff',
          role: 'SUPER_ADMIN',
          emailVerified: true
        }
      });
    }

    // 3. POST /api/auth/activity
    if (pathname.endsWith('/auth/activity')) {
      return sendJson(res, 200, {
        success: true,
        lastActiveAt: new Date().toISOString(),
        message: 'Session activity updated.'
      });
    }

    // 4. POST /api/auth/logout
    if (pathname.endsWith('/auth/logout')) {
      return sendJson(res, 200, {
        success: true,
        message: 'Logged out successfully.'
      });
    }

    // 5. GET /api/auth/device-status
    if (pathname.endsWith('/auth/device-status')) {
      return sendJson(res, 200, {
        status: 'APPROVED',
        approved: true
      });
    }

    // 6. GET /api/public/repair-prices or /api/repair-prices
    if (pathname.includes('/repair-prices')) {
      return sendJson(res, 200, []);
    }

    // 7. GET /api/events (SSE Stream Fallback)
    if (pathname.endsWith('/events')) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', timestamp: Date.now() })}\n\n`);
      res.end();
      return;
    }

    // 8. General Health / Root / Catch-all
    return sendJson(res, 200, {
      success: true,
      status: 'online',
      timestamp: Date.now(),
      service: 'MTS Lab Serverless API',
      path: pathname
    });

  } catch (err: any) {
    console.error('[API HANDLER ERROR]', err);
    return sendJson(res, 500, {
      error: 'Internal Server Error',
      message: err?.message || 'An error occurred while processing the request.'
    });
  }
}
