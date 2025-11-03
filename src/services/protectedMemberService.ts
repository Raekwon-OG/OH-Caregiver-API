import { ProtectedMember, IProtectedMember } from '../models/ProtectedMember';
import { emitToCaregiver } from '../utils/socket';
import { Types } from 'mongoose';

export async function createMember(caregiverId: string, data: { firstName: string; lastName?: string; relationship: string }) {
  const created = await ProtectedMember.create({ ...data, caregiverId: new Types.ObjectId(caregiverId) });
  const obj = created.toObject();
  emitToCaregiver(caregiverId, 'member_added', obj);
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
  const updated = await ProtectedMember.findOneAndUpdate({ _id: id, caregiverId }, updates, { new: true }).lean();
  if (updated) emitToCaregiver(caregiverId, 'member_updated', updated);
  return updated;
}

export async function deleteMember(caregiverId: string, id: string) {
  const res = await ProtectedMember.findOneAndDelete({ _id: id, caregiverId }).lean();
  if (res) emitToCaregiver(caregiverId, 'member_deleted', { id });
  return res;
}
