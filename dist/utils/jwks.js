"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initJwks = initJwks;
exports.verifyTokenWithJwks = verifyTokenWithJwks;
exports.prewarmJwks = prewarmJwks;
exports.checkJwksStatus = checkJwksStatus;
exports.getLastJwksError = getLastJwksError;
const jose_1 = require("jose");
const logger_1 = require("./logger");
let jwksUrl = null;
let remoteJwkSet = null;
let jwksCandidates = [];
let lastFetchError = null;
function initJwks(supabaseUrl) {
    jwksUrl = null;
    remoteJwkSet = null;
    lastFetchError = null;
    if (!supabaseUrl)
        return;
    const base = supabaseUrl.replace(/\/$/, '');
    // Candidate JWKS paths to try. We intentionally keep them as full URLs but avoid logging hosts.
    jwksCandidates = [
        `${base}/auth/v1/keys`,
        `${base}/auth/v1/jwks`,
        `${base}/.well-known/jwks.json`,
        `${base}/auth/v1/.well-known/jwks.json`
    ];
    // Create a remote JWK set lazily for the first candidate; prewarm will verify reachability.
    for (const _u of jwksCandidates) {
        try {
            remoteJwkSet = (0, jose_1.createRemoteJWKSet)(new URL(_u));
            jwksUrl = _u; // selected candidate; don't log the URL/host elsewhere
            logger_1.logger.info('Initialized remote JWKS');
            break;
        }
        catch (err) {
            lastFetchError = { error: String(err), at: new Date().toISOString() };
            logger_1.logger.debug('initJwks candidate failed', { at: lastFetchError.at });
            remoteJwkSet = null;
        }
    }
}
async function verifyTokenWithJwks(token, options) {
    if (!remoteJwkSet)
        throw new Error('JWKS not initialized');
    try {
        const verifyOptions = {};
        if (options?.issuer)
            verifyOptions.issuer = options.issuer;
        if (options?.audience)
            verifyOptions.audience = options.audience;
        if (options?.maxTokenAge)
            verifyOptions.maxTokenAge = options.maxTokenAge;
        const result = await (0, jose_1.jwtVerify)(token, remoteJwkSet, verifyOptions);
        return result.payload;
    }
    catch (err) {
        lastFetchError = { error: err, at: new Date().toISOString() };
        logger_1.logger.warn('verifyTokenWithJwks failed', { err });
        throw err;
    }
}
async function prewarmJwks() {
    if (!jwksCandidates || jwksCandidates.length === 0)
        return { ok: false, message: 'JWKS not configured', lastError: lastFetchError };
    logger_1.logger.info('Pre-warming JWKS');
    const apiKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const headers = {};
    if (apiKey)
        headers['apikey'] = apiKey;
    const attempts = [];
    for (const candidate of jwksCandidates) {
        try {
            const u = new URL(candidate);
            const pathOnly = u.pathname + (u.search || '');
            const res = await fetch(candidate, { method: 'GET', headers });
            if (!res.ok) {
                attempts.push({ path: pathOnly, status: res.status, ok: false });
                lastFetchError = { error: `HTTP ${res.status} ${res.statusText}`, at: new Date().toISOString() };
                logger_1.logger.error('JWKS prewarm attempt failed', { path: pathOnly, status: res.status });
                continue;
            }
            // success: set the remoteJwkSet to this candidate and record path only
            remoteJwkSet = (0, jose_1.createRemoteJWKSet)(u);
            jwksUrl = candidate; // keep it for later; do not log the URL/host
            attempts.push({ path: pathOnly, ok: true });
            logger_1.logger.info('JWKS prewarm succeeded', { path: pathOnly });
            return { ok: true, path: pathOnly };
        }
        catch (err) {
            // network or other error — record minimal info
            const errStr = String(err);
            lastFetchError = { error: errStr, at: new Date().toISOString() };
            attempts.push({ path: candidate, ok: false });
            logger_1.logger.error('JWKS prewarm error', { path: candidate, err: errStr.substring(0, 120) });
            continue;
        }
    }
    // all attempts failed—return masked attempt list (path + status)
    return { ok: false, attempts, lastError: lastFetchError };
}
async function checkJwksStatus() {
    if (!jwksCandidates || jwksCandidates.length === 0)
        return { ok: false, message: 'JWKS not configured', lastError: lastFetchError };
    try {
        // Probe the first candidate that we know about
        const candidate = jwksUrl || jwksCandidates[0];
        const u = new URL(candidate);
        const pathOnly = u.pathname + (u.search || '');
        const res = await fetch(candidate, { method: 'GET' });
        if (!res.ok) {
            lastFetchError = { error: `HTTP ${res.status} ${res.statusText}`, at: new Date().toISOString() };
            return { ok: false, status: res.status, path: pathOnly, lastError: { at: lastFetchError.at, message: lastFetchError.error } };
        }
        return { ok: true, path: pathOnly };
    }
    catch (err) {
        lastFetchError = { error: String(err), at: new Date().toISOString() };
        return { ok: false, lastError: { at: lastFetchError.at, message: lastFetchError.error } };
    }
}
function getLastJwksError() {
    return lastFetchError;
}
