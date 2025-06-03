import { z } from 'zod';

export const RefreshDtoSchema = z.object({
  refreshToken: z.string(),
}).strict();

export type RefreshDto = z.infer<typeof RefreshDtoSchema>;