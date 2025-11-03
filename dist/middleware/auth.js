"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
const jwks_1 = require("../utils/jwks");
const caregiverService = __importStar(require("../services/caregiverService"));
// Build a remote JWK Set from SUPABASE_URL if provided. createRemoteJWKSet handles caching.
let supabaseIssuer = null;
if (process.env.SUPABASE_URL) {
    const base = process.env.SUPABASE_URL.replace(/\/$/, '');
    supabaseIssuer = `${base}/auth/v1`;
}
// requireAuth verifies JWTs using Supabase JWKS (RS256) when SUPABASE_URL is configured.
// Falls back to HMAC secret verification (`JWT_SECRET`) for local/dev/testing.
function requireAuth(role) {
    return async (req, res, next) => {
        const skip = process.env.SKIP_AUTH === 'true';
        if (skip) {
            req.user = { id: '000000000000000000000000', role: 'caregiver', email: 'local@dev' };
            return next();
        }
        const auth = req.headers.authorization;
        if (!auth?.startsWith('Bearer '))
            return res.status(401).json({ error: { message: 'Missing token' } });
        const token = auth.split(' ')[1];
        try {
            let payload;
            // Inspect token header to decide verification method (HS* vs RS*)
            let alg = null;
            try {
                const headerB64 = token.split('.')[0] || '';
                // JWT uses base64url encoding. Normalize to base64 for Buffer.
                const b64 = headerB64.replace(/-/g, '+').replace(/_/g, '/');
                const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
                const headerJson = Buffer.from(padded, 'base64').toString('utf8');
                const header = JSON.parse(headerJson || '{}');
                alg = header.alg || null;
                logger_1.logger.debug('Token header parsed', { alg, kid: header.kid });
            }
            catch (hdrErr) {
                logger_1.logger.debug('Failed to parse token header', { err: hdrErr });
            }
            // Treat RS* and ES* (ECDSA) tokens as asymmetric and verify via JWKS
            if (alg && (alg.startsWith('RS') || alg.startsWith('ES'))) {
                // RS* / ES* signed token — verify using remote JWKS (require SUPABASE_URL)
                logger_1.logger.info('Auth audit', { branch: 'jwks', alg, kid: undefined, status: 'attempt' });
                if (!process.env.SUPABASE_URL || !supabaseIssuer)
                    throw new Error('SUPABASE_URL not configured for RS/ES verification');
                try {
                    const p = await (0, jwks_1.verifyTokenWithJwks)(token, { issuer: supabaseIssuer, audience: 'authenticated', maxTokenAge: '1h' });
                    payload = p;
                    logger_1.logger.info('Auth audit', { branch: 'jwks', alg, kid: payload?.kid || undefined, status: 'success' });
                }
                catch (jwksErr) {
                    // Record a failed JWKS attempt in the audit logs and rethrow to be handled below
                    logger_1.logger.warn('Auth audit', { branch: 'jwks', alg, status: 'failed' });
                    throw jwksErr;
                }
            }
            else if (alg && alg.startsWith('HS')) {
                // HS* signed token — verify using the server-side JWT secret from Supabase settings
                logger_1.logger.info('Auth audit', { branch: 'hmac', alg, status: 'attempt' });
                const secret = process.env.JWT_SECRET || '';
                if (!secret) {
                    logger_1.logger.warn('Auth audit', { branch: 'hmac', alg, status: 'no-secret' });
                    throw new Error('No JWT_SECRET configured for HS256 verification');
                }
                try {
                    payload = jsonwebtoken_1.default.verify(token, secret, { algorithms: ['HS256'], issuer: supabaseIssuer || undefined, audience: 'authenticated', maxAge: '1h' });
                    logger_1.logger.info('Auth audit', { branch: 'hmac', alg, status: 'success' });
                }
                catch (hErr) {
                    logger_1.logger.warn('Auth audit', { branch: 'hmac', alg, status: 'failed' });
                    throw hErr;
                }
            }
            else {
                // Unknown algorithm or missing header — reject
                logger_1.logger.warn('Auth audit', { branch: 'unknown', alg: alg || 'none', status: 'unsupported' });
                throw new Error('Unsupported token algorithm');
            }
            // Attach user info and enforce basic RBAC
            const supabaseId = payload.sub || payload.userId || payload.id;
            const email = payload.email;
            const name = payload.name || payload.user_metadata?.full_name || payload.user_metadata?.name;
            // Ensure there's a caregiver record in Mongo linked to this supabaseId
            try {
                const dbUser = await caregiverService.findOrCreateBySupabaseId(String(supabaseId), { email, name });
                req.user = { id: supabaseId, email, role: payload.role || 'caregiver', caregiverId: dbUser._id || dbUser.id };
            }
            catch (syncErr) {
                logger_1.logger.debug('Failed to sync caregiver record', { err: syncErr });
                // continue with token-based identity but surface sync failure
                req.user = { id: supabaseId, email, role: payload.role || 'caregiver' };
            }
            // RBAC: allow passing a single role or an array. Also accept Supabase's 'authenticated'
            // role when the application expects 'caregiver' to be more permissive for Supabase-issued tokens.
            if (role) {
                const allowed = Array.isArray(role) ? role.slice() : [role];
                // Accept Supabase's generic 'authenticated' as equivalent to our app-level 'caregiver'
                if (allowed.includes('caregiver') && !allowed.includes('authenticated')) {
                    allowed.push('authenticated');
                }
                logger_1.logger.debug('RBAC check', { allowed, userRole: req.user.role });
                if (!allowed.includes(req.user.role))
                    return res.status(403).json({ error: { message: 'Forbidden' } });
            }
            return next();
        }
        catch (err) {
            logger_1.logger.debug('Auth verify failed', { err });
            return res.status(401).json({ error: { message: 'Invalid token' } });
        }
    };
}
