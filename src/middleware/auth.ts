import { Request, Response, NextFunction } from 'express';
import { UnauthenticatedError } from '../errors';

export type UserRole = 'owner' | 'admin' | 'manager' | 'agent';

export type CurrentUser = {
  tenantId: string;
  userId: string;
  role: UserRole;
};

// Extend Express Request with typed currentUser
declare global {
  namespace Express {
    interface Request {
      currentUser?: CurrentUser;
    }
  }
}

const VALID_ROLES: Set<string> = new Set(['owner', 'admin', 'manager', 'agent']);

// reads x-tenant-id / x-user-id / x-user-role headers, attaches req.currentUser or returns 401
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const tenantId = req.headers['x-tenant-id'];
  const userId = req.headers['x-user-id'];
  const role = req.headers['x-user-role'];

  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    return next(new UnauthenticatedError('Missing required header: x-tenant-id'));
  }
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return next(new UnauthenticatedError('Missing required header: x-user-id'));
  }
  if (!role || typeof role !== 'string' || !VALID_ROLES.has(role)) {
    return next(
      new UnauthenticatedError(
        `Missing or invalid header: x-user-role (must be one of: owner, admin, manager, agent)`,
      ),
    );
  }

  req.currentUser = {
    tenantId: tenantId.trim(),
    userId: userId.trim(),
    role: role as UserRole,
  };

  next();
}
