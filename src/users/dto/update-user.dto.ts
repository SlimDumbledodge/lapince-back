import { z } from 'zod';
import { locales as localesZones } from '../../db/constants/locale';

export const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  locale: z.enum(localesZones).optional(),
  avatar: z.string().optional(),
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
