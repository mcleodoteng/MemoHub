import React, { createContext, useContext, useState, useCallback } from 'react';
import { currentUser } from '@/data/mock';

export type UserRole = 'admin' | 'manager' | 'member';

interface RolePermissions {
  canCreateMemo: boolean;
  canDeleteAnyMemo: boolean;
  canEditAnyMemo: boolean;
  canManageGroups: boolean;
  canManageUsers: boolean;
  canPinMemos: boolean;
  canArchiveMemos: boolean;
  canApproveAsModerator: boolean;
  canViewAllMemos: boolean;
  canManageTemplates: boolean;
}

const rolePermissions: Record<UserRole, RolePermissions> = {
  admin: {
    canCreateMemo: true,
    canDeleteAnyMemo: true,
    canEditAnyMemo: true,
    canManageGroups: true,
    canManageUsers: true,
    canPinMemos: true,
    canArchiveMemos: true,
    canApproveAsModerator: true,
    canViewAllMemos: true,
    canManageTemplates: true,
  },
  manager: {
    canCreateMemo: true,
    canDeleteAnyMemo: false,
    canEditAnyMemo: false,
    canManageGroups: true,
    canManageUsers: false,
    canPinMemos: true,
    canArchiveMemos: true,
    canApproveAsModerator: true,
    canViewAllMemos: true,
    canManageTemplates: true,
  },
  member: {
    canCreateMemo: true,
    canDeleteAnyMemo: false,
    canEditAnyMemo: false,
    canManageGroups: false,
    canManageUsers: false,
    canPinMemos: false,
    canArchiveMemos: false,
    canApproveAsModerator: false,
    canViewAllMemos: false,
    canManageTemplates: false,
  },
};

interface RoleContextType {
  currentRole: UserRole;
  permissions: RolePermissions;
  hasPermission: (permission: keyof RolePermissions) => boolean;
  canEditMemo: (creatorId: string) => boolean;
  canDeleteMemo: (creatorId: string) => boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const currentRole = currentUser.role as UserRole;
  const permissions = rolePermissions[currentRole];

  const hasPermission = useCallback((permission: keyof RolePermissions) => {
    return permissions[permission];
  }, [permissions]);

  const canEditMemo = useCallback((creatorId: string) => {
    return creatorId === currentUser.id || permissions.canEditAnyMemo;
  }, [permissions]);

  const canDeleteMemo = useCallback((creatorId: string) => {
    return creatorId === currentUser.id || permissions.canDeleteAnyMemo;
  }, [permissions]);

  return (
    <RoleContext.Provider value={{ currentRole, permissions, hasPermission, canEditMemo, canDeleteMemo }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRoles() {
  const context = useContext(RoleContext);
  if (!context) throw new Error('useRoles must be used within RoleProvider');
  return context;
}
