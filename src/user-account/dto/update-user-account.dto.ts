import { z } from 'zod';
import { CreateUserAccountSchema } from './create-user-account.dto';

export const UpdateUserAccountSchema = CreateUserAccountSchema.partial();

export type UpdateUserAccountDto = z.infer<typeof UpdateUserAccountSchema>;
