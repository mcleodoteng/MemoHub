import { AuthRequest } from "./auth.middleware.js";

export type UserRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "group_leader"
  | "member";

export interface RolePermissions {
  canCreateMemo: boolean;
  canDeleteAnyMemo: boolean;
  canEditAnyMemo: boolean;
  canPinMemos: boolean;
  canArchiveMemos: boolean;
  canViewAllMemos: boolean;

  canApproveAsModerator: boolean;
  canManageTemplates: boolean;
  canConfigureWorkflows: boolean;

  canCreateGroups: boolean;
  canDeleteGroups: boolean;
  canManageGroups: boolean;
  canAssignGroupLeaders: boolean;

  canManageUsers: boolean;
  canAssignRoles: boolean;
  canViewAllUsers: boolean;
  canDeactivateUsers: boolean;

  canAccessSystemSettings: boolean;
  canManageSecuritySettings: boolean;
  canViewAuditLogs: boolean;
  canAccessReports: boolean;
  canManageIntegrations: boolean;
  canAccessDeveloperTools: boolean;

  canSendBroadcasts: boolean;
  canManageNotificationPolicies: boolean;
}

export const defaultRolePermissions: Record<UserRole, RolePermissions> = {
  super_admin: {
    canCreateMemo: true,
    canDeleteAnyMemo: true,
    canEditAnyMemo: true,
    canPinMemos: true,
    canArchiveMemos: true,
    canViewAllMemos: true,
    canApproveAsModerator: true,
    canManageTemplates: true,
    canConfigureWorkflows: true,
    canCreateGroups: true,
    canDeleteGroups: true,
    canManageGroups: true,
    canAssignGroupLeaders: true,
    canManageUsers: true,
    canAssignRoles: true,
    canViewAllUsers: true,
    canDeactivateUsers: true,
    canAccessSystemSettings: true,
    canManageSecuritySettings: true,
    canViewAuditLogs: true,
    canAccessReports: true,
    canManageIntegrations: true,
    canAccessDeveloperTools: true,
    canSendBroadcasts: true,
    canManageNotificationPolicies: true,
  },
  admin: {
    canCreateMemo: true,
    canDeleteAnyMemo: true,
    canEditAnyMemo: true,
    canPinMemos: true,
    canArchiveMemos: true,
    canViewAllMemos: true,
    canApproveAsModerator: true,
    canManageTemplates: true,
    canConfigureWorkflows: true,
    canCreateGroups: true,
    canDeleteGroups: true,
    canManageGroups: true,
    canAssignGroupLeaders: true,
    canManageUsers: true,
    canAssignRoles: true,
    canViewAllUsers: true,
    canDeactivateUsers: true,
    canAccessSystemSettings: true,
    canManageSecuritySettings: true,
    canViewAuditLogs: true,
    canAccessReports: true,
    canManageIntegrations: false,
    canAccessDeveloperTools: false,
    canSendBroadcasts: true,
    canManageNotificationPolicies: true,
  },
  manager: {
    canCreateMemo: true,
    canDeleteAnyMemo: false,
    canEditAnyMemo: false,
    canPinMemos: true,
    canArchiveMemos: true,
    canViewAllMemos: true,
    canApproveAsModerator: true,
    canManageTemplates: true,
    canConfigureWorkflows: true,
    canCreateGroups: true,
    canDeleteGroups: false,
    canManageGroups: true,
    canAssignGroupLeaders: false,
    canManageUsers: false,
    canAssignRoles: false,
    canViewAllUsers: true,
    canDeactivateUsers: false,
    canAccessSystemSettings: false,
    canManageSecuritySettings: false,
    canViewAuditLogs: true,
    canAccessReports: true,
    canManageIntegrations: false,
    canAccessDeveloperTools: false,
    canSendBroadcasts: true,
    canManageNotificationPolicies: false,
  },
  group_leader: {
    canCreateMemo: true,
    canDeleteAnyMemo: false,
    canEditAnyMemo: false,
    canPinMemos: true,
    canArchiveMemos: true,
    canViewAllMemos: false,
    canApproveAsModerator: true,
    canManageTemplates: false,
    canConfigureWorkflows: false,
    canCreateGroups: false,
    canDeleteGroups: false,
    canManageGroups: true,
    canAssignGroupLeaders: false,
    canManageUsers: false,
    canAssignRoles: false,
    canViewAllUsers: false,
    canDeactivateUsers: false,
    canAccessSystemSettings: false,
    canManageSecuritySettings: false,
    canViewAuditLogs: false,
    canAccessReports: true,
    canManageIntegrations: false,
    canAccessDeveloperTools: false,
    canSendBroadcasts: false,
    canManageNotificationPolicies: false,
  },
  member: {
    canCreateMemo: true,
    canDeleteAnyMemo: false,
    canEditAnyMemo: false,
    canPinMemos: false,
    canArchiveMemos: false,
    canViewAllMemos: false,
    canApproveAsModerator: false,
    canManageTemplates: false,
    canConfigureWorkflows: false,
    canCreateGroups: false,
    canDeleteGroups: false,
    canManageGroups: false,
    canAssignGroupLeaders: false,
    canManageUsers: false,
    canAssignRoles: false,
    canViewAllUsers: false,
    canDeactivateUsers: false,
    canAccessSystemSettings: false,
    canManageSecuritySettings: false,
    canViewAuditLogs: false,
    canAccessReports: true,
    canManageIntegrations: false,
    canAccessDeveloperTools: false,
    canSendBroadcasts: false,
    canManageNotificationPolicies: false,
  },
};

export const roleHierarchy: UserRole[] = [
  "super_admin",
  "admin",
  "manager",
  "group_leader",
  "member",
];

export function normalizeRole(role?: string): UserRole {
  const normalized = (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  if (
    normalized === "superuser" ||
    normalized === "super_user" ||
    normalized === "superadmin"
  ) {
    return "super_admin";
  }
  if (
    normalized === "super_admin" ||
    normalized === "admin" ||
    normalized === "manager" ||
    normalized === "group_leader"
  ) {
    return normalized;
  }
  return "member";
}

type RoleConfigLookup = {
  getResolvedPermissions: (role?: string | null) => RolePermissions;
  getResolvedBaseRole: (role?: string | null) => UserRole;
};

let dynamicRoleLookup: RoleConfigLookup | null = null;

export function setDynamicRoleLookup(lookup: RoleConfigLookup) {
  dynamicRoleLookup = lookup;
}

export function getRolePermissions(role?: string): RolePermissions {
  if (dynamicRoleLookup) {
    return dynamicRoleLookup.getResolvedPermissions(role);
  }
  return defaultRolePermissions[normalizeRole(role)];
}

export function hasPermission(
  role: string | undefined,
  permission: keyof RolePermissions,
): boolean {
  return getRolePermissions(role)[permission];
}

export function canManageRole(
  assignerRole: string,
  targetRole: string,
): boolean {
  const assignerBase = dynamicRoleLookup
    ? dynamicRoleLookup.getResolvedBaseRole(assignerRole)
    : normalizeRole(assignerRole);
  const targetBase = dynamicRoleLookup
    ? dynamicRoleLookup.getResolvedBaseRole(targetRole)
    : normalizeRole(targetRole);
  const assignerIndex = roleHierarchy.indexOf(assignerBase);
  const targetIndex = roleHierarchy.indexOf(targetBase);
  return assignerIndex >= 0 && targetIndex >= 0 && assignerIndex < targetIndex;
}

export function getRequestPermissions(
  req: Pick<AuthRequest, "user">,
): RolePermissions {
  return getRolePermissions(req.user?.role);
}
