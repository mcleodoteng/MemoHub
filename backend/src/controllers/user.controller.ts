import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { UserService } from "../services/user.service.js";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { updateUserSchema } from "../validators/user.validator.js";
import { UserProfileService } from "../services/user-profile.service.js";
import { GroupService } from "../services/group.service.js";
import {
  canManageRole,
  hasPermission,
  roleHierarchy,
  type RolePermissions,
  type UserRole,
} from "../middleware/role-permissions.js";
import { resolveEffectiveRole } from "../utils/superuser.js";
import { prisma } from "../config/prisma.js";
import { writeAuditLog } from "../utils/audit-log.js";
import {
  deleteRoleConfig,
  getResolvedPermissions,
  getResolvedBaseRole,
  getResolvedRoleLabel,
  getStoredRoleConfig,
  listStoredRoleConfigs,
  upsertRoleConfig,
} from "../services/role-config.service.js";
import { io } from "../server.js";

const userService = new UserService();
const userProfileService = new UserProfileService();
const groupService = new GroupService();

function emitRbacUpdated(options?: {
  userIds?: string[];
  roleKey?: string;
  reason?: string;
}) {
  const payload = {
    reason: options?.reason || "permissions_changed",
    roleKey: options?.roleKey,
    userIds: options?.userIds || [],
    timestamp: new Date().toISOString(),
  };

  io.emit("rbac:updated", payload);

  (options?.userIds || []).forEach((userId) => {
    io.to(`user_${userId}`).emit("rbac:updated", payload);
  });
}

function withEffectiveRole<T extends { role?: string; email?: string }>(
  user: T,
): T & {
  assignedRoleKey: string;
  assignedRoleName: string;
  baseRole: UserRole;
} {
  const assignedRoleKey = user.role || "member";
  const baseRole = getResolvedBaseRole(assignedRoleKey);
  return {
    ...user,
    role: resolveEffectiveRole(baseRole, user.email),
    assignedRoleKey,
    assignedRoleName: getResolvedRoleLabel(assignedRoleKey),
    baseRole,
  };
}

function canEditRoleConfiguration(actorRole: string, targetBaseRole: UserRole) {
  const actorBaseRole = getResolvedBaseRole(actorRole);
  if (actorBaseRole === "super_admin") return true;
  if (actorBaseRole === "admin") return targetBaseRole !== "super_admin";
  return false;
}

function canAccessRoleManagement(actorRole: string) {
  const actorBaseRole = getResolvedBaseRole(actorRole);
  return actorBaseRole === "super_admin" || actorBaseRole === "admin";
}

function canViewUsers(actorRole: string) {
  return (
    canAccessRoleManagement(actorRole) ||
    hasPermission(actorRole, "canViewAllUsers")
  );
}

function canManageUsers(actorRole: string) {
  return (
    canAccessRoleManagement(actorRole) ||
    hasPermission(actorRole, "canManageUsers")
  );
}

function canAssignUserRoles(actorRole: string) {
  return (
    canAccessRoleManagement(actorRole) ||
    hasPermission(actorRole, "canAssignRoles")
  );
}

export class UserController {
  async getRoleConfigurations(req: AuthRequest, res: Response) {
    try {
      const actorRole = req.user?.role || "member";
      if (!canAccessRoleManagement(actorRole)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      const roles = listStoredRoleConfigs();

      res.json({ success: true, data: { roles } });
    } catch {
      res.status(500).json({ success: false, error: "Failed to fetch roles" });
    }
  }

  async getCurrentUserPermissions(req: AuthRequest, res: Response) {
    try {
      const roleKey = req.user?.role || "member";
      const config = getStoredRoleConfig(roleKey);

      res.json({
        success: true,
        data: {
          assignedRoleKey: config.key,
          assignedRoleName: config.name,
          baseRole: config.baseRole,
          permissions: getResolvedPermissions(config.key),
        },
      });
    } catch {
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch permissions" });
    }
  }

  async createRoleConfiguration(req: AuthRequest, res: Response) {
    try {
      const actorId = req.user?.id;
      const actorRole = req.user?.role || "member";

      if (!actorId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }
      if (!canAccessRoleManagement(actorRole)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      const permissionShape = z.object({
        canCreateMemo: z.boolean(),
        canDeleteAnyMemo: z.boolean(),
        canEditAnyMemo: z.boolean(),
        canPinMemos: z.boolean(),
        canArchiveMemos: z.boolean(),
        canViewAllMemos: z.boolean(),
        canApproveAsModerator: z.boolean(),
        canManageTemplates: z.boolean(),
        canConfigureWorkflows: z.boolean(),
        canCreateGroups: z.boolean(),
        canDeleteGroups: z.boolean(),
        canManageGroups: z.boolean(),
        canAssignGroupLeaders: z.boolean(),
        canManageUsers: z.boolean(),
        canAssignRoles: z.boolean(),
        canViewAllUsers: z.boolean(),
        canDeactivateUsers: z.boolean(),
        canAccessSystemSettings: z.boolean(),
        canManageSecuritySettings: z.boolean(),
        canViewAuditLogs: z.boolean(),
        canAccessReports: z.boolean(),
        canManageIntegrations: z.boolean(),
        canAccessDeveloperTools: z.boolean(),
        canSendBroadcasts: z.boolean(),
        canManageNotificationPolicies: z.boolean(),
      });

      const schema = z.object({
        key: z
          .string()
          .min(2)
          .max(50)
          .regex(/^[a-z0-9_]+$/),
        name: z.string().min(2).max(100),
        description: z.string().max(300).optional(),
        baseRole: z.enum([
          "super_admin",
          "admin",
          "manager",
          "group_leader",
          "member",
        ]),
        permissions: permissionShape,
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid input",
          details: parsed.error.issues,
        });
      }

      const { key, name, description, baseRole, permissions } = parsed.data;
      if (roleHierarchy.includes(key as UserRole)) {
        return res.status(409).json({
          success: false,
          error: "Built-in role keys cannot be recreated",
        });
      }
      if (!canEditRoleConfiguration(actorRole, baseRole)) {
        return res.status(403).json({
          success: false,
          error: "You cannot create a role at this level",
        });
      }

      const existing = listStoredRoleConfigs().find((role) => role.key === key);
      if (existing) {
        return res
          .status(409)
          .json({ success: false, error: "Role key already exists" });
      }

      const saved = await upsertRoleConfig({
        key,
        name,
        description,
        baseRole,
        permissions: permissions as RolePermissions,
      });

      await writeAuditLog({
        actorId,
        action: "admin_create_role",
        resourceType: "role",
        resourceId: key,
        details: { key, name, baseRole },
        ipAddress: req.ip,
      });

      emitRbacUpdated({
        roleKey: key,
        reason: "role_created",
      });

      res.status(201).json({ success: true, data: { role: saved } });
    } catch {
      res.status(500).json({ success: false, error: "Failed to create role" });
    }
  }

  async updateRoleConfiguration(req: AuthRequest, res: Response) {
    try {
      const actorId = req.user?.id;
      const actorRole = req.user?.role || "member";
      const { key } = req.params;

      if (!actorId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }
      if (!canAccessRoleManagement(actorRole)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      const current = getStoredRoleConfig(key);
      if (!current || current.key !== key) {
        return res
          .status(404)
          .json({ success: false, error: "Role not found" });
      }
      if (!canEditRoleConfiguration(actorRole, current.baseRole)) {
        return res
          .status(403)
          .json({ success: false, error: "You cannot edit this role" });
      }

      const permissionShape = z.object({
        canCreateMemo: z.boolean(),
        canDeleteAnyMemo: z.boolean(),
        canEditAnyMemo: z.boolean(),
        canPinMemos: z.boolean(),
        canArchiveMemos: z.boolean(),
        canViewAllMemos: z.boolean(),
        canApproveAsModerator: z.boolean(),
        canManageTemplates: z.boolean(),
        canConfigureWorkflows: z.boolean(),
        canCreateGroups: z.boolean(),
        canDeleteGroups: z.boolean(),
        canManageGroups: z.boolean(),
        canAssignGroupLeaders: z.boolean(),
        canManageUsers: z.boolean(),
        canAssignRoles: z.boolean(),
        canViewAllUsers: z.boolean(),
        canDeactivateUsers: z.boolean(),
        canAccessSystemSettings: z.boolean(),
        canManageSecuritySettings: z.boolean(),
        canViewAuditLogs: z.boolean(),
        canAccessReports: z.boolean(),
        canManageIntegrations: z.boolean(),
        canAccessDeveloperTools: z.boolean(),
        canSendBroadcasts: z.boolean(),
        canManageNotificationPolicies: z.boolean(),
      });

      const schema = z.object({
        name: z.string().min(2).max(100),
        description: z.string().max(300).optional(),
        baseRole: z.enum([
          "super_admin",
          "admin",
          "manager",
          "group_leader",
          "member",
        ]),
        permissions: permissionShape,
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid input",
          details: parsed.error.issues,
        });
      }

      const { name, description, baseRole, permissions } = parsed.data;
      if (!canEditRoleConfiguration(actorRole, baseRole)) {
        return res.status(403).json({
          success: false,
          error: "You cannot move this role to that level",
        });
      }

      const saved = await upsertRoleConfig({
        key,
        name,
        description,
        baseRole,
        permissions: permissions as RolePermissions,
      });

      await writeAuditLog({
        actorId,
        action: "admin_update_role",
        resourceType: "role",
        resourceId: key,
        details: { key, name, baseRole },
        ipAddress: req.ip,
      });

      emitRbacUpdated({
        roleKey: key,
        reason: "role_updated",
      });

      res.json({ success: true, data: { role: saved } });
    } catch {
      res.status(500).json({ success: false, error: "Failed to update role" });
    }
  }

  async deleteRoleConfiguration(req: AuthRequest, res: Response) {
    try {
      const actorId = req.user?.id;
      const actorRole = req.user?.role || "member";
      const { key } = req.params;

      if (!actorId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }
      if (!canAccessRoleManagement(actorRole)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      if (roleHierarchy.includes(key as UserRole)) {
        return res
          .status(400)
          .json({ success: false, error: "Built-in roles cannot be deleted" });
      }

      const current = getStoredRoleConfig(key);
      if (!current || current.key !== key) {
        return res
          .status(404)
          .json({ success: false, error: "Role not found" });
      }
      if (!canEditRoleConfiguration(actorRole, current.baseRole)) {
        return res
          .status(403)
          .json({ success: false, error: "You cannot delete this role" });
      }

      const usersUsingRole = await prisma.user.count({ where: { role: key } });
      if (usersUsingRole > 0) {
        return res.status(400).json({
          success: false,
          error: "Reassign users before deleting this role",
        });
      }

      await deleteRoleConfig(key);

      await writeAuditLog({
        actorId,
        action: "admin_delete_role",
        resourceType: "role",
        resourceId: key,
        details: { key, name: current.name },
        ipAddress: req.ip,
      });

      emitRbacUpdated({
        roleKey: key,
        reason: "role_deleted",
      });

      res.json({ success: true, message: "Role deleted successfully" });
    } catch {
      res.status(500).json({ success: false, error: "Failed to delete role" });
    }
  }

  async getUserStatsById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const requesterId = req.user?.id;

      if (!requesterId) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
        });
      }

      const user = await userService.getUserById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const stats = await userProfileService.getUserStats(id);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to fetch user stats",
      });
    }
  }

  async changePassword(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: "Current password and new password are required",
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: "New password must be at least 6 characters",
        });
      }

      // Fetch only the passwordHash field needed for comparison
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: "Current password is incorrect",
        });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      });

      res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, error: "Failed to change password" });
    }
  }

  async getUsers(req: AuthRequest, res: Response) {
    try {
      const requesterId = req.user?.id;

      if (!requesterId) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
        });
      }

      const users = await userService.getAllUsers();

      res.json({
        success: true,
        data: {
          users: users.map(withEffectiveRole),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to fetch users",
      });
    }
  }

  async getUserById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const requesterId = req.user?.id;

      if (!requesterId) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
        });
      }

      const user = await userService.getUserById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      res.json({
        success: true,
        data: { user: withEffectiveRole(user as any) },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to fetch user",
      });
    }
  }

  async getCurrentUser(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
        });
      }

      const user = await userService.getUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      res.json({
        success: true,
        data: { user: withEffectiveRole(user as any) },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to fetch current user",
      });
    }
  }

  async updateUser(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const requesterRole = req.user?.role || "member";

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
        });
      }

      const isSelfUpdate = id === userId;
      const canManageOtherUsers = canManageUsers(requesterRole);

      if (!isSelfUpdate && !canManageOtherUsers) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
        });
      }

      const validationResult = updateUserSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid input data",
          details: validationResult.error.issues,
        });
      }

      const updateData = validationResult.data;

      if (updateData.role !== undefined) {
        if (!canAssignUserRoles(requesterRole)) {
          return res.status(403).json({
            success: false,
            error: "You do not have permission to assign roles",
          });
        }

        const targetUser = await userService.getUserById(id);
        if (!targetUser) {
          return res.status(404).json({
            success: false,
            error: "User not found",
          });
        }

        const targetCurrentRole = targetUser.role;
        const targetNewRole = updateData.role;

        if (!canManageRole(requesterRole, targetCurrentRole)) {
          return res.status(403).json({
            success: false,
            error: "You cannot change this user's role",
          });
        }

        if (!canManageRole(requesterRole, targetNewRole)) {
          return res.status(403).json({
            success: false,
            error: "You cannot assign this role",
          });
        }
      }

      const user = await userService.updateUser(id, updateData);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      // Audit log for role changes made by an admin on another user
      if (updateData.role !== undefined && id !== userId) {
        await writeAuditLog({
          actorId: userId,
          action: "admin_role_change",
          resourceType: "user",
          resourceId: id,
          details: { newRole: updateData.role },
          ipAddress: req.ip,
        });

        emitRbacUpdated({
          userIds: [id],
          roleKey: updateData.role,
          reason: "user_role_changed",
        });
      }

      res.json({
        success: true,
        data: { user: withEffectiveRole(user as any) },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to update user",
      });
    }
  }

  async updateCurrentUser(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
        });
      }

      const validationResult = updateUserSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid input data",
          details: validationResult.error.issues,
        });
      }

      const updateData = { ...validationResult.data } as any;
      if (updateData.role !== undefined) {
        delete updateData.role;
      }
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: "No valid fields to update",
        });
      }
      const user = await userService.updateUser(userId, updateData);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      res.json({
        success: true,
        data: { user: withEffectiveRole(user as any) },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to update user",
      });
    }
  }

  // ─── Admin: Create User ────────────────────────────────────────────────────
  async createUser(req: AuthRequest, res: Response) {
    try {
      const actorId = req.user?.id;
      const actorRole = req.user?.role || "member";

      if (!actorId)
        return res.status(401).json({ success: false, error: "Unauthorized" });
      if (!canManageUsers(actorRole)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      const createSchema = z.object({
        name: z.string().min(2).max(100),
        email: z.string().email(),
        password: z.string().min(6),
        department: z.string().optional(),
        role: z.string().optional(),
      });

      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid input",
          details: parsed.error.issues,
        });
      }

      const { name, email, password, department, role } = parsed.data;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: "A user with that email already exists",
        });
      }

      // Actors can only assign roles below their own
      const assignedRole = role || "member";
      if (role && !canManageRole(actorRole, assignedRole)) {
        return res
          .status(403)
          .json({ success: false, error: "You cannot assign this role" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          department: department || "General",
          role: assignedRole,
        },
        select: {
          id: true,
          email: true,
          name: true,
          bio: true,
          avatar: true,
          role: true,
          department: true,
          status: true,
          isBlocked: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      await writeAuditLog({
        actorId,
        action: "admin_create_user",
        resourceType: "user",
        resourceId: newUser.id,
        details: {
          name,
          email,
          role: assignedRole,
          department: department || "General",
        },
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        data: { user: withEffectiveRole(newUser as any) },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to create user" });
    }
  }

  // ─── Admin: Delete User ────────────────────────────────────────────────────
  async deleteUser(req: AuthRequest, res: Response) {
    try {
      const actorId = req.user?.id;
      const actorRole = req.user?.role || "member";
      const { id } = req.params;

      if (!actorId)
        return res.status(401).json({ success: false, error: "Unauthorized" });
      if (id === actorId)
        return res.status(400).json({
          success: false,
          error: "You cannot delete your own account",
        });
      if (!canManageUsers(actorRole)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      const target = await prisma.user.findUnique({ where: { id } });
      if (!target)
        return res
          .status(404)
          .json({ success: false, error: "User not found" });

      if (!canManageRole(actorRole, target.role)) {
        return res.status(403).json({
          success: false,
          error: "You cannot delete a user with a higher or equal role",
        });
      }

      await writeAuditLog({
        actorId,
        action: "admin_delete_user",
        resourceType: "user",
        resourceId: id,
        details: { name: target.name, email: target.email, role: target.role },
        ipAddress: req.ip,
      });

      const deletedEmail = `deleted_${target.id}@deleted.local`;
      await prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isBlocked: true,
          role: "member",
          email: deletedEmail,
          name: `[Deleted] ${target.name}`,
          bio: null,
          avatar: null,
          status: "offline",
        } as any,
      });

      // Remove the deleted user from every group they belonged to and notify remaining members
      try {
        const memberships = await prisma.groupMember.findMany({
          where: { userId: id },
          include: { group: { select: { id: true, name: true } } },
        });

        await Promise.allSettled(
          memberships.map((membership) =>
            groupService.removeMemberOnUserDeletion(
              membership.group.id,
              id,
              target.name,
              [actorId],
            ),
          ),
        );
      } catch (groupCleanupError) {
        // Non-fatal – log but don't block the response
        console.error(
          "Group cleanup on user deletion failed:",
          groupCleanupError,
        );
      }

      res.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to delete user" });
    }
  }

  // ─── Admin: Block / Unblock User ──────────────────────────────────────────
  async toggleBlockUser(req: AuthRequest, res: Response) {
    try {
      const actorId = req.user?.id;
      const actorRole = req.user?.role || "member";
      const { id } = req.params;

      if (!actorId)
        return res.status(401).json({ success: false, error: "Unauthorized" });
      if (id === actorId)
        return res
          .status(400)
          .json({ success: false, error: "You cannot block your own account" });
      if (!canManageUsers(actorRole)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      const target = await prisma.user.findUnique({ where: { id } });
      if (!target)
        return res
          .status(404)
          .json({ success: false, error: "User not found" });

      if (!canManageRole(actorRole, target.role)) {
        return res.status(403).json({
          success: false,
          error: "You cannot block a user with a higher or equal role",
        });
      }

      const newBlocked = !(target as any).isBlocked;
      const updated = await prisma.user.update({
        where: { id },
        data: { isBlocked: newBlocked } as any,
        select: {
          id: true,
          email: true,
          name: true,
          bio: true,
          avatar: true,
          role: true,
          department: true,
          status: true,
          isBlocked: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      await writeAuditLog({
        actorId,
        action: newBlocked ? "admin_block_user" : "admin_unblock_user",
        resourceType: "user",
        resourceId: id,
        details: { name: target.name, email: target.email },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        data: {
          user: withEffectiveRole(updated as any),
          isBlocked: newBlocked,
        },
      });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, error: "Failed to update user block status" });
    }
  }

  // ─── Superuser: Get Audit Logs ────────────────────────────────────────────
  async getAdminAuditLogs(req: AuthRequest, res: Response) {
    try {
      const actorRole = req.user?.role || "member";

      if (
        !hasPermission(actorRole, "canAccessDeveloperTools") &&
        actorRole !== "super_admin"
      ) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      const page = parseInt((req.query.page as string) || "1", 10);
      const limit = parseInt((req.query.limit as string) || "50", 10);
      const skip = (page - 1) * limit;

      const adminActions = [
        "admin_create_user",
        "admin_delete_user",
        "admin_block_user",
        "admin_unblock_user",
        "admin_role_change",
        "admin_create_role",
        "admin_update_role",
        "admin_delete_role",
      ];

      const [logs, total] = await Promise.all([
        prisma.activityLog.findMany({
          where: { action: { in: adminActions } },
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.activityLog.count({ where: { action: { in: adminActions } } }),
      ]);

      res.json({
        success: true,
        data: { logs, total, page, pages: Math.ceil(total / limit) },
      });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch audit logs" });
    }
  }
}
