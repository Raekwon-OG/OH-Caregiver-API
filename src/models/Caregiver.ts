import mongoose, { Schema, Document } from 'mongoose';

export interface ICaregiver extends Document {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const CaregiverSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

export const Caregiver = mongoose.model<ICaregiver>('Caregiver', CaregiverSchema);
