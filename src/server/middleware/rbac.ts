import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export function normalizeRole(role: string): string {
  if (!role) return '';
  const r = role.toUpperCase().replace(/\s+/g, '_').trim();
  if (r === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (r === 'HEAD_TECHNICIAN' || r === 'LEADTECHNICIAN') return 'LEAD_TECHNICIAN';
  return r;
}

export function authorize(allowedRoles: string[]) {
  const normalizedAllowed = allowedRoles.map(normalizeRole);

  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required for this resource.',
      });
    }

    const userRole = normalizeRole(req.user.role);

    // SUPER_ADMIN has authoritative full access across all endpoints
    if (userRole === 'SUPER_ADMIN') {
      return next();
    }

    if (normalizedAllowed.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden',
      message: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
    });
  };
}
