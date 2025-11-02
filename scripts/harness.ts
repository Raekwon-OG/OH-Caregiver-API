import axios from 'axios';
import { io } from 'socket.io-client';

const API = process.env.API_URL || 'http://localhost:4000';

async function createSampleCaregiver() {
  const email = `sample+${Date.now()}@example.com`;
  const password = 'password123';
  const res = await axios.post(`${API}/api/caregivers/signup`, {
    name: 'Sample Caregiver',
    email,
    password,
  });
  console.log('Created caregiver', res.data);
  return { email, password, created: res.data };
}

async function createMembers(token: string) {
  const client = axios.create({ headers: { Authorization: `Bearer ${token}` } });
  const promises = [1, 2, 3].map((i) =>
    client.post(`${API}/api/protected-members`, {
      firstName: `Member ${i}`,
      lastName: `Test`,
      relationship: 'relative',
    })
  );
  const results = await Promise.all(promises);
  console.log('Created members', results.map((r) => r.data));
}

async function main() {
  const created = await createSampleCaregiver();
  // login to get token
  const loginRes = await axios.post(`${API}/api/caregivers/login`, {
    email: created.email,
    password: created.password,
  });
  const token = (loginRes.data as any)?.accessToken;
  if (!token) {
    console.log('No token returned from login');
    return;
  }

  const socket = io(API, { auth: { token } });
  socket.on('connect', () => console.log('Socket connected'));
  socket.on('member_added', (p: any) => console.log('member_added', p));
  socket.on('member_updated', (p: any) => console.log('member_updated', p));
  socket.on('member_deleted', (p: any) => console.log('member_deleted', p));

  await createMembers(token);
  // leave socket open for 5s to capture events
  await new Promise((r) => setTimeout(r, 5000));
  socket.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
