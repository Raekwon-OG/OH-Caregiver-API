/// <reference types="jest" />
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import http from 'http';
// Mock JWKS utils to avoid importing ESM-only 'jose' during Jest run
jest.mock('../../src/utils/jwks', () => ({
  initJwks: () => undefined,
  prewarmJwks: async () => ({ ok: false }),
  checkJwksStatus: async () => ({ ok: false }),
}));

import { createApp } from '../../src/app';
import { connectDatabase } from '../../src/config/database';
import { initSocket } from '../../src/utils/socket';
import * as socketUtils from '../../src/utils/socket';

describe('ProtectedMember concurrent updates', () => {
  let mongod: MongoMemoryServer;
  let httpServer: http.Server | null = null;
  let baseUrl = '';

  beforeAll(async () => {
    process.env.SKIP_AUTH = 'true';
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await connectDatabase(uri);
    const app = await createApp();

    httpServer = http.createServer(app);
    // initialize socket.io on the test server
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

  test('concurrent updates should succeed with optimistic concurrency and emit socket events', async () => {
    const server = request(baseUrl);

  // spy on emitToCaregiver so we can assert emits without needing a real socket client
  const emitSpy = jest.spyOn(socketUtils, 'emitToCaregiver');

    const events: { added: any[]; updated: any[] } = { added: [], updated: [] };
    // record spy calls
    (emitSpy as jest.Mock).mockImplementation((...args: any[]) => {
      const [, event, payload] = args;
      if (event === 'member_added') events.added.push(payload);
      if (event === 'member_updated') events.updated.push(payload);
    });

    const createRes = await server
      .post('/api/protected-members')
      .send({ firstName: 'John', lastName: 'Doe', relationship: 'son', birthYear: 2010, status: 'active' })
      .expect(201);

    const id = createRes.body._id || createRes.body.id;

    // we should receive an added event for the create
  // wait briefly for the emitted event to be recorded by the spy
  await new Promise((r) => setTimeout(r, 100));
  expect(events.added.length).toBeGreaterThanOrEqual(1);
  expect(events.added[0]).toHaveProperty('_id');

    // perform two parallel updates
    const p1 = server.put(`/api/protected-members/${id}`).send({ firstName: 'A' });
    const p2 = server.put(`/api/protected-members/${id}`).send({ firstName: 'B' });

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const final = await server.get(`/api/protected-members/${id}`).expect(200);
    expect(final.body).toHaveProperty('firstName');
    // final value should be either A or B
    expect(['A', 'B']).toContain(final.body.firstName);

  // wait a bit for member_updated emits
  await new Promise((r) => setTimeout(r, 200));
  expect(events.updated.length).toBeGreaterThanOrEqual(1);
  // at least one updated payload should match the id
  expect(events.updated.some((e) => (e._id || e.id || e.id === id))).toBeTruthy();

  // restore spy
  emitSpy.mockRestore();
  }, 30000);
});
