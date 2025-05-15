import { icons } from 'lucide';
import { z } from 'zod';

export const LucideIconEnum = z.enum([
  ...Object.keys(icons),
] as [keyof typeof icons, ...(keyof typeof icons)[]]);

export type LucideIcon = z.infer<typeof LucideIconEnum>;