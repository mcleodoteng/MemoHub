import { Request, Response } from "express";
import { GroupService } from "../services/group.service.js";
import { AuthRequest } from "../middleware/auth.middleware.js";
import {
  createGroupSchema,
  updateGroupSchema,
  addMemberSchema,
  inviteMemberSchema,
  respondToInviteSchema,
} from "../validators/group.validator.js";
import { hasPermission } from "../middleware/role-permissions.js";
import { isSuperuserEmail } from "../utils/superuser.js";

const groupService = new GroupService();

export const getGroups = async (req: AuthRequest, res: Response) => {
  try {
    const { type, search, page = 1, limit = 20 } = req.query;
    const userId = req.user?.id;

    const filters: any = {};
    if (type) filters.type = type;
    if (search) filters.search = search;
    if (userId) filters.memberUserId = userId; // Only show groups user is member of

    const result = await groupService.getGroups(
      filters,
      parseInt(page as string) || 1,
      parseInt(limit as string) || 20,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get groups error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch groups",
    });
  }
};

export const getGroupById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const group = await groupService.getGroupById(id);

    if (!group) {
      return res.status(404).json({
        success: false,
        error: "Group not found",
      });
    }

    res.json({
      success: true,
      data: { group },
    });
  } catch (error) {
    console.error("Get group error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch group",
    });
  }
};

export const createGroup = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const canCreateGroups =
      hasPermission(req.user?.role, "canCreateGroups") ||
      isSuperuserEmail(req.user?.email);

    if (!canCreateGroups) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to create groups",
      });
    }

    const validationResult = createGroupSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid input data",
        details: validationResult.error.issues,
      });
    }

    const group = await groupService.createGroup(validationResult.data, userId);

    res.status(201).json({
      success: true,
      data: { group },
    });
  } catch (error) {
    console.error("Create group error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create group",
    });
  }
};

export const updateGroup = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (!hasPermission(req.user?.role, "canManageGroups")) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to manage groups",
      });
    }

    // Check if user is allowed to manage this group
    const group = await groupService.getGroupById(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        error: "Group not found",
      });
    }

    const isAdmin = group.members.some(
      (m: { userId: string; role: string }) =>
        m.userId === userId && m.role === "admin",
    );
    const isMember = group.members.some(
      (m: { userId: string; role: string }) => m.userId === userId,
    );
    const canManageGroups = hasPermission(req.user?.role, "canManageGroups");
    if (!isAdmin && !(canManageGroups && isMember)) {
      return res.status(403).json({
        success: false,
        error: "Only group admins or authorized managers can update group",
      });
    }

    const validationResult = updateGroupSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid input data",
        details: validationResult.error.issues,
      });
    }

    const updated = await groupService.updateGroup(id, validationResult.data);

    res.json({
      success: true,
      data: { group: updated },
    });
  } catch (error) {
    console.error("Update group error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update group",
    });
  }
};

export const deleteGroup = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (!hasPermission(req.user?.role, "canDeleteGroups")) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to delete groups",
      });
    }

    // Check if user is admin
    const group = await groupService.getGroupById(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        error: "Group not found",
      });
    }

    const isAdmin = group.members.some(
      (m: { userId: string; role: string }) =>
        m.userId === userId && m.role === "admin",
    );
    if (
      !isAdmin &&
      req.user?.role !== "admin" &&
      req.user?.role !== "super_admin"
    ) {
      return res.status(403).json({
        success: false,
        error: "Only group admins can delete group",
      });
    }

    await groupService.deleteGroup(id);

    res.json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error("Delete group error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete group",
    });
  }
};

export const getGroupMembers = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const members = await groupService.getMembers(id);

    res.json({
      success: true,
      data: { members },
    });
  } catch (error) {
    console.error("Get group members error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch group members",
    });
  }
};

export const addGroupMember = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.body;
    const requestingUserId = req.user?.id;

    if (!requestingUserId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (!hasPermission(req.user?.role, "canManageGroups")) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to manage groups",
      });
    }

    const validationResult = addMemberSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid input data",
        details: validationResult.error.issues,
      });
    }

    // Check if requesting user can manage this group
    const group = await groupService.getGroupById(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        error: "Group not found",
      });
    }

    const isAdmin = group.members.some(
      (m: { userId: string; role: string }) =>
        m.userId === requestingUserId && m.role === "admin",
    );
    const isMember = group.members.some(
      (m: { userId: string; role: string }) => m.userId === requestingUserId,
    );
    const canManageGroups = hasPermission(req.user?.role, "canManageGroups");
    if (!isAdmin && !(canManageGroups && isMember)) {
      return res.status(403).json({
        success: false,
        error: "Only group admins or authorized managers can add members",
      });
    }

    const member = await groupService.addMember(id, userId, role);

    res.status(201).json({
      success: true,
      data: { member },
    });
  } catch (error: any) {
    console.error("Add group member error:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to add member",
    });
  }
};

