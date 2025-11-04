import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { verifyTokenWithJwks } from '../utils/jwks';
import * as caregiverService from '../services/caregiverService';

export interface AuthRequest extends Request {
  user?: any;
}

// Build a remote JWK Set from SUPABASE_URL if provided. createRemoteJWKSet handles caching.
let supabaseIssuer: string | null = null;
if (process.env.SUPABASE_URL) {
  const base = process.env.SUPABASE_URL.replace(/\/$/, '');
  supabaseIssuer = `${base}/auth/v1`;
}

// requireAuth verifies JWTs using Supabase JWKS (RS256) when SUPABASE_URL is configured.
// Falls back to HMAC secret verification (`JWT_SECRET`) for local/dev/testing.
export function requireAuth(role?: string | string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const skip = process.env.SKIP_AUTH === 'true';
    if (skip) {
      req.user = { id: '000000000000000000000000', role: 'caregiver', email: 'local@dev' };
      return next();
    }

    const auth = (req.headers as any).authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: { message: 'Missing token' } });
    const token = auth.split(' ')[1];
    try {
      let payload: any;
      // Inspect token header to decide verification method (HS* vs RS*)
      let alg: string | null = null;
      try {
        const headerB64 = token.split('.')[0] || '';
        // JWT uses base64url encoding. Normalize to base64 for Buffer.
        const b64 = headerB64.replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
        const headerJson = Buffer.from(padded, 'base64').toString('utf8');
        const header = JSON.parse(headerJson || '{}');
        alg = header.alg || null;
        logger.debug('Token header parsed', { alg, kid: header.kid });
      } catch (hdrErr) {
        logger.debug('Failed to parse token header', { err: hdrErr });
      }

      // Treat RS* and ES* (ECDSA) tokens as asymmetric and verify via JWKS
      if (alg && (alg.startsWith('RS') || alg.startsWith('ES'))) {
        // RS* / ES* signed token — verify using remote JWKS (require SUPABASE_URL)
        logger.info('Auth audit', { branch: 'jwks', alg, kid: undefined, status: 'attempt' });
        if (!process.env.SUPABASE_URL || !supabaseIssuer) throw new Error('SUPABASE_URL not configured for RS/ES verification');
        try {
          const p = await verifyTokenWithJwks(token, { issuer: supabaseIssuer, audience: 'authenticated', maxTokenAge: '1h' });
          payload = p as any;
          logger.info('Auth audit', { branch: 'jwks', alg, kid: payload?.kid || undefined, status: 'success' });
        } catch (jwksErr) {
          // Record a failed JWKS attempt in the audit logs and rethrow to be handled below
          logger.warn('Auth audit', { branch: 'jwks', alg, status: 'failed' });
          throw jwksErr;
        }
      } else if (alg && alg.startsWith('HS')) {
        // HS* signed token — verify using the server-side JWT secret from Supabase settings
        logger.info('Auth audit', { branch: 'hmac', alg, status: 'attempt' });
        const secret = process.env.JWT_SECRET || '';
        if (!secret) {
          logger.warn('Auth audit', { branch: 'hmac', alg, status: 'no-secret' });
          throw new Error('No JWT_SECRET configured for HS256 verification');
        }
        try {
          payload = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: supabaseIssuer || undefined, audience: 'authenticated', maxAge: '1h' }) as any;
          logger.info('Auth audit', { branch: 'hmac', alg, status: 'success' });
        } catch (hErr) {
          logger.warn('Auth audit', { branch: 'hmac', alg, status: 'failed' });
          throw hErr;
        }
      } else {
        // Unknown algorithm or missing header — reject
        logger.warn('Auth audit', { branch: 'unknown', alg: alg || 'none', status: 'unsupported' });
        throw new Error('Unsupported token algorithm');
      }

      // Attach user info and enforce basic RBAC
      const supabaseId = payload.sub || payload.userId || payload.id;
      const email = payload.email;
      const name = payload.name || payload.user_metadata?.full_name || payload.user_metadata?.name;

      // Ensure there's a caregiver record in Mongo linked to this supabaseId
      try {
        const dbUser = await caregiverService.findOrCreateBySupabaseId(String(supabaseId), { email, name });
        // Prefer using the DB _id (ObjectId string) as the primary `req.user.id` so
        // downstream code that queries by caregiver ObjectId (ProtectedMember) works
        // consistently. Keep the Supabase id as `supabaseId` on the user object.
        const dbId = dbUser && (dbUser._id || dbUser.id) ? String(dbUser._id || dbUser.id) : undefined;
        req.user = {
          id: dbId || String(supabaseId),
          supabaseId: String(supabaseId),
          email,
          role: payload.role || 'caregiver',
          caregiverId: dbId,
        };
      } catch (syncErr) {
        logger.debug('Failed to sync caregiver record', { err: syncErr });
        // continue with token-based identity but surface sync failure
        req.user = { id: supabaseId, supabaseId: supabaseId, email, role: payload.role || 'caregiver' };
      }
      // RBAC: allow passing a single role or an array. Also accept Supabase's 'authenticated'
      // role when the application expects 'caregiver' to be more permissive for Supabase-issued tokens.
      if (role) {
        const allowed = Array.isArray(role) ? role.slice() : [role];
        // Accept Supabase's generic 'authenticated' as equivalent to our app-level 'caregiver'
        if (allowed.includes('caregiver') && !allowed.includes('authenticated')) {
          allowed.push('authenticated');
        }
        logger.debug('RBAC check', { allowed, userRole: req.user.role });
        if (!allowed.includes(req.user.role)) return res.status(403).json({ error: { message: 'Forbidden' } });
      }
      return next();
    } catch (err) {
      logger.debug('Auth verify failed', { err });
      return res.status(401).json({ error: { message: 'Invalid token' } });
    }
  };
}
