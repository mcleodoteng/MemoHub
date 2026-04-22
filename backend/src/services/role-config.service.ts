import { prisma } from "../config/prisma.js";
import {
  defaultRolePermissions,
  normalizeRole,
  roleHierarchy,
  type RolePermissions,
  type UserRole,
} from "../middleware/role-permissions.js";

export interface StoredRoleConfig {
  key: string;
  name: string;
  description?: string | null;
  baseRole: UserRole;
  permissions: RolePermissions;
  isBuiltIn: boolean;
}

const builtInLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  group_leader: "Group Leader",
  member: "Member",
};

const roleConfigCache = new Map<string, StoredRoleConfig>();

function getRoleConfigDelegate() {
  const delegate = (prisma as any).roleConfig;
  if (!delegate) {
    throw new Error("RoleConfig delegate is unavailable on Prisma client");
  }
  return delegate;
}

function toPermissions(value: unknown, baseRole: UserRole): RolePermissions {
  const base = defaultRolePermissions[baseRole];
  if (!value || typeof value !== "object") {
    return { ...base };
  }

  const record = value as Record<string, unknown>;
  const next = { ...base } as RolePermissions;

  for (const key of Object.keys(base) as Array<keyof RolePermissions>) {
    if (typeof record[key] === "boolean") {
      next[key] = record[key] as boolean;
    }
  }

  return next;
}

function permissionsNeedBackfill(
  value: unknown,
  baseRole: UserRole,
  normalized: RolePermissions,
) {
  if (!value || typeof value !== "object") {
    return true;
  }

  const record = value as Record<string, unknown>;
  return (Object.keys(defaultRolePermissions[baseRole]) as Array<
    keyof RolePermissions
  >).some((key) => typeof record[key] !== "boolean" || record[key] !== normalized[key]);
}

function hydrateBuiltInConfigs() {
  for (const role of roleHierarchy) {
    roleConfigCache.set(role, {
      key: role,
      name: builtInLabels[role],
      description: null,
      baseRole: role,
      permissions: { ...defaultRolePermissions[role] },
      isBuiltIn: true,
    });
  }
}

export async function initializeRoleConfigCache() {
  hydrateBuiltInConfigs();

  const roleConfigDelegate = getRoleConfigDelegate();
  const storedConfigs = await roleConfigDelegate.findMany({
    orderBy: [{ createdAt: "asc" }],
  });

  for (const item of storedConfigs) {
    const baseRole = normalizeRole(item.baseRole);
    const normalizedPermissions = toPermissions(item.permissions, baseRole);

    roleConfigCache.set(item.key, {
      key: item.key,
      name: item.name,
      description: item.description,
      baseRole,
      permissions: normalizedPermissions,
      isBuiltIn: roleHierarchy.includes(item.key as UserRole),
    });

    if (permissionsNeedBackfill(item.permissions, baseRole, normalizedPermissions)) {
      await roleConfigDelegate.update({
        where: { key: item.key },
        data: {
          permissions: normalizedPermissions as unknown as object,
        },
      });
    }
  }
}

export function getStoredRoleConfig(roleKey?: string | null): StoredRoleConfig {
  const key = (roleKey || "member").trim() || "member";
  return (
    roleConfigCache.get(key) ||
    roleConfigCache.get(normalizeRole(key)) ||
    roleConfigCache.get("member")!
  );
}

export function listStoredRoleConfigs(): StoredRoleConfig[] {
  return Array.from(roleConfigCache.values()).sort((a, b) => {
    const aIndex = roleHierarchy.indexOf(a.baseRole);
    const bIndex = roleHierarchy.indexOf(b.baseRole);
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.name.localeCompare(b.name);
  });
}

export function getResolvedPermissions(
  roleKey?: string | null,
): RolePermissions {
  return getStoredRoleConfig(roleKey).permissions;
}

export function getResolvedBaseRole(roleKey?: string | null): UserRole {
  return getStoredRoleConfig(roleKey).baseRole;
}

export function getResolvedRoleLabel(roleKey?: string | null): string {
  return getStoredRoleConfig(roleKey).name;
}

export async function upsertRoleConfig(input: {
  key: string;
  name: string;
  description?: string;
  baseRole: UserRole;
  permissions: RolePermissions;
}) {
  const saved = await getRoleConfigDelegate().upsert({
    where: { key: input.key },
    update: {
      name: input.name,
      description: input.description || null,
      baseRole: input.baseRole,
      permissions: input.permissions as unknown as object,
    },
    create: {
      key: input.key,
      name: input.name,
      description: input.description || null,
      baseRole: input.baseRole,
      permissions: input.permissions as unknown as object,
    },
  });

  const hydrated: StoredRoleConfig = {
    key: saved.key,
    name: saved.name,
    description: saved.description,
    baseRole: normalizeRole(saved.baseRole),
    permissions: toPermissions(
      saved.permissions,
      normalizeRole(saved.baseRole),
    ),
    isBuiltIn: roleHierarchy.includes(saved.key as UserRole),
  };

  roleConfigCache.set(saved.key, hydrated);
  return hydrated;
}

export async function deleteRoleConfig(roleKey: string) {
  await getRoleConfigDelegate().delete({ where: { key: roleKey } });
  roleConfigCache.delete(roleKey);
}
