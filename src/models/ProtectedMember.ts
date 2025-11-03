import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IProtectedMember extends Document {
  caregiverId: Types.ObjectId;
  firstName: string;
  lastName?: string;
  relationship: string;
  birthYear?: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const ProtectedMemberSchema: Schema = new Schema(
  {
    caregiverId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Caregiver' },
    firstName: { type: String, required: true },
    lastName: { type: String },
    relationship: { type: String, required: true },
    birthYear: { type: Number, required: false, index: false },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true, optimisticConcurrency: true }
);

ProtectedMemberSchema.index({ caregiverId: 1 });

export const ProtectedMember = mongoose.model<IProtectedMember>('ProtectedMember', ProtectedMemberSchema);
