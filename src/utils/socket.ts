import { Server as HttpServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from './logger';
import { verifyTokenWithJwks } from './jwks';
import * as caregiverService from '../services/caregiverService';

let io: SocketIO | null = null;

export function initSocket(server: HttpServer) {
  io = new SocketIO(server, { cors: { origin: '*' } });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (process.env.SKIP_AUTH === 'true') {
      // In test/dev mode we short-circuit auth. Attach a deterministic caregiverId so
      // test socket clients join the same caregiver room that server emits to.
      // Use TEST_SOCKET_CAREGIVER_ID if provided to make tests explicit.
      (socket as any).caregiverId = process.env.TEST_SOCKET_CAREGIVER_ID || '000000000000000000000000';
      return next();
    }
    if (!token) return next(new Error('Missing token'));
    try {
      // Parse token header to decide verification method
      let alg: string | null = null;
      try {
        const headerB64 = token.split('.')[0] || '';
        const b64 = headerB64.replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
        const headerJson = Buffer.from(padded, 'base64').toString('utf8');
        const header = JSON.parse(headerJson || '{}');
        alg = header.alg || null;
      } catch (hdrErr) {
        logger.debug('Failed to parse socket token header', { err: hdrErr });
      }

      let payload: any;
      if (alg && (alg.startsWith('RS') || alg.startsWith('ES'))) {
        // verify via JWKS
        if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL required for RS/ES socket auth');
        payload = await verifyTokenWithJwks(token, { issuer: process.env.SUPABASE_URL.replace(/\/$/, '') + '/auth/v1', audience: 'authenticated' }) as any;
      } else if (alg && alg.startsWith('HS')) {
        payload = jwt.verify(token, process.env.JWT_SECRET || '') as any;
      } else {
        throw new Error('Unsupported token algorithm for socket auth');
      }

      const supabaseId = payload.sub || payload.userId || payload.id;
      // Resolve DB caregiver id so socket rooms use the DB ObjectId string (consistent with REST handlers)
      try {
        const dbUser = await caregiverService.findOrCreateBySupabaseId(String(supabaseId), { email: payload.email, name: payload.name });
        const dbId = dbUser && (dbUser._id || dbUser.id) ? String(dbUser._id || dbUser.id) : undefined;
        (socket as any).caregiverId = dbId || String(supabaseId);
      } catch (syncErr) {
        logger.debug('Socket caregiver sync failed', { err: syncErr });
        (socket as any).caregiverId = String(supabaseId);
      }
      return next();
    } catch (err) {
      logger.debug('Socket auth failed', { err });
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const cId = (socket as any).caregiverId || 'unknown';
    socket.join(`caregiver:${cId}`);
    logger.info('Socket connected', { id: socket.id, caregiver: cId });
    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { id: socket.id });
    });
  });
}

export function emitToCaregiver(caregiverId: string, event: string, payload: any) {
  if (!io) return;
  io.to(`caregiver:${caregiverId}`).emit(event, payload);
}
