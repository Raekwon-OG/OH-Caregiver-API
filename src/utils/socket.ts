import { Server as HttpServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from './logger';

let io: SocketIO | null = null;

export function initSocket(server: HttpServer) {
  io = new SocketIO(server, { cors: { origin: '*' } });

  io.use((socket, next) => {
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
      const payload = jwt.verify(token, process.env.JWT_SECRET || '') as any;
      // attach caregiver id to socket
      (socket as any).caregiverId = payload.sub || payload.userId || payload.id;
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
