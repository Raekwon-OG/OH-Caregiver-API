import { z } from 'zod';

export const ProtectedMemberCreateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  relationship: z.string().min(1),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const ProtectedMemberUpdateSchema = ProtectedMemberCreateSchema.partial();
