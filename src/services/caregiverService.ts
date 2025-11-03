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
  return bcrypt.compare(password, caregiver.passwordHash as string);
}

export async function findOrCreateBySupabaseId(supabaseId: string, attrs: { email?: string; name?: string }) {
  // Try to find by supabaseId first
  let existing = await Caregiver.findOne({ supabaseId }).lean();
  if (existing) return existing;

  // Fallback: if an account with same email exists, link it (do not overwrite passwordHash)
  if (attrs.email) {
    existing = await Caregiver.findOne({ email: attrs.email }).lean();
    if (existing) {
      // link existing document
      await Caregiver.updateOne({ _id: existing._id }, { $set: { supabaseId } });
      return { ...existing, supabaseId };
    }
  }

  // Create minimal caregiver record (no passwordHash)
  const created = await Caregiver.create({ name: attrs.name || 'Supabase User', email: attrs.email || `${supabaseId}@supabase`, supabaseId });
  return created.toObject();
}
