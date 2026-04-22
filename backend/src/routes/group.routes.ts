import { Router as ExpressRouter } from "express";
import {
  getGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  inviteGroupMember,
  respondToGroupInvite,
  cancelGroupInvite,
  getPendingInvites,
  leaveGroup,
} from "../controllers/group.controller.js";

const router = ExpressRouter();

// GET /api/groups - List all groups for authenticated user
(router as any).get("/", getGroups);

// POST /api/groups - Create new group
(router as any).post("/", createGroup);

// GET /api/groups/pending-invites - Get pending group invites for user
(router as any).get("/pending-invites", getPendingInvites);

// GET /api/groups/:id - Get specific group
(router as any).get("/:id", getGroupById);

// PUT /api/groups/:id - Update group (admins only)
(router as any).put("/:id", updateGroup);

// DELETE /api/groups/:id - Delete group (admins only)
(router as any).delete("/:id", deleteGroup);

// GET /api/groups/:id/members - Get group members
(router as any).get("/:id/members", getGroupMembers);

// POST /api/groups/:id/members - Add member to group (admins only)
(router as any).post("/:id/members", addGroupMember);

// DELETE /api/groups/:id/members/:userId - Remove member from group (admins only)
(router as any).delete("/:id/members/:userId", removeGroupMember);

// POST /api/groups/:id/members/invite - Invite user to group (admins only)
(router as any).post("/:id/members/invite", inviteGroupMember);

// POST /api/groups/:id/invites/:inviteId/respond - Respond to group invite
(router as any).post("/:id/invites/:inviteId/respond", respondToGroupInvite);

// DELETE /api/groups/:id/invites/:userId - Cancel pending invite (admins only)
(router as any).delete("/:id/invites/:userId", cancelGroupInvite);

// POST /api/groups/:id/leave - Leave group
(router as any).post("/:id/leave", leaveGroup);

export default router;
