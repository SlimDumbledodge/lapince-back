import { z } from 'zod';

export const RegisterDtoSchema = z.object({
  firstName: z.string().trim(),
  lastName: z.string().trim(),
  email: z.string().trim().email(),
  password: z
    .string()
    .trim()
    .min(12)
    .refine((password) => /[a-z]/g.test(password ?? ""), 'Password must contain at least one lowercase letter')
    .refine((password) => /[A-Z]/g.test(password ?? ""), 'Password must contain at least one uppercase letter')
    .refine((password) => /[0-9]/g.test(password ?? ""), 'Password must contain at least one digit')
    .refine((password) => /[^a-zA-Z0-9]/g.test(password ?? ""), 'Password must contain at least one special character'),
})

export type RegisterDto = z.infer<typeof RegisterDtoSchema>;