/// <reference types="jest" />
// This test uses a real socket.io-client to verify end-to-end delivery. It is
// intentionally skipped by default and only runs when RUN_REAL_SOCKET=true so
// it won't run in CI. To run locally:
// RUN_REAL_SOCKET=true npm test -- tests/integration/protectedMember.realSocket.test.ts

// Mock JWKS utils to avoid importing ESM-only 'jose' during Jest run
jest.mock('../../src/utils/jwks', () => ({
  initJwks: () => undefined,
  prewarmJwks: async () => ({ ok: false }),
  checkJwksStatus: async () => ({ ok: false }),
}));

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import http from 'http';
import { io as ioClient, Socket } from 'socket.io-client';
import { createApp } from '../../src/app';
import { connectDatabase } from '../../src/config/database';
import { initSocket } from '../../src/utils/socket';

const RUN_REAL = process.env.RUN_REAL_SOCKET === 'true';

(RUN_REAL ? describe : describe.skip)('ProtectedMember real socket integration (manual)', () => {
  let mongod: MongoMemoryServer;
  let httpServer: http.Server | null = null;
  let baseUrl = '';

  beforeAll(async () => {
    process.env.SKIP_AUTH = 'true';
    // use explicit test caregiver id so socket and server agree
    process.env.TEST_SOCKET_CAREGIVER_ID = '000000000000000000000000';

    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await connectDatabase(uri);
    const app = await createApp();

    httpServer = http.createServer(app);
    initSocket(httpServer);

    await new Promise<void>((resolve) => httpServer!.listen(0, () => resolve()));
    const addr = httpServer.address() as any;
    const port = addr.port;
    baseUrl = `http://127.0.0.1:${port}`;
  }, 30000);

  afterAll(async () => {
    if (httpServer) await new Promise((r) => httpServer!.close(() => r(undefined)));
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  test('end-to-end socket client should receive member_added and member_updated emits', async () => {
    const server = request(baseUrl);

    const received: { added: any[]; updated: any[] } = { added: [], updated: [] };

    const client: Socket = ioClient(baseUrl, {
      transports: ['websocket'],
      auth: { token: 'test-token' },
      reconnection: false,
    }) as Socket;

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => resolve());
      client.on('connect_error', (err: any) => reject(err));
      // safety timeout
      setTimeout(() => reject(new Error('Socket connect timeout')), 5000);
    });

    client.on('member_added', (p: any) => received.added.push(p));
    client.on('member_updated', (p: any) => received.updated.push(p));

    const createRes = await server
      .post('/api/protected-members')
      .send({ firstName: 'Socket', lastName: 'Test', relationship: 'friend' })
      .expect(201);

    const id = createRes.body._id || createRes.body.id;

    // wait for member_added
    await new Promise((r) => setTimeout(r, 200));
    expect(received.added.length).toBeGreaterThanOrEqual(1);

    const p1 = server.put(`/api/protected-members/${id}`).send({ firstName: 'S1' });
    const p2 = server.put(`/api/protected-members/${id}`).send({ firstName: 'S2' });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    // wait for updates to arrive
    await new Promise((r) => setTimeout(r, 300));
    expect(received.updated.length).toBeGreaterThanOrEqual(1);

    client.close();
  }, 30000);
});
