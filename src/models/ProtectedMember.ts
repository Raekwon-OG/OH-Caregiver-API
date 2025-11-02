import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IProtectedMember extends Document {
  caregiverId: Types.ObjectId;
  firstName: string;
  lastName?: string;
  relationship: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProtectedMemberSchema: Schema = new Schema(
  {
    caregiverId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Caregiver' },
    firstName: { type: String, required: true },
    lastName: { type: String },
    relationship: { type: String, required: true },
  },
  { timestamps: true }
);

ProtectedMemberSchema.index({ caregiverId: 1 });

export const ProtectedMember = mongoose.model<IProtectedMember>('ProtectedMember', ProtectedMemberSchema);
