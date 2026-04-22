import { z } from "zod";

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
  department: z.string().min(1).max(100).optional(),
  status: z.enum(["online", "offline", "away", "busy"]).optional(),
  role: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_]+$/)
    .optional(),
  twoFactorEnabled: z.boolean().optional(),
  sessionTimeoutMinutes: z.number().int().min(5).max(480).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
