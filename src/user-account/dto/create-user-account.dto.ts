import { z } from 'zod';

export const CreateUserAccountSchema = z.object({
  accountName: z.string().trim(),
  amount: z.number(),
})

export type CreateUserAccountDto = z.infer<typeof CreateUserAccountSchema>;
