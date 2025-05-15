import { icons } from 'lucide';
import { z } from 'zod';

export const LucideIconEnum = z.enum([
  ...Object.keys(icons),
] as [keyof typeof icons, ...(keyof typeof icons)[]], {
  message: 'Invalid icon. The icon must be a valid Lucide icon',
});

export type LucideIcon = z.infer<typeof LucideIconEnum>;