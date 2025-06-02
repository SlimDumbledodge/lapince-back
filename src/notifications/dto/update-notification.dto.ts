import { z } from 'zod';

export const UpdateNotificationSchema = z.object({
  isRead: z.boolean().optional().default(true),
});

export type UpdateNotificationDto = z.infer<typeof UpdateNotificationSchema>;