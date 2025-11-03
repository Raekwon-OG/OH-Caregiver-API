import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { logger } from './logger';

let jwksUrl: string | null = null;
let remoteJwkSet: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksCandidates: string[] = [];
let lastFetchError: { error: any; at: string } | null = null;

export function initJwks(supabaseUrl?: string) {
  jwksUrl = null;
  remoteJwkSet = null;
  lastFetchError = null;
  if (!supabaseUrl) return;
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
      remoteJwkSet = createRemoteJWKSet(new URL(_u));
      jwksUrl = _u; // selected candidate; don't log the URL/host elsewhere
      logger.info('Initialized remote JWKS');
      break;
    } catch (err) {
      lastFetchError = { error: String(err), at: new Date().toISOString() };
      logger.debug('initJwks candidate failed', { at: lastFetchError.at });
      remoteJwkSet = null;
    }
  }
}

export async function verifyTokenWithJwks(
  token: string,
  options?: { issuer?: string; audience?: string | string[]; maxTokenAge?: string }
) {
  if (!remoteJwkSet) throw new Error('JWKS not initialized');
  try {
    const verifyOptions: any = {};
    if (options?.issuer) verifyOptions.issuer = options.issuer;
    if (options?.audience) verifyOptions.audience = options.audience;
    if (options?.maxTokenAge) verifyOptions.maxTokenAge = options.maxTokenAge;
    const result = await jwtVerify(token, remoteJwkSet, verifyOptions);
    return result.payload as JWTPayload;
  } catch (err) {
    lastFetchError = { error: err, at: new Date().toISOString() };
    logger.warn('verifyTokenWithJwks failed', { err });
    throw err;
  }
}

export async function prewarmJwks() {
  if (!jwksCandidates || jwksCandidates.length === 0) return { ok: false, message: 'JWKS not configured', lastError: lastFetchError };
  logger.info('Pre-warming JWKS');
  const apiKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const headers: Record<string, string> = {};
  if (apiKey) headers['apikey'] = apiKey;

  const attempts: Array<{ path: string; status?: number; ok: boolean }> = [];
  for (const candidate of jwksCandidates) {
    try {
      const u = new URL(candidate);
      const pathOnly = u.pathname + (u.search || '');
      const res = await fetch(candidate, { method: 'GET', headers });
      if (!res.ok) {
        attempts.push({ path: pathOnly, status: res.status, ok: false });
        lastFetchError = { error: `HTTP ${res.status} ${res.statusText}`, at: new Date().toISOString() };
        logger.error('JWKS prewarm attempt failed', { path: pathOnly, status: res.status });
        continue;
      }
      // success: set the remoteJwkSet to this candidate and record path only
      remoteJwkSet = createRemoteJWKSet(u);
      jwksUrl = candidate; // keep it for later; do not log the URL/host
      attempts.push({ path: pathOnly, ok: true });
      logger.info('JWKS prewarm succeeded', { path: pathOnly });
      return { ok: true, path: pathOnly };
    } catch (err) {
      // network or other error — record minimal info
      const errStr = String(err);
      lastFetchError = { error: errStr, at: new Date().toISOString() };
      attempts.push({ path: candidate, ok: false });
      logger.error('JWKS prewarm error', { path: candidate, err: errStr.substring(0, 120) });
      continue;
    }
  }
  // all attempts failed—return masked attempt list (path + status)
  return { ok: false, attempts, lastError: lastFetchError };
}

export async function checkJwksStatus() {
  if (!jwksCandidates || jwksCandidates.length === 0) return { ok: false, message: 'JWKS not configured', lastError: lastFetchError };
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
  } catch (err) {
    lastFetchError = { error: String(err), at: new Date().toISOString() };
    return { ok: false, lastError: { at: lastFetchError.at, message: lastFetchError.error } };
  }
}

export function getLastJwksError() {
  return lastFetchError;
}
