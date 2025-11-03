import { z } from 'zod';

export const CaregiverSignupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export const CaregiverLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
