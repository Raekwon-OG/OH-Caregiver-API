import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { signupCaregiver, findCaregiverByEmail, verifyPassword } from '../services/caregiverService';

export async function signup(req: Request, res: Response) {
  const { name, email, password } = req.body;
  const user = await signupCaregiver(name, email, password);
  res.status(201).json({ id: user._id, name: user.name, email: user.email, createdAt: user.createdAt });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const user = await findCaregiverByEmail(email);
  if (!user) return res.status(401).json({ error: { message: 'Invalid credentials' } });
  const ok = await verifyPassword(user as any, password);
  if (!ok) return res.status(401).json({ error: { message: 'Invalid credentials' } });
  const token = jwt.sign({ sub: user._id.toString(), email: user.email, role: 'caregiver' }, process.env.JWT_SECRET || '');
  res.json({ accessToken: token, caregiver: { id: user._id, name: user.name, email: user.email } });
}

export async function me(req: Request, res: Response) {
  // req.user injected by auth middleware
  const user = (req as any).user;
  res.json({ id: user.id, email: user.email });
}