export const removeGroupMember = async (req: AuthRequest, res: Response) => {
  try {
    const { id, userId } = req.params;
    const requestingUserId = req.user?.id;

    if (!requestingUserId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (!hasPermission(req.user?.role, "canManageGroups")) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to manage groups",
      });
    }

    const group = await groupService.getGroupById(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        error: "Group not found",
      });
    }

    const isAdmin = group.members.some(
      (m: { userId: string; role: string }) =>
        m.userId === requestingUserId && m.role === "admin",
    );
    const isMember = group.members.some(
      (m: { userId: string; role: string }) => m.userId === requestingUserId,
    );
    const canManageGroups = hasPermission(req.user?.role, "canManageGroups");

    if (!isAdmin && !(canManageGroups && isMember)) {
      return res.status(403).json({
        success: false,
        error: "Only group admins or authorized managers can remove members",
      });
    }

    await groupService.removeMember(id, userId, requestingUserId);

    res.json({
      success: true,
      data: {},
    });
  } catch (error: any) {
    console.error("Remove group member error:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to remove member",
    });
  }
};

export const inviteGroupMember = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId, email } = req.body;
    const requestingUserId = req.user?.id;

    if (!requestingUserId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (!hasPermission(req.user?.role, "canManageGroups")) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to manage groups",
      });
    }

    const group = await groupService.getGroupById(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        error: "Group not found",
      });
    }

    const isAdmin = group.members.some(
      (m: { userId: string; role: string }) =>
        m.userId === requestingUserId && m.role === "admin",
    );
    const isMember = group.members.some(
      (m: { userId: string; role: string }) => m.userId === requestingUserId,
    );
    const canManageGroups = hasPermission(req.user?.role, "canManageGroups");

    if (!isAdmin && !(canManageGroups && isMember)) {
      return res.status(403).json({
        success: false,
        error: "Only group admins or authorized managers can invite members",
      });
    }

    const validationResult = inviteMemberSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid input data",
        details: validationResult.error.issues,
      });
    }

    const invite = await groupService.inviteMember(
      id,
      userId,
      requestingUserId,
      email,
    );

    res.status(201).json({
      success: true,
      data: { invite },
    });
  } catch (error: any) {
    console.error("Invite group member error:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to invite member",
    });
  }
};

export const respondToGroupInvite = async (req: AuthRequest, res: Response) => {
  try {
    const { id, inviteId } = req.params;
    const { status } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const validationResult = respondToInviteSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid input data",
        details: validationResult.error.issues,
      });
    }

    const invite = await groupService.respondToInvite(id, userId, status);

    res.json({
      success: true,
      data: { invite },
    });
  } catch (error: any) {
    console.error("Respond to invite error:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to respond to invite",
    });
  }
};

export const cancelGroupInvite = async (req: AuthRequest, res: Response) => {
  try {
    const { id, userId } = req.params;
    const requestingUserId = req.user?.id;

    if (!requestingUserId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (!hasPermission(req.user?.role, "canManageGroups")) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to manage groups",
      });
    }

    const group = await groupService.getGroupById(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        error: "Group not found",
      });
    }

    const isAdmin = group.members.some(
      (m: { userId: string; role: string }) =>
        m.userId === requestingUserId && m.role === "admin",
    );
    const isMember = group.members.some(
      (m: { userId: string; role: string }) => m.userId === requestingUserId,
    );
    const canManageGroups = hasPermission(req.user?.role, "canManageGroups");

    if (!isAdmin && !(canManageGroups && isMember)) {
      return res.status(403).json({
        success: false,
        error:
          "Only group admins or authorized managers can cancel invitations",
      });
    }

    const result = await groupService.cancelInvite(
      id,
      userId,
      requestingUserId,
    );

    res.json({
      success: true,
      data: { invite: result },
    });
  } catch (error: any) {
    console.error("Cancel invite error:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to cancel invite",
    });
  }
};

export const getPendingInvites = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const invites = await groupService.getPendingInvites(userId);

    res.json({
      success: true,
      data: { invites },
    });
  } catch (error) {
    console.error("Get pending invites error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch pending invites",
    });
  }
};

export const leaveGroup = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    await groupService.leaveGroup(id, userId);

    res.json({
      success: true,
      data: {},
    });
  } catch (error: any) {
    console.error("Leave group error:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to leave group",
    });
  }
};
