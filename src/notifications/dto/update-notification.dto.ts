import { z } from 'zod';

export const UpdateNotificationSchema = z.object({
  isRead: z.boolean().optional().default(true),
});

export type UpdateNotificationDto = z.infer<typeof UpdateNotificationSchema>;

export const UpdateMultipleNotificationsSchema = z.object({
  ids: z.array(z.string().uuid()),
  isRead: z.boolean().optional().default(true),
});

export type UpdateMultipleNotificationsDto = z.infer<typeof UpdateMultipleNotificationsSchema>;