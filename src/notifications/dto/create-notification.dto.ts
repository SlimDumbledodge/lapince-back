import { z } from 'zod';

export const typeEnum = z.enum(['transaction', 'budget', 'reminder'])

export const createNotificationSchema = z.object({
  type: typeEnum,
  message: z.string(),
  level : z.enum(['success', 'info', 'warning', 'error']).default('info'),
})

export type CreateNotificationDto = z.infer<typeof createNotificationSchema>
