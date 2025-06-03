import { z } from "zod";

export const LogoutDtoSchema = z.object({
  sessionId: z.string(),
}).strict();

export type LogoutDto = z.infer<typeof LogoutDtoSchema>;

