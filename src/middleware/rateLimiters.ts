import rateLimit from 'express-rate-limit';
import { Request } from 'express';

// Global: 100 requests per minute per IP (already configured in app.ts as a baseline,
// but we expose a named limiter for reuse if needed)
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests, please try again later.' } },
});

// Login: stricter to mitigate brute-force attempts
export const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // limit each IP to 10 login requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many login attempts, please try again later.' } },
  keyGenerator: (req: Request) => String(req.ip ?? req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown'),
});

// Signup: very strict to avoid mass account creation
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 signups per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many signup attempts, please try again later.' } },
  keyGenerator: (req: Request) => String(req.ip ?? req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown'),
});

// Placeholder for password reset if added: strict per IP
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many password reset attempts, please try again later.' } },
  keyGenerator: (req: Request) => String(req.ip ?? req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown'),
});

export default {
  globalLimiter,
  loginLimiter,
  signupLimiter,
  passwordResetLimiter,
};
