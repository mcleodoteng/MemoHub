import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { apiRequest, type ApiEnvelope } from "@/lib/api";

export type UserRole =
  | "super_admin"
  | "admin"
  | "manager"
  | "group_leader"
  | "member";

export interface RolePermissions {
  // Memo permissions
  canCreateMemo: boolean;
  canDeleteAnyMemo: boolean;
  canEditAnyMemo: boolean;
  canPinMemos: boolean;
  canArchiveMemos: boolean;
  canViewAllMemos: boolean;

  // Workflow permissions
  canApproveAsModerator: boolean;
  canManageTemplates: boolean;
  canConfigureWorkflows: boolean;

  // Group/Channel permissions
  canCreateGroups: boolean;
  canDeleteGroups: boolean;
  canManageGroups: boolean;
  canAssignGroupLeaders: boolean;

  // User management
  canManageUsers: boolean;
  canAssignRoles: boolean;
  canViewAllUsers: boolean;
  canDeactivateUsers: boolean;

  // System settings
  canAccessSystemSettings: boolean;
  canManageSecuritySettings: boolean;
  canViewAuditLogs: boolean;
  canAccessReports: boolean;
  canManageIntegrations: boolean;
  canAccessDeveloperTools: boolean;

  // Notification & communication
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
    canManageUsers: true,
    canAssignRoles: false,
    canViewAllUsers: true,
    canDeactivateUsers: false,
    canAccessSystemSettings: true,
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

export const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  group_leader: "Group Leader",
  member: "Member",
};

export const roleHierarchy: UserRole[] = [
  "super_admin",
  "admin",
  "manager",
  "group_leader",
  "member",
];

interface RoleContextType {
  currentRole: UserRole;
  permissions: RolePermissions;
  hasPermission: (permission: keyof RolePermissions) => boolean;
  canEditMemo: (creatorId: string) => boolean;
  canDeleteMemo: (creatorId: string) => boolean;
  isAtLeast: (role: UserRole) => boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const { onEvent, offEvent } = useSocket();
  const currentRole = (currentUser?.role as UserRole) || "member";
  const [remotePermissions, setRemotePermissions] =
    useState<RolePermissions | null>(null);

  const loadPermissions = useCallback(async () => {
    if (!currentUser) {
      setRemotePermissions(null);
      return;
    }

    try {
      const response = await apiRequest<
        | ApiEnvelope<{ permissions: RolePermissions }>
        | { permissions: RolePermissions }
      >("/users/me/permissions");
      const payload = "data" in response ? response.data : response;
      setRemotePermissions(payload.permissions || null);
    } catch {
      setRemotePermissions(null);
    }
  }, [currentUser]);

  const permissions = useMemo(
    () => remotePermissions || defaultRolePermissions[currentRole],
    [remotePermissions, currentRole],
  );

  useEffect(() => {
    void loadPermissions();

    const interval = window.setInterval(() => {
      void loadPermissions();
    }, 30000);

    const handleFocus = () => {
      void loadPermissions();
    };

    const handleRbacUpdated = () => {
      void loadPermissions();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("rbac-updated", handleRbacUpdated as EventListener);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(
        "rbac-updated",
        handleRbacUpdated as EventListener,
      );
    };
  }, [currentUser?.id, currentUser?.assignedRoleKey, loadPermissions]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const handleRbacUpdated = () => {
      void loadPermissions();
    };

    onEvent("rbac:updated", handleRbacUpdated);

    return () => {
      offEvent("rbac:updated", handleRbacUpdated);
    };
  }, [currentUser?.id, loadPermissions, offEvent, onEvent]);

  const hasPermission = useCallback(
    (permission: keyof RolePermissions) => {
      return permissions[permission];
    },
    [permissions],
  );

  const canEditMemo = useCallback(
    (creatorId: string) => {
      return currentUser?.id === creatorId || permissions.canEditAnyMemo;
    },
    [permissions, currentUser],
  );

  const canDeleteMemo = useCallback(
    (creatorId: string) => {
      return currentUser?.id === creatorId || permissions.canDeleteAnyMemo;
    },
    [permissions, currentUser],
  );

  const isAtLeast = useCallback(
    (role: UserRole) => {
      return roleHierarchy.indexOf(currentRole) <= roleHierarchy.indexOf(role);
    },
    [currentRole],
  );

  return (
    <RoleContext.Provider
      value={{
        currentRole,
        permissions,
        hasPermission,
        canEditMemo,
        canDeleteMemo,
        isAtLeast,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRoles() {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRoles must be used within RoleProvider");
  return context;
}
