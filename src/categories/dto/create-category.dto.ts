import { z } from 'zod';
import { LucideIconEnum } from 'src/common/validator/lucide-icon.schema';

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(64),
  color: z.string().min(1).max(10).regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: "Invalid hex color. Expected format: #RRGGBB or #RGB",
  }),
  icon: LucideIconEnum,
})

export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>;
