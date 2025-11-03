"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = initSocket;
exports.emitToCaregiver = emitToCaregiver;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("./logger");
let io = null;
function initSocket(server) {
    io = new socket_io_1.Server(server, { cors: { origin: '*' } });
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (process.env.SKIP_AUTH === 'true') {
            // In test/dev mode we short-circuit auth. Attach a deterministic caregiverId so
            // test socket clients join the same caregiver room that server emits to.
            // Use TEST_SOCKET_CAREGIVER_ID if provided to make tests explicit.
            socket.caregiverId = process.env.TEST_SOCKET_CAREGIVER_ID || '000000000000000000000000';
            return next();
        }
        if (!token)
            return next(new Error('Missing token'));
        try {
            const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || '');
            // attach caregiver id to socket
            socket.caregiverId = payload.sub || payload.userId || payload.id;
            return next();
        }
        catch (err) {
            logger_1.logger.debug('Socket auth failed', { err });
            return next(new Error('Unauthorized'));
        }
    });
    io.on('connection', (socket) => {
        const cId = socket.caregiverId || 'unknown';
        socket.join(`caregiver:${cId}`);
        logger_1.logger.info('Socket connected', { id: socket.id, caregiver: cId });
        socket.on('disconnect', () => {
            logger_1.logger.info('Socket disconnected', { id: socket.id });
        });
    });
}
function emitToCaregiver(caregiverId, event, payload) {
    if (!io)
        return;
    io.to(`caregiver:${caregiverId}`).emit(event, payload);
}
