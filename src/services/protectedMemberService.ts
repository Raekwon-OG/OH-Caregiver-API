import { ProtectedMember, IProtectedMember } from '../models/ProtectedMember';
import { emitToCaregiver } from '../utils/socket';
import { Types } from 'mongoose';
import { logger } from '../utils/logger';

export async function createMember(caregiverId: string, data: { firstName: string; lastName?: string; relationship: string }) {
  const created = await ProtectedMember.create({ ...data, caregiverId: new Types.ObjectId(caregiverId) });
  const obj = created.toObject();
  emitToCaregiver(caregiverId, 'member_added', obj);
  logger.info('protected_member.created', { caregiverId, memberId: obj._id?.toString?.() ?? null, firstName: obj.firstName });
  return obj;
}

export async function listMembers(caregiverId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const items = await ProtectedMember.find({ caregiverId }).skip(skip).limit(limit).lean();
  const total = await ProtectedMember.countDocuments({ caregiverId });
  return { items, total, page, limit };
}

export async function getMember(caregiverId: string, id: string) {
  const item = await ProtectedMember.findOne({ _id: id, caregiverId }).lean();
  return item;
}

export async function updateMember(caregiverId: string, id: string, updates: Partial<IProtectedMember>) {
  // optimistic concurrency: load document, apply changes and save with retry on version mismatch
  const envRetries = Number(process.env.PROTECTED_MEMBER_UPDATE_RETRIES || '') || 5;
  const maxAttempts = Math.min(Math.max(envRetries, 1), 10); // clamp between 1 and 10
  const baseDelayMs = 50;
  const jitterMaxMs = 100; // random jitter up to 100ms

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const doc = await ProtectedMember.findOne({ _id: id, caregiverId });
    if (!doc) return null;

    // apply updates
    Object.assign(doc, updates);

    try {
      const saved = await doc.save();
      const out = (saved as any).toObject ? (saved as any).toObject() : saved;
      // emit only after successful save
      emitToCaregiver(caregiverId, 'member_updated', out);
      logger.info('protected_member.updated', { caregiverId, memberId: id, attempt });
      return out;
    } catch (err: any) {
      // Mongoose VersionError indicates concurrent modification; retry with jittered backoff
      const name = err?.name || '';
      if (name === 'VersionError' && attempt < maxAttempts) {
        const jitter = Math.floor(Math.random() * jitterMaxMs);
        const delay = baseDelayMs * attempt + jitter;
        logger.warn('protected_member.update_version_conflict', { caregiverId, memberId: id, attempt, delay });
        // small backoff with jitter
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      logger.error('protected_member.update_failed', { caregiverId, memberId: id, err: String(err) });
      throw err;
    }
  }
  // if we exhausted attempts
  logger.error('protected_member.update_exhausted_retries', { caregiverId, memberId: id });
  throw new Error('Failed to update protected member due to concurrent modifications');
}

export async function deleteMember(caregiverId: string, id: string) {
  const res = await ProtectedMember.findOneAndDelete({ _id: id, caregiverId }).lean();
  if (res) {
    emitToCaregiver(caregiverId, 'member_deleted', { id });
    logger.info('protected_member.deleted', { caregiverId, memberId: id });
  }
  return res;
}
