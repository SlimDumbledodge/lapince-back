import { z } from 'zod';

export const UpdatePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string()
  .trim()
  .min(12)
  .refine((password) => /[a-z]/g.test(password ?? ""), 'Password must contain at least one lowercase letter')
  .refine((password) => /[A-Z]/g.test(password ?? ""), 'Password must contain at least one uppercase letter')
  .refine((password) => /[0-9]/g.test(password ?? ""), 'Password must contain at least one digit')
  .refine((password) => /[^a-zA-Z0-9]/g.test(password ?? ""), 'Password must contain at least one special character'),
  confirmNewPassword: z.string().min(12, 'Confirm new password must be at least 12 characters long'),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: 'New password and confirm new password must match',
});

export type UpdatePasswordDto = z.infer<typeof UpdatePasswordSchema>;