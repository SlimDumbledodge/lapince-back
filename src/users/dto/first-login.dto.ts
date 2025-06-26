import { z } from 'zod';
import { locales as localesZones } from 'src/db/constants/locale';
import { currencys } from 'src/db/constants/currency';

export const FirstLoginSchema = z.object({
  totalAmount: z.number().min(0, 'Total amount must be a positive number').optional(),
  currency: z.enum(currencys, {
    errorMap: () => ({ message: 'Currency must be a valid currency' }),
  }).optional(),
  accountName: z.string().min(1, 'Account name must be a non-empty string').optional(),
  locale: z.enum(localesZones, {
    errorMap: () => ({ message: 'Locale must be a valid locale' }),
  }).optional(),
});

export type FirstLoginDto = z.infer<typeof FirstLoginSchema>;