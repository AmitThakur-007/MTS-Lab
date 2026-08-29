import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin, supabasePublic, config } from '../config/supabase';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  branchId?: string | null;
  phoneNumber?: string | null;
  department?: string | null;
  address?: string | null;
  profileImage?: string | null;
  accountStatus?: string;
  isActive?: boolean;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token missing or invalid.',
      });
    }

    let userEmail: string | null = null;
    let authUid: string | null = null;

    // 1. Try verifying with Supabase Auth
    try {
      const { data: supabaseUser, error } = await supabasePublic.auth.getUser(token);
      if (!error && supabaseUser?.user) {
        userEmail = supabaseUser.user.email || null;
        authUid = supabaseUser.user.id;
      }
    } catch (_) {
      // Ignore and fallback to JWT verification
    }

    // 2. If not Supabase access token, try local JWT verification
    if (!userEmail && !authUid) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret) as any;
        if (decoded) {
          userEmail = decoded.email || null;
          authUid = decoded.id || decoded.sub || null;
        }
      } catch (jwtErr: any) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired session token. Please log in again.',
        });
      }
    }

    if (!userEmail && !authUid) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Could not resolve authentication identity.',
      });
    }

    // 3. Query authoritative Staff Profile from public.User
    // Strategy: prefer email match (most reliable) then fall back to UID-based match.
    // This handles cases where supabaseUid is not yet synced in the User row.
    let query = supabaseAdmin.from('User').select('*').is('deletedAt', null);

    if (userEmail) {
      // Primary: email match (guaranteed unique)
      query = query.eq('email', userEmail.toLowerCase());
    } else if (authUid) {
      // Fallback: UID-based match when email is unavailable
      query = query.or(`id.eq.${authUid},supabaseUid.eq.${authUid}`);
    }

    let { data: users, error: dbError } = await query.limit(1);

    // Secondary fallback: if email didn't find anything, try UID
    if ((!users || users.length === 0) && authUid && userEmail) {
      const { data: uidUsers } = await supabaseAdmin
        .from('User')
        .select('*')
        .or(`id.eq.${authUid},supabaseUid.eq.${authUid}`)
        .is('deletedAt', null)
        .limit(1);
      if (uidUsers && uidUsers.length > 0) {
        users = uidUsers;
        dbError = null;
      }
    }

    if (dbError || !users || users.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User account not found or has been deactivated.',
      });
    }

    const dbUser = users[0];

    // 4. Validate Account Status
    if (dbUser.accountStatus === 'REJECTED' || dbUser.accountStatus === 'DISABLED' || dbUser.isActive === false) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Your account is disabled or access has been revoked. Contact administrator.',
      });
    }

    // 5. Attach authoritative user to request
    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      branchId: dbUser.branchId,
      phoneNumber: dbUser.phoneNumber,
      department: dbUser.department,
      address: dbUser.address,
      profileImage: dbUser.profileImage,
      accountStatus: dbUser.accountStatus,
      isActive: dbUser.isActive,
      emailVerified: dbUser.emailVerified,
      twoFactorEnabled: dbUser.twoFactorEnabled,
    };

    return next();
  } catch (err: any) {
    console.error('[AUTHENTICATION MIDDLEWARE ERROR]', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to authenticate user request.',
    });
  }
}
