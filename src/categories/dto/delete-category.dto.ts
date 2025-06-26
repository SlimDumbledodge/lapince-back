import { z } from 'zod';

export const DeleteCategorySchema = z.object({
  replaceOldTransactionsCategoryId: z.boolean().optional().default(false),
  newCategoryId: z.string().uuid().optional(),
}).refine((schema) => {
  if (schema.replaceOldTransactionsCategoryId && !schema.newCategoryId) {
    return false;
  }
  return true;
});

export type DeleteCategoryDto = z.infer<typeof DeleteCategorySchema>;