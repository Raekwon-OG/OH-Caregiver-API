import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../../src/app';
import { connectDatabase } from '../../src/config/database';

describe('ProtectedMember concurrent updates', () => {
  let mongod: MongoMemoryServer;
  let app: any;

  beforeAll(async () => {
    process.env.SKIP_AUTH = 'true';
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await connectDatabase(uri);
    app = await createApp();
  }, 20000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  test('concurrent updates should succeed with optimistic concurrency', async () => {
    const server = request(app);

    const createRes = await server
      .post('/api/protected-members')
      .send({ firstName: 'John', lastName: 'Doe', relationship: 'son' })
      .expect(201);

    const id = createRes.body._id || createRes.body.id;

    // perform two parallel updates
    const p1 = server.put(`/api/protected-members/${id}`).send({ firstName: 'A' });
    const p2 = server.put(`/api/protected-members/${id}`).send({ firstName: 'B' });

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const final = await server.get(`/api/protected-members/${id}`).expect(200);
    expect(final.body).toHaveProperty('firstName');
  });
});
