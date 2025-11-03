import { z } from 'zod';

export const ProtectedMemberCreateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  relationship: z.string().min(1),
});

export const ProtectedMemberUpdateSchema = ProtectedMemberCreateSchema.partial();
