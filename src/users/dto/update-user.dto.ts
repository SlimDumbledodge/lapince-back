import { CreateUserSchema } from './create-user.dto';
import { z } from 'zod';

export const UpdateUserSchema = CreateUserSchema.partial();

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
