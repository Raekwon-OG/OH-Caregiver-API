import { z } from 'zod';

// Helper preprocessors
const trimString = (val: any) => (typeof val === 'string' ? val.trim() : val);
const optionalTrimToUndefined = (val: any) => {
  if (typeof val === 'string') {
    const t = val.trim();
    return t === '' ? undefined : t;
  }
  return val;
};
const toIntIfNumericString = (val: any) => {
  if (typeof val === 'string' && /^\s*-?\d+\s*$/.test(val)) return parseInt(val, 10);
  return val;
};

const StatusEnum = z.enum(['active', 'inactive']);

export const ProtectedMemberCreateSchema = z.object({
  firstName: z.preprocess(trimString, z.string().min(1)),
  lastName: z.preprocess(optionalTrimToUndefined, z.string().optional()),
  relationship: z.preprocess(trimString, z.string().min(1)),
  birthYear: z.preprocess(toIntIfNumericString, z.number().int().min(1900).max(new Date().getFullYear()).optional()),
  // accept values like 'Active' or ' ACTIVE ' by trimming + lowercasing before validation
  status: z.preprocess((val) => {
    if (typeof val === 'string') return val.trim().toLowerCase();
    return val;
  }, StatusEnum.optional().default('active')),
});

export const ProtectedMemberUpdateSchema = ProtectedMemberCreateSchema.partial();
