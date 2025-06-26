import { z } from 'zod';
import { locales as localesZone } from '../../db/constants/locale'

export const RegisterDtoSchema = z.object({
  firstName: z.string().min(1).trim(),
  lastName: z.string().min(1).trim(),
  email: z.string().trim().email(),
  password: z
    .string()
    .trim()
    .min(12)
    .refine((password) => /[a-z]/g.test(password ?? ""), 'Password must contain at least one lowercase letter')
    .refine((password) => /[A-Z]/g.test(password ?? ""), 'Password must contain at least one uppercase letter')
    .refine((password) => /[0-9]/g.test(password ?? ""), 'Password must contain at least one digit')
    .refine((password) => /[^a-zA-Z0-9]/g.test(password ?? ""), 'Password must contain at least one special character'),
  accountName: z.string().min(1).trim(),
  amount: z.number().min(0).default(0),
  locale: z.enum(localesZone).optional().default('fr-FR'),
})

export type RegisterDto = z.infer<typeof RegisterDtoSchema>;