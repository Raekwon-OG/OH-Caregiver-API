import bcrypt from 'bcrypt';
import { Caregiver, ICaregiver } from '../models/Caregiver';

export async function signupCaregiver(name: string, email: string, password: string) {
  const existing = await Caregiver.findOne({ email }).lean();
  if (existing) throw { status: 400, message: 'Email already in use' };
  const hash = await bcrypt.hash(password, 10);
  const created = await Caregiver.create({ name, email, passwordHash: hash });
  return created.toObject();
}

export async function findCaregiverByEmail(email: string) {
  return Caregiver.findOne({ email }).lean();
}

export async function verifyPassword(caregiver: Partial<ICaregiver>, password: string) {
  if (!caregiver.passwordHash) return false;
  return bcrypt.compare(password, caregiver.passwordHash);
}
