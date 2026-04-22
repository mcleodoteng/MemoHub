import { z } from "zod";

export const createGroupSchema = z.object({
  name: z
    .string()
    .min(1, "Group name is required")
    .max(100, "Group name too long"),
  description: z.string().max(500, "Description too long").optional(),
  type: z.enum(["department", "project", "custom"]).default("custom"),
  memberIds: z.array(z.string()).optional(),
  avatar: z.string().url().optional(),
});

export const updateGroupSchema = z.object({
  name: z
    .string()
    .min(1, "Group name is required")
    .max(100, "Group name too long")
    .optional(),
  description: z.string().max(500, "Description too long").optional(),
  avatar: z.string().url().optional(),
});

export const addMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(["admin", "member"]).default("member"),
});

export const inviteMemberSchema = z.object({
  userId: z.string(),
  email: z.string().email().optional(),
});

export const respondToInviteSchema = z.object({
  status: z.enum(["accepted", "declined"]),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type RespondToInviteInput = z.infer<typeof respondToInviteSchema>;
