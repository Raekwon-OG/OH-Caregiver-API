"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordResetLimiter = exports.signupLimiter = exports.loginLimiter = exports.globalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Global: 100 requests per minute per IP (already configured in app.ts as a baseline,
// but we expose a named limiter for reuse if needed)
exports.globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { message: 'Too many requests, please try again later.' } },
});
// Login: stricter to mitigate brute-force attempts
exports.loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10, // limit each IP to 10 login requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { message: 'Too many login attempts, please try again later.' } },
    keyGenerator: (req) => String(req.ip ?? req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown'),
});
// Signup: very strict to avoid mass account creation
exports.signupLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each IP to 5 signups per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { message: 'Too many signup attempts, please try again later.' } },
    keyGenerator: (req) => String(req.ip ?? req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown'),
});
// Placeholder for password reset if added: strict per IP
exports.passwordResetLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { message: 'Too many password reset attempts, please try again later.' } },
    keyGenerator: (req) => String(req.ip ?? req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown'),
});
exports.default = {
    globalLimiter: exports.globalLimiter,
    loginLimiter: exports.loginLimiter,
    signupLimiter: exports.signupLimiter,
    passwordResetLimiter: exports.passwordResetLimiter,
};
