import { z } from 'zod';
import { currencys } from 'src/db/constants/currency';

export const CreateUserAccountSchema = z.object({
  accountName: z.string().trim(),
  amount: z.number(),
  currency: z.enum(currencys, {
    errorMap: () => ({ message: 'Currency must be a valid currency' }),
  }).optional(),
})

export type CreateUserAccountDto = z.infer<typeof CreateUserAccountSchema>;
