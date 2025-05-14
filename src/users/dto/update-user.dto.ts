import { CreateUserSchema } from './create-user.dto';
import { z } from 'zod';

export const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
