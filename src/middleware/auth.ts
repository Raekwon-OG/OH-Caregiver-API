import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

// Simple JWT-based middleware with a SKIP_AUTH option for local development/harness.
export interface AuthRequest extends Request {
  user?: any;
}

export function requireAuth(role?: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const skip = process.env.SKIP_AUTH === 'true';
    if (skip) {
      req.user = { id: '000000000000000000000000', role: 'caregiver', email: 'local@dev' };
      return next();
    }

    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: { message: 'Missing token' } });
    const token = auth.split(' ')[1];
    try {
      const secret = process.env.JWT_SECRET || '';
      const payload = jwt.verify(token, secret) as any;
      // Expecting payload.sub to be caregiver id
      req.user = { id: payload.sub || payload.userId || payload.id, email: payload.email, role: payload.role || 'caregiver' };
      if (role && req.user.role !== role) return res.status(403).json({ error: { message: 'Forbidden' } });
      return next();
    } catch (err) {
      logger.debug('Auth verify failed', { err });
      return res.status(401).json({ error: { message: 'Invalid token' } });
    }
  };
}
