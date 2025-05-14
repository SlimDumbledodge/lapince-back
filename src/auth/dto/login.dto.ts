import { z } from 'zod';

export const LoginDtoSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().trim(),
})

export type LoginDto = z.infer<typeof LoginDtoSchema>;