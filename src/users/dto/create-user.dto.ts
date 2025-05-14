import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z
  .string()
  .trim()
  .min(12)
  .refine((password) => /[a-z]/g.test(password ?? ""), 'Password must contain at least one lowercase letter')
  .refine((password) => /[A-Z]/g.test(password ?? ""), 'Password must contain at least one uppercase letter')
  .refine((password) => /[0-9]/g.test(password ?? ""), 'Password must contain at least one digit')
  .refine((password) => /[^a-zA-Z0-9]/g.test(password ?? ""), 'Password must contain at least one special character'),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;

