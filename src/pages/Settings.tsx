import {
  useState,
  useEffect,
  useCallback,
  Fragment,
  type ComponentType,
} from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import {
  useRoles,
  roleLabels,
  roleHierarchy,
  UserRole,
  RolePermissions,
} from "@/context/RoleContext";
import { useOnlineStatuses } from "@/hooks/useOnlineStatus";
import { useUsers } from "@/context/UserContext";
import { apiRequest, type ApiEnvelope } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  User,
  Shield,
  Bell,
  Palette,
  Lock,
  Users,
  Settings2,
  Code,
  Save,
  ChevronRight,
  AlertTriangle,
  Eye,
  EyeOff,
  UserPlus,
  Ban,
  Trash2,
  ClipboardList,
} from "lucide-react";
import { getUserInitials } from "@/lib/user-utils";

// ===== Persistence helpers =====
const SETTINGS_KEY = "memohub_settings";

interface PersistedSettings {
  profile: { name: string; email: string; department: string; bio: string };
  notifications: {
    email: boolean;
    push: boolean;
    memo: boolean;
    mention: boolean;
    workflow: boolean;
    digestFrequency: string;
  };
  appearance: { theme: string; compactMode: boolean; animations: boolean };
  security: { twoFactor: boolean; sessionTimeout: string };
  system: {
    allowPublicMemos: boolean;
    requireApproval: boolean;
    maxAttachmentSize: string;
    auditRetention: string;
  };
  developer: {
    debugMode: boolean;
    rateLimit: string;
    maintenanceMode: boolean;
  };
}

interface AdminAuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: {
    email?: string;
    [key: string]: string | number | boolean | null | undefined;
  };
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface ManagedRole {
  key: string;
  name: string;
  description?: string | null;
  baseRole: UserRole;
  permissions: RolePermissions;
  isBuiltIn: boolean;
}

interface WorkflowAutomationStatus {
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  scheduledProcessedLastRun: number;
  escalationsProcessedLastRun: number;
  totalScheduledProcessed: number;
  totalEscalationsProcessed: number;
}

interface BackendSystemSettings {
  allowPublicMemos: boolean;
  requireApproval: boolean;
  maxAttachmentSize: string;
  auditRetention: string;
}

function loadSettings(userId: string): Partial<PersistedSettings> {
  try {
    const raw = localStorage.getItem(`${SETTINGS_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSettingsSection(userId: string, section: string, data: unknown) {
  const all = loadSettings(userId);
  (all as Record<string, unknown>)[section] = data;
  localStorage.setItem(`${SETTINGS_KEY}_${userId}`, JSON.stringify(all));
}

// ===== Component =====
const Settings = () => {
  const { currentUser, refreshCurrentUser } = useAuth();
  const { users: allUsers, refreshUsers } = useUsers();
  const { currentRole, hasPermission } = useRoles();
  const { getUserStatus } = useOnlineStatuses();
  const userId = currentUser?.id || "";
  const canAccessSystemSettings = hasPermission("canAccessSystemSettings");
  const stableBaseRole =
    (currentUser?.baseRole as UserRole | undefined) || currentRole;
  const isStableAdmin =
    stableBaseRole === "super_admin" || stableBaseRole === "admin";
  const isStableSuperAdmin = stableBaseRole === "super_admin";
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(
    null,
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [actingOnUserId, setActingOnUserId] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserDepartment, setNewUserDepartment] = useState("General");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("member");
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<ManagedRole[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [isSavingRoles, setIsSavingRoles] = useState(false);
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [deletingRoleKey, setDeletingRoleKey] = useState<string | null>(null);
  const [hasUnsavedRoleChanges, setHasUnsavedRoleChanges] = useState(false);
  const [newRoleKey, setNewRoleKey] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [newRoleBaseRole, setNewRoleBaseRole] = useState<UserRole>("member");
  const [workflowAutomationStatus, setWorkflowAutomationStatus] =
    useState<WorkflowAutomationStatus | null>(null);
  const [
    isLoadingWorkflowAutomationStatus,
    setIsLoadingWorkflowAutomationStatus,
  ] = useState(false);

  const saved = loadSettings(userId);

  // Profile state
  const [profileName, setProfileName] = useState(
    saved.profile?.name ?? currentUser?.name ?? "",
  );
  const [profileEmail, setProfileEmail] = useState(
    saved.profile?.email ?? currentUser?.email ?? "",
  );
  const [profileDept, setProfileDept] = useState(
    saved.profile?.department ?? currentUser?.department ?? "",
  );
  const [profileBio, setProfileBio] = useState(saved.profile?.bio ?? "");

  useEffect(() => {
    if (!currentUser) return;

    let active = true;

    const loadProfile = async () => {
      try {
        const response = await apiRequest<
          | ApiEnvelope<{
              id: string;
              name: string;
              email: string;
              department?: string;
              bio?: string | null;
            }>
          | {
              id: string;
              name: string;
              email: string;
              department?: string;
              bio?: string | null;
            }
        >("/profile");

        const profileData = "data" in response ? response.data : response;

        if (!active) return;

        setProfileName(profileData.name || "");
        setProfileEmail(profileData.email || "");
        setProfileDept(profileData.department || "General");
        setProfileBio(profileData.bio || "");
      } catch {
        if (!active) return;
        setProfileName(currentUser.name || "");
        setProfileEmail(currentUser.email || "");
        setProfileDept(currentUser.department || "General");
        setProfileBio(currentUser.bio || "");
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, [currentUser]);

  // Notification prefs
  const [emailNotifs, setEmailNotifs] = useState(
    saved.notifications?.email ?? true,
  );
  const [pushNotifs, setPushNotifs] = useState(
    saved.notifications?.push ?? true,
  );
  const [memoNotifs, setMemoNotifs] = useState(
    saved.notifications?.memo ?? true,
  );
  const [mentionNotifs, setMentionNotifs] = useState(
    saved.notifications?.mention ?? true,
  );
  const [workflowNotifs, setWorkflowNotifs] = useState(
    saved.notifications?.workflow ?? true,
  );
  const [digestFrequency, setDigestFrequency] = useState(
    saved.notifications?.digestFrequency ?? "daily",
  );

  // Appearance
  const [theme, setTheme] = useState(saved.appearance?.theme ?? "light");
  const [compactMode, setCompactMode] = useState(
    saved.appearance?.compactMode ?? false,
  );
  const [animationsEnabled, setAnimationsEnabled] = useState(
    saved.appearance?.animations ?? true,
  );

  // Security
  const [twoFactor, setTwoFactor] = useState(
    currentUser?.twoFactorEnabled ?? saved.security?.twoFactor ?? false,
  );
  const [sessionTimeout, setSessionTimeout] = useState(
    currentUser?.sessionTimeoutMinutes
      ? String(currentUser.sessionTimeoutMinutes)
      : (saved.security?.sessionTimeout ?? "30"),
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // System (admin+)
  const [allowPublicMemos, setAllowPublicMemos] = useState(
    saved.system?.allowPublicMemos ?? true,
  );
  const [requireApproval, setRequireApproval] = useState(
    saved.system?.requireApproval ?? false,
  );
  const [maxAttachmentSize, setMaxAttachmentSize] = useState(
    saved.system?.maxAttachmentSize ?? "10",
  );
  const [auditRetention, setAuditRetention] = useState(
    saved.system?.auditRetention ?? "90",
  );

  // Developer (super_admin)
  const [debugMode, setDebugMode] = useState(
    saved.developer?.debugMode ?? false,
  );
  const [rateLimit, setRateLimit] = useState(
    saved.developer?.rateLimit ?? "standard",
  );
  const [maintenanceMode, setMaintenanceMode] = useState(
    saved.developer?.maintenanceMode ?? false,
  );

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    if (theme === "dark") root.classList.add("dark");
    else if (theme === "light") root.classList.remove("dark");
    else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches)
        root.classList.add("dark");
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle("compact-mode", compactMode);
  }, [compactMode]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--transition-speed",
      animationsEnabled ? "1" : "0",
    );
  }, [animationsEnabled]);

  useEffect(() => {
    if (!currentUser || !canAccessSystemSettings) return;

    let active = true;

    const loadSystemSettings = async () => {
      try {
        const response =
          await apiRequest<ApiEnvelope<{ settings: BackendSystemSettings }>>(
            "/system/settings",
          );

        if (!active) return;

        const settings = response.data.settings;
        setAllowPublicMemos(settings.allowPublicMemos);
        setRequireApproval(settings.requireApproval);
        setMaxAttachmentSize(settings.maxAttachmentSize);
        setAuditRetention(settings.auditRetention);

        saveSettingsSection(userId, "system", settings);
      } catch (error) {
        console.error("Failed to load system settings:", error);
      }
    };

    void loadSystemSettings();

    return () => {
      active = false;
    };
  }, [currentUser, canAccessSystemSettings, userId]);

  const handleSaveProfile = async () => {
    if (!currentUser) return;

    try {
      setIsSavingProfile(true);

      const response = await apiRequest<
        | ApiEnvelope<{
            user: {
              name: string;
              email: string;
              department?: string;
              bio?: string | null;
            };
          }>
        | {
            user: {
              name: string;
              email: string;
              department?: string;
              bio?: string | null;
            };
          }
      >("/users/me", {
        method: "PUT",
        body: JSON.stringify({
          name: profileName.trim(),
          department: profileDept.trim(),
          bio: profileBio.trim(),
        }),
      });

      const payload = "data" in response ? response.data : response;

      setProfileName(payload.user.name || "");
      setProfileEmail(payload.user.email || "");
      setProfileDept(payload.user.department || "General");
      setProfileBio(payload.user.bio || "");

      await refreshCurrentUser();
      await refreshUsers();

      toast.success("Profile saved successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save profile",
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveNotifications = () => {
    saveSettingsSection(userId, "notifications", {
      email: emailNotifs,
      push: pushNotifs,
      memo: memoNotifs,
      mention: mentionNotifs,
      workflow: workflowNotifs,
      digestFrequency,
    });
    toast.success("Notification preferences saved");
  };

  const handleSaveAppearance = () => {
    saveSettingsSection(userId, "appearance", {
      theme,
      compactMode,
      animations: animationsEnabled,
    });
    // Keep global keys in sync so ThemeManager and theme-init.js use them on reload.
    try {
      localStorage.setItem("memohub_theme", theme);
      localStorage.setItem("memohub_compact", String(compactMode));
    } catch {
      /* ignore */
    }
    toast.success("Appearance settings saved");
  };

  const handleSaveSecurity = async () => {
    if (currentPassword || newPassword || confirmPassword) {
      if (!currentPassword) {
        toast.error("Please enter your current password");
        return;
      }
      if (newPassword.length < 8) {
        toast.error("New password must be at least 8 characters");
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error("New passwords do not match");
        return;
      }
      try {
        setIsChangingPassword(true);
        await apiRequest("/users/me/password", {
          method: "PUT",
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        toast.success("Password updated successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to change password",
        );
        return;
      } finally {
        setIsChangingPassword(false);
      }
    }
    saveSettingsSection(userId, "security", { twoFactor, sessionTimeout });

    try {
      await apiRequest("/users/me", {
        method: "PUT",
        body: JSON.stringify({
          twoFactorEnabled: twoFactor,
          sessionTimeoutMinutes: parseInt(sessionTimeout, 10),
        }),
      });
      await refreshCurrentUser();
    } catch {
      // Security settings saved locally even if sync fails
    }

    toast.success("Security settings saved");
  };

  const handleSaveSystem = async () => {
    const payload = {
      allowPublicMemos,
      requireApproval,
      maxAttachmentSize,
      auditRetention,
    };

    saveSettingsSection(userId, "system", payload);

    try {
      await apiRequest<ApiEnvelope<{ settings: BackendSystemSettings }>>(
        "/system/settings",
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );
      toast.success("System settings saved");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save system settings",
      );
    }
  };

  const handleSaveDeveloper = () => {
    saveSettingsSection(userId, "developer", {
      debugMode,
      rateLimit,
      maintenanceMode,
    });
    toast.success("Developer settings saved");
  };

  const settingsTabs: Array<{
    id: string;
    label: string;
    icon: ComponentType<{ className?: string }>;
    minRole: UserRole;
    permission?: keyof RolePermissions;
  }> = [
    {
      id: "profile",
      label: "Profile",
      icon: User,
      minRole: "member" as UserRole,
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: Bell,
      minRole: "member" as UserRole,
    },
    {
      id: "appearance",
      label: "Appearance",
      icon: Palette,
      minRole: "member" as UserRole,
    },
    {
      id: "security",
      label: "Security",
      icon: Lock,
      minRole: "member" as UserRole,
    },
    {
      id: "users",
      label: "Users",
      icon: Users,
      minRole: "member" as UserRole,
      permission: "canViewAllUsers",
    },
    {
      id: "audit",
      label: "Audit",
      icon: ClipboardList,
      minRole: "super_admin" as UserRole,
      permission: "canAccessDeveloperTools",
    },
    {
      id: "system",
      label: "System",
      icon: Settings2,
      minRole: "member" as UserRole,
      permission: "canAccessSystemSettings",
    },
    {
      id: "developer",
      label: "Developer",
      icon: Code,
      minRole: "member" as UserRole,
      permission: "canAccessDeveloperTools",
    },
  ];

  const visibleTabs = settingsTabs.filter((t) => {
    if (t.id === "users") {
      return isStableAdmin || hasPermission("canManageUsers");
    }
    if (t.id === "audit") {
      return isStableSuperAdmin || hasPermission("canViewAuditLogs");
    }
    if (t.id === "system") {
      return isStableAdmin || hasPermission("canAccessSystemSettings");
    }
    if (t.id === "developer") {
      return isStableSuperAdmin || hasPermission("canAccessDeveloperTools");
    }
    if (t.permission) {
      return hasPermission(t.permission);
    }
    const idx = roleHierarchy.indexOf(stableBaseRole);
    const reqIdx = roleHierarchy.indexOf(t.minRole);
    return idx <= reqIdx;
  });

  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id || "profile");

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [activeTab, visibleTabs]);

  const roleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: "bg-destructive/10 text-destructive",
      admin: "bg-warning/10 text-warning",
      manager: "bg-info/10 text-info",
      group_leader: "bg-accent/10 text-accent",
      member: "bg-muted text-muted-foreground",
    };
    return colors[role] || colors.member;
  };

  const getManagedRole = useCallback(
    (roleKey?: string) => availableRoles.find((role) => role.key === roleKey),
    [availableRoles],
  );

  const canManageRoleForUser = (targetRoleKey: string) => {
    if (!isStableAdmin) return false;
    const targetRole = getManagedRole(targetRoleKey);
    const currentRoleIndex = roleHierarchy.indexOf(stableBaseRole);
    const targetRoleIndex = roleHierarchy.indexOf(
      targetRole?.baseRole || "member",
    );
    return (
      currentRoleIndex >= 0 &&
      targetRoleIndex >= 0 &&
      currentRoleIndex < targetRoleIndex
    );
  };

  const assignableRoles = availableRoles.filter(
    (role) =>
      roleHierarchy.indexOf(stableBaseRole) <
      roleHierarchy.indexOf(role.baseRole),
  );

  const canEditRoleAccess = isStableAdmin;
  const canViewWorkflowAutomation =
    isStableAdmin || hasPermission("canAccessSystemSettings");

  const canEditManagedRole = (role: ManagedRole) => {
    if (isStableSuperAdmin) return true;
    if (stableBaseRole === "admin") return role.baseRole !== "super_admin";
    return false;
  };

  const permissionSections: Array<{
    title: string;
    keys: Array<keyof RolePermissions>;
  }> = [
    {
      title: "Memos",
      keys: [
        "canCreateMemo",
        "canDeleteAnyMemo",
        "canEditAnyMemo",
        "canPinMemos",
        "canArchiveMemos",
        "canViewAllMemos",
      ],
    },
    {
      title: "Workflow",
      keys: [
        "canApproveAsModerator",
        "canManageTemplates",
        "canConfigureWorkflows",
      ],
    },
    {
      title: "Groups",
      keys: [
        "canCreateGroups",
        "canDeleteGroups",
        "canManageGroups",
        "canAssignGroupLeaders",
      ],
    },
    {
      title: "Users",
      keys: [
        "canManageUsers",
        "canAssignRoles",
        "canViewAllUsers",
        "canDeactivateUsers",
      ],
    },
    {
      title: "System",
      keys: [
        "canAccessSystemSettings",
        "canManageSecuritySettings",
        "canViewAuditLogs",
        "canManageIntegrations",
        "canAccessDeveloperTools",
      ],
    },
    {
      title: "Communication",
      keys: ["canSendBroadcasts", "canManageNotificationPolicies"],
    },
  ];

  const formatPermissionLabel = (permission: keyof RolePermissions) =>
    permission
      .replace(/^can/, "")
      .replace(/([A-Z])/g, " $1")
      .trim();

  const getRolePermissionValue = (
    roleKey: string,
    permission: keyof RolePermissions,
  ) => getManagedRole(roleKey)?.permissions[permission] || false;

  const handleRolePermissionToggle = (
    roleKey: string,
    permission: keyof RolePermissions,
    checked: boolean,
  ) => {
    setHasUnsavedRoleChanges(true);
    setAvailableRoles((prev) =>
      prev.map((role) =>
        role.key === roleKey
          ? {
              ...role,
              permissions: {
                ...role.permissions,
                [permission]: checked,
              },
            }
          : role,
      ),
    );
  };

  const loadRoleConfigurations = useCallback(
    async (force = false) => {
      if (!isStableAdmin) return;
      if (!force && hasUnsavedRoleChanges) return;
      try {
        setIsLoadingRoles(true);
        const response = await apiRequest<
          ApiEnvelope<{ roles: ManagedRole[] }> | { roles: ManagedRole[] }
        >("/users/roles");
        const payload = "data" in response ? response.data : response;
        setAvailableRoles(payload.roles || []);
        if (force) {
          setHasUnsavedRoleChanges(false);
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load role settings",
        );
      } finally {
        setIsLoadingRoles(false);
      }
    },
    [hasUnsavedRoleChanges, isStableAdmin],
  );

  const handleSaveRoleAccessOverrides = async () => {
    try {
      setIsSavingRoles(true);
      const editableRoles = availableRoles.filter(canEditManagedRole);
      await Promise.all(
        editableRoles.map((role) =>
          apiRequest(`/users/roles/${role.key}`, {
            method: "PUT",
            body: JSON.stringify({
              name: role.name,
              description: role.description || "",
              baseRole: role.baseRole,
              permissions: role.permissions,
            }),
          }),
        ),
      );
      await loadRoleConfigurations(true);
      if (isStableSuperAdmin) {
        await loadAuditLogs();
      }
      window.dispatchEvent(new Event("rbac-updated"));
      toast.success("Role access map saved");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save role access map",
      );
    } finally {
      setIsSavingRoles(false);
    }
  };

  const handleResetRoleAccessOverrides = async () => {
    await loadRoleConfigurations(true);
    toast.success("Role access changes reset");
  };

  const handleCreateRole = async () => {
    if (!newRoleKey.trim() || !newRoleName.trim()) {
      toast.error("Role key and role name are required");
      return;
    }

    const baseRoleConfig = availableRoles.find(
      (role) => role.key === newRoleBaseRole,
    );
    const permissions = baseRoleConfig?.permissions;
    if (!permissions) {
      toast.error("Base role permissions could not be loaded");
      return;
    }

    try {
      setIsCreatingRole(true);
      await apiRequest("/users/roles", {
        method: "POST",
        body: JSON.stringify({
          key: newRoleKey.trim().toLowerCase().replace(/\s+/g, "_"),
          name: newRoleName.trim(),
          description: newRoleDescription.trim(),
          baseRole: newRoleBaseRole,
          permissions,
        }),
      });
      setNewRoleKey("");
      setNewRoleName("");
      setNewRoleDescription("");
      setNewRoleBaseRole("member");
      await loadRoleConfigurations(true);
      if (isStableSuperAdmin) {
        await loadAuditLogs();
      }
      toast.success("Custom role created successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create role",
      );
    } finally {
      setIsCreatingRole(false);
    }
  };

  const handleDeleteRole = async (roleKey: string) => {
    try {
      setDeletingRoleKey(roleKey);
      await apiRequest(`/users/roles/${roleKey}`, {
        method: "DELETE",
      });
      await loadRoleConfigurations(true);
      await refreshUsers();
      if (isStableSuperAdmin) {
        await loadAuditLogs();
      }
      toast.success("Role deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete role",
      );
    } finally {
      setDeletingRoleKey(null);
    }
  };

  const canManageUserActions = (targetRole: UserRole, targetUserId: string) => {
    if (!isStableAdmin) return false;
    if (targetUserId === userId) return false;
    const currentRoleIndex = roleHierarchy.indexOf(stableBaseRole);
    const targetRoleIndex = roleHierarchy.indexOf(targetRole);
    return (
      currentRoleIndex >= 0 &&
      targetRoleIndex >= 0 &&
      currentRoleIndex < targetRoleIndex
    );
  };

  const loadAuditLogs = useCallback(async () => {
    if (!isStableSuperAdmin) return;
    try {
      setIsLoadingAuditLogs(true);
      const response = await apiRequest<
        | ApiEnvelope<{
            logs: AdminAuditLog[];
          }>
        | {
            logs: AdminAuditLog[];
          }
      >("/users/audit-logs?limit=100");
      const payload = "data" in response ? response.data : response;
      setAuditLogs(payload.logs || []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load audit logs",
      );
    } finally {
      setIsLoadingAuditLogs(false);
    }
  }, [isStableSuperAdmin]);

  const loadWorkflowAutomationStatus = useCallback(async () => {
    if (!canViewWorkflowAutomation) return;

    try {
      setIsLoadingWorkflowAutomationStatus(true);
      const response = await apiRequest<
        | ApiEnvelope<{ status: WorkflowAutomationStatus }>
        | { status: WorkflowAutomationStatus }
      >("/memos/workflow/automation-status");

      const payload = "data" in response ? response.data : response;
      setWorkflowAutomationStatus(payload.status || null);
    } catch (error) {
      setWorkflowAutomationStatus(null);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load workflow automation status",
      );
    } finally {
      setIsLoadingWorkflowAutomationStatus(false);
    }
  }, [canViewWorkflowAutomation]);

  const handleRoleChange = async (targetUserId: string, role: string) => {
    try {
      setUpdatingRoleUserId(targetUserId);
      await apiRequest(`/users/${targetUserId}`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
      await refreshUsers();
      await loadRoleConfigurations(true);
      toast.success("User role updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update role",
      );
    } finally {
      setUpdatingRoleUserId(null);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword) {
      toast.error("Name, email, and password are required");
      return;
    }
    if (newUserPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setIsCreatingUser(true);
      await apiRequest("/users", {
        method: "POST",
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          password: newUserPassword,
          department: newUserDepartment.trim() || "General",
          role: newUserRole,
        }),
      });

      setNewUserName("");
      setNewUserEmail("");
      setNewUserDepartment("General");
      setNewUserPassword("");
      setNewUserRole("member");
      await refreshUsers();
      await loadRoleConfigurations();
      if (isStableSuperAdmin) {
        await loadAuditLogs();
      }
      toast.success("User account created successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create user",
      );
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleToggleBlockUser = async (targetUserId: string) => {
    try {
      setActingOnUserId(targetUserId);
      await apiRequest(`/users/${targetUserId}/block`, {
        method: "PUT",
      });
      await refreshUsers();
      if (isStableSuperAdmin) {
        await loadAuditLogs();
      }
      toast.success("User access updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update user",
      );
    } finally {
      setActingOnUserId(null);
    }
  };

  const handleDeleteUser = async (targetUserId: string) => {
    try {
      setActingOnUserId(targetUserId);
      await apiRequest(`/users/${targetUserId}`, {
        method: "DELETE",
      });
      await refreshUsers();
      if (isStableSuperAdmin) {
        await loadAuditLogs();
      }
      toast.success("User deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete user",
      );
    } finally {
      setActingOnUserId(null);
    }
  };

  useEffect(() => {
    if (!isStableAdmin) return;

    void loadRoleConfigurations();
    const interval = window.setInterval(() => {
      void loadRoleConfigurations();
    }, 30000);

    const handleFocus = () => {
      void loadRoleConfigurations();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadRoleConfigurations, isStableAdmin]);

  useEffect(() => {
    if (!isStableAdmin) return;

    void refreshUsers();
    const interval = window.setInterval(() => {
      void refreshUsers();
    }, 30000);

    const handleFocus = () => {
      void refreshUsers();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshUsers, isStableAdmin]);

  useEffect(() => {
    if (!isStableSuperAdmin) return;

    void loadAuditLogs();
    const interval = window.setInterval(() => {
      void loadAuditLogs();
    }, 30000);

    const handleFocus = () => {
      void loadAuditLogs();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadAuditLogs, isStableSuperAdmin]);

  useEffect(() => {
    if (!canViewWorkflowAutomation) return;

    void loadWorkflowAutomationStatus();
    const interval = window.setInterval(() => {
      void loadWorkflowAutomationStatus();
    }, 30000);

    const handleFocus = () => {
      void loadWorkflowAutomationStatus();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [canViewWorkflowAutomation, loadWorkflowAutomationStatus]);

  return (
    <AppLayout title="Settings">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Settings2 className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display font-bold text-lg">Settings</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                Logged in as{" "}
                <span className="font-medium">{currentUser?.name}</span>
              </span>
              <Badge
                className={`text-[9px] px-1.5 py-0 ${roleBadgeColor(currentRole)}`}
              >
                {roleLabels[currentRole]}
              </Badge>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Horizontal scrollable tabs on mobile, vertical sidebar on desktop */}
          <div className="flex flex-col md:flex-row gap-6">
            {/* Mobile: horizontal scrollable tab bar */}
            <div className="md:hidden">
              <ScrollArea className="w-full">
                <TabsList className="inline-flex w-max h-auto bg-card border border-border/50 p-1 rounded-xl gap-1">
                  {visibleTabs.map((t) => (
                    <TabsTrigger
                      key={t.id}
                      value={t.id}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <t.icon className="h-3.5 w-3.5" />
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>

            {/* Desktop: vertical sidebar tabs */}
            <div className="hidden md:block">
              <TabsList className="flex flex-col h-auto w-52 bg-card border border-border/50 p-1.5 rounded-xl gap-0.5">
                {visibleTabs.map((t) => (
                  <TabsTrigger
                    key={t.id}
                    value={t.id}
                    className="w-full justify-start gap-2.5 px-3 py-2.5 text-xs rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <t.icon className="h-4 w-4" />
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="flex-1 min-w-0">
              {/* PROFILE */}
              <TabsContent value="profile" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-display">
                      Personal Profile
                    </CardTitle>
                    <CardDescription>
                      Manage your profile information
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="h-16 w-16">
                          <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                            {getUserInitials(
                              profileName || currentUser?.name || "",
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${
                            getUserStatus(userId) === "online"
                              ? "bg-emerald-500"
                              : getUserStatus(userId) === "away"
                                ? "bg-amber-500"
                                : "bg-muted-foreground/40"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="font-medium">{profileName}</p>
                        <p className="text-sm text-muted-foreground">
                          {profileEmail}
                        </p>
                        <Badge
                          className={`mt-1 text-[10px] ${roleBadgeColor(currentRole)}`}
                        >
                          {roleLabels[currentRole]}
                        </Badge>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Display Name</Label>
                        <Input
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email Address</Label>
                        <Input
                          value={profileEmail}
                          onChange={(e) => setProfileEmail(e.target.value)}
                          type="email"
                          readOnly
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Department</Label>
                        <Input
                          value={profileDept}
                          onChange={(e) => setProfileDept(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Bio</Label>
                        <Input
                          value={profileBio}
                          onChange={(e) => setProfileBio(e.target.value)}
                          placeholder="Tell others about yourself..."
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleSaveProfile}
                      className="gap-1.5"
                      disabled={isSavingProfile}
                    >
                      <Save className="h-3.5 w-3.5" /> Save Profile
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* NOTIFICATIONS */}
              <TabsContent value="notifications" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-display">
                      Notification Preferences
                    </CardTitle>
                    <CardDescription>
                      Control how and when you receive notifications
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-4">
                      {[
                        {
                          label: "Email Notifications",
                          desc: "Receive notifications via email",
                          state: emailNotifs,
                          set: setEmailNotifs,
                        },
                        {
                          label: "Push Notifications",
                          desc: "Browser push notifications",
                          state: pushNotifs,
                          set: setPushNotifs,
                        },
                        {
                          label: "Memo Notifications",
                          desc: "New memos and updates",
                          state: memoNotifs,
                          set: setMemoNotifs,
                        },
                        {
                          label: "Mention Alerts",
                          desc: "When someone mentions you",
                          state: mentionNotifs,
                          set: setMentionNotifs,
                        },
                        {
                          label: "Workflow Alerts",
                          desc: "Pending approvals and status changes",
                          state: workflowNotifs,
                          set: setWorkflowNotifs,
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-medium">{item.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.desc}
                            </p>
                          </div>
                          <Switch
                            checked={item.state}
                            onCheckedChange={item.set}
                          />
                        </div>
                      ))}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>Digest Frequency</Label>
                      <Select
                        value={digestFrequency}
                        onValueChange={setDigestFrequency}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="realtime">Real-time</SelectItem>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={handleSaveNotifications}
                      className="gap-1.5"
                    >
                      <Save className="h-3.5 w-3.5" /> Save Preferences
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* APPEARANCE */}
              <TabsContent value="appearance" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-display">
                      Appearance
                    </CardTitle>
                    <CardDescription>
                      Customize the look and feel
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label>Theme</Label>
                      <Select value={theme} onValueChange={setTheme}>
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">☀️ Light</SelectItem>
                          <SelectItem value="dark">🌙 Dark</SelectItem>
                          <SelectItem value="system">💻 System</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Compact Mode</p>
                        <p className="text-xs text-muted-foreground">
                          Reduce spacing for denser layouts
                        </p>
                      </div>
                      <Switch
                        checked={compactMode}
                        onCheckedChange={setCompactMode}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Animations</p>
                        <p className="text-xs text-muted-foreground">
                          Enable transition and motion effects
                        </p>
                      </div>
                      <Switch
                        checked={animationsEnabled}
                        onCheckedChange={setAnimationsEnabled}
                      />
                    </div>

                    <Button onClick={handleSaveAppearance} className="gap-1.5">
                      <Save className="h-3.5 w-3.5" /> Save Appearance
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* SECURITY */}
              <TabsContent value="security" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-display">
                      Security
                    </CardTitle>
                    <CardDescription>
                      Manage your account security
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label>Change Password</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="relative">
                          <Input
                            type={showCurrentPassword ? "text" : "password"}
                            placeholder="Current password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="pr-10"
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showCurrentPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <div className="relative">
                          <Input
                            type={showNewPassword ? "text" : "password"}
                            placeholder="New password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="pr-10"
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showNewPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <div className="relative sm:col-span-2">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="pr-10"
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          Two-Factor Authentication
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Add an extra layer of security
                        </p>
                      </div>
                      <Switch
                        checked={twoFactor}
                        onCheckedChange={setTwoFactor}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Session Timeout (minutes)</Label>
                      <Select
                        value={sessionTimeout}
                        onValueChange={setSessionTimeout}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                          <SelectItem value="120">2 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={handleSaveSecurity}
                      className="gap-1.5"
                      disabled={isChangingPassword}
                    >
                      <Save className="h-3.5 w-3.5" />{" "}
                      {isChangingPassword
                        ? "Saving…"
                        : "Save Security Settings"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* USER MANAGEMENT (admin+) */}
              <TabsContent value="users" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <Shield className="h-4 w-4 text-warning" /> User
                      Management
                    </CardTitle>
                    <CardDescription>
                      Manage user accounts, roles, blocking, and deletion
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isStableAdmin && (
                      <div className="rounded-lg border border-border p-4 space-y-4">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <UserPlus className="h-4 w-4 text-primary" /> Create
                          User
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input
                              value={newUserName}
                              onChange={(e) => setNewUserName(e.target.value)}
                              placeholder="New user name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                              type="email"
                              value={newUserEmail}
                              onChange={(e) => setNewUserEmail(e.target.value)}
                              placeholder="user@memohub.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Department</Label>
                            <Input
                              value={newUserDepartment}
                              onChange={(e) =>
                                setNewUserDepartment(e.target.value)
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Initial Password</Label>
                            <Input
                              type="password"
                              value={newUserPassword}
                              onChange={(e) =>
                                setNewUserPassword(e.target.value)
                              }
                              placeholder="Temporary password"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label>Role</Label>
                            <Select
                              value={newUserRole}
                              onValueChange={(value) => setNewUserRole(value)}
                            >
                              <SelectTrigger className="w-full sm:w-56">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {assignableRoles.map((role) => (
                                  <SelectItem key={role.key} value={role.key}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button
                          className="gap-1.5"
                          onClick={handleCreateUser}
                          disabled={isCreatingUser}
                        >
                          <Save className="h-3.5 w-3.5" />
                          {isCreatingUser ? "Creating..." : "Create User"}
                        </Button>
                      </div>
                    )}

                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground">
                        <span>User</span>
                        <span>Role</span>
                        <span>Status</span>
                        <span>Actions</span>
                      </div>
                      {allUsers.map((u) => {
                        const uStatus = getUserStatus(u.id);
                        const assignedRoleKey = u.assignedRoleKey || u.role;
                        const canManage = canManageUserActions(
                          (u.baseRole || u.role) as UserRole,
                          u.id,
                        );
                        return (
                          <div
                            key={u.id}
                            className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto] gap-2 sm:gap-4 items-start sm:items-center p-3 border-t border-border"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="relative shrink-0">
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                                    {getUserInitials(u.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
                                    uStatus === "online"
                                      ? "bg-emerald-500"
                                      : uStatus === "away"
                                        ? "bg-amber-500"
                                        : "bg-muted-foreground/40"
                                  }`}
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {u.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {u.email}
                                </p>
                                {u.isBlocked && (
                                  <Badge className="mt-1 text-[9px] bg-destructive/10 text-destructive">
                                    Blocked
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {canManageRoleForUser(assignedRoleKey) &&
                            u.id !== userId ? (
                              <Select
                                value={assignedRoleKey}
                                onValueChange={(value) =>
                                  void handleRoleChange(u.id, value)
                                }
                                disabled={updatingRoleUserId === u.id}
                              >
                                <SelectTrigger className="h-7 w-[140px] text-[10px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {assignableRoles.map((role) => (
                                    <SelectItem key={role.key} value={role.key}>
                                      {role.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge
                                className={`text-[9px] ${roleBadgeColor(u.role)}`}
                              >
                                {u.assignedRoleName ||
                                  roleLabels[u.role as UserRole] ||
                                  u.role}
                              </Badge>
                            )}
                            <span
                              className={`text-[10px] font-medium capitalize ${
                                uStatus === "online"
                                  ? "text-success"
                                  : uStatus === "away"
                                    ? "text-warning"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {uStatus}
                            </span>
                            <div className="flex items-center gap-2">
                              {canManage ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[10px]"
                                    onClick={() =>
                                      void handleToggleBlockUser(u.id)
                                    }
                                    disabled={actingOnUserId === u.id}
                                  >
                                    <Ban className="h-3 w-3 mr-1" />
                                    {u.isBlocked ? "Unblock" : "Block"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 px-2 text-[10px]"
                                    onClick={() => void handleDeleteUser(u.id)}
                                    disabled={actingOnUserId === u.id}
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                                  </Button>
                                </>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">
                                  —
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {isStableAdmin && (
                      <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                        <p className="text-sm font-medium">Role Hierarchy</p>
                        <div className="flex flex-wrap gap-2">
                          {roleHierarchy.map((role, i) => (
                            <div key={role} className="flex items-center gap-1">
                              <Badge
                                className={`text-[10px] ${roleBadgeColor(role)}`}
                              >
                                {roleLabels[role]}
                              </Badge>
                              {i < roleHierarchy.length - 1 && (
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Higher roles inherit all permissions of lower roles
                        </p>

                        <Separator className="my-2" />

                        <div className="space-y-3">
                          <p className="text-sm font-medium">
                            Role Access Breakdown
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Admin and Super Admin can customize access for each
                            built-in role by checking or unchecking privileges.
                          </p>

                          <div className="rounded-lg border border-border overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/40">
                                  <tr>
                                    <th className="text-left font-medium p-2 min-w-[180px]">
                                      Access / Privilege
                                    </th>
                                    {availableRoles.map((role) => (
                                      <th
                                        key={role.key}
                                        className="text-center font-medium p-2 min-w-[110px]"
                                      >
                                        <div className="space-y-1">
                                          <div>{role.name}</div>
                                          <div className="text-[10px] text-muted-foreground">
                                            {roleLabels[role.baseRole]}
                                          </div>
                                        </div>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {permissionSections.map((section) => (
                                    <Fragment key={section.title}>
                                      <tr className="bg-muted/20 border-t border-border">
                                        <td
                                          className="p-2 font-medium text-muted-foreground"
                                          colSpan={availableRoles.length + 1}
                                        >
                                          {section.title}
                                        </td>
                                      </tr>
                                      {section.keys.map((permission) => (
                                        <tr
                                          key={`${section.title}-${permission}`}
                                          className="border-t border-border"
                                        >
                                          <td className="p-2">
                                            {formatPermissionLabel(permission)}
                                          </td>
                                          {availableRoles.map((role) => (
                                            <td
                                              key={`${role.key}-${permission}`}
                                              className="p-2 text-center"
                                            >
                                              <input
                                                type="checkbox"
                                                aria-label={`${role.name} - ${formatPermissionLabel(permission)}`}
                                                checked={getRolePermissionValue(
                                                  role.key,
                                                  permission,
                                                )}
                                                disabled={
                                                  !canEditRoleAccess ||
                                                  !canEditManagedRole(role)
                                                }
                                                onChange={(e) =>
                                                  handleRolePermissionToggle(
                                                    role.key,
                                                    permission,
                                                    e.target.checked,
                                                  )
                                                }
                                                className="h-4 w-4 rounded border-border"
                                              />
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </Fragment>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              className="gap-1.5"
                              onClick={handleSaveRoleAccessOverrides}
                              disabled={
                                !canEditRoleAccess ||
                                isSavingRoles ||
                                isLoadingRoles
                              }
                            >
                              <Save className="h-3.5 w-3.5" />{" "}
                              {isSavingRoles ? "Saving..." : "Save Access Map"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleResetRoleAccessOverrides}
                              disabled={!canEditRoleAccess || isLoadingRoles}
                            >
                              Reset Defaults
                            </Button>
                          </div>

                          {canEditRoleAccess && (
                            <div className="rounded-lg border border-border p-4 space-y-4">
                              <p className="text-sm font-medium">
                                Create Custom Role
                              </p>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <Label>Role Key</Label>
                                  <Input
                                    value={newRoleKey}
                                    onChange={(e) =>
                                      setNewRoleKey(e.target.value)
                                    }
                                    placeholder="content_editor"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Display Name</Label>
                                  <Input
                                    value={newRoleName}
                                    onChange={(e) =>
                                      setNewRoleName(e.target.value)
                                    }
                                    placeholder="Content Editor"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Base Role</Label>
                                  <Select
                                    value={newRoleBaseRole}
                                    onValueChange={(value) =>
                                      setNewRoleBaseRole(value as UserRole)
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {roleHierarchy
                                        .filter(
                                          (role) =>
                                            roleHierarchy.indexOf(currentRole) <
                                            roleHierarchy.indexOf(role),
                                        )
                                        .map((role) => (
                                          <SelectItem key={role} value={role}>
                                            {roleLabels[role]}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Description</Label>
                                  <Input
                                    value={newRoleDescription}
                                    onChange={(e) =>
                                      setNewRoleDescription(e.target.value)
                                    }
                                    placeholder="Optional role description"
                                  />
                                </div>
                              </div>
                              <Button
                                size="sm"
                                className="gap-1.5"
                                onClick={handleCreateRole}
                                disabled={isCreatingRole}
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                                {isCreatingRole
                                  ? "Creating..."
                                  : "Create Custom Role"}
                              </Button>
                            </div>
                          )}

                          {availableRoles.some((role) => !role.isBuiltIn) && (
                            <div className="rounded-lg border border-border p-4 space-y-3">
                              <p className="text-sm font-medium">
                                Custom Roles
                              </p>
                              <div className="space-y-2">
                                {availableRoles
                                  .filter((role) => !role.isBuiltIn)
                                  .map((role) => (
                                    <div
                                      key={role.key}
                                      className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
                                    >
                                      <div>
                                        <p className="text-sm font-medium">
                                          {role.name}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                          Key: {role.key} · Base:{" "}
                                          {roleLabels[role.baseRole]}
                                        </p>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={
                                          !canEditManagedRole(role) ||
                                          deletingRoleKey === role.key
                                        }
                                        onClick={() =>
                                          void handleDeleteRole(role.key)
                                        }
                                      >
                                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                                        {deletingRoleKey === role.key
                                          ? "Deleting..."
                                          : "Delete"}
                                      </Button>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* AUDIT LOGS (super_admin) */}
              <TabsContent value="audit" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-destructive" />
                      Administration Audit Logs
                    </CardTitle>
                    <CardDescription>
                      Real-time report of administrative user-management actions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_auto] gap-4 p-3 bg-muted/50 text-xs font-medium text-muted-foreground">
                        <span>Time</span>
                        <span>Actor</span>
                        <span>Action</span>
                        <span>Target</span>
                      </div>
                      {isLoadingAuditLogs ? (
                        <div className="p-4 text-xs text-muted-foreground">
                          Loading audit logs...
                        </div>
                      ) : auditLogs.length === 0 ? (
                        <div className="p-4 text-xs text-muted-foreground">
                          No audit logs found.
                        </div>
                      ) : (
                        auditLogs.map((log) => (
                          <div
                            key={log.id}
                            className="grid gap-2 sm:grid-cols-[auto_1fr_1fr_auto] p-3 border-t border-border items-start text-xs"
                          >
                            <span className="text-muted-foreground whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                            <span>
                              {log.user?.name || "Unknown"}
                              <span className="ml-1 text-muted-foreground">
                                ({log.user?.email || "unknown"})
                              </span>
                            </span>
                            <span className="font-medium">{log.action}</span>
                            <span className="text-muted-foreground break-all">
                              {log.details?.email || log.resourceId}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* SYSTEM (admin+) */}
              <TabsContent value="system" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-primary" /> System
                      Configuration
                    </CardTitle>
                    <CardDescription>
                      Platform-wide settings that affect all users
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {canViewWorkflowAutomation && (
                      <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/20">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-sm font-medium">
                              Workflow Automation Monitor
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Scheduled delivery and escalation processor status
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void loadWorkflowAutomationStatus()}
                            disabled={isLoadingWorkflowAutomationStatus}
                          >
                            {isLoadingWorkflowAutomationStatus
                              ? "Refreshing..."
                              : "Refresh"}
                          </Button>
                        </div>

                        {workflowAutomationStatus ? (
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                            <div className="rounded-md border border-border p-3 bg-card">
                              <p className="text-muted-foreground">Last run</p>
                              <p className="font-medium mt-1">
                                {workflowAutomationStatus.lastRunAt
                                  ? new Date(
                                      workflowAutomationStatus.lastRunAt,
                                    ).toLocaleString()
                                  : "Never"}
                              </p>
                            </div>
                            <div className="rounded-md border border-border p-3 bg-card">
                              <p className="text-muted-foreground">
                                Last success
                              </p>
                              <p className="font-medium mt-1">
                                {workflowAutomationStatus.lastSuccessAt
                                  ? new Date(
                                      workflowAutomationStatus.lastSuccessAt,
                                    ).toLocaleString()
                                  : "Never"}
                              </p>
                            </div>
                            <div className="rounded-md border border-border p-3 bg-card">
                              <p className="text-muted-foreground">
                                Scheduled processed
                              </p>
                              <p className="font-medium mt-1">
                                {
                                  workflowAutomationStatus.scheduledProcessedLastRun
                                }
                                <span className="text-muted-foreground ml-1">
                                  (total{" "}
                                  {
                                    workflowAutomationStatus.totalScheduledProcessed
                                  }
                                  )
                                </span>
                              </p>
                            </div>
                            <div className="rounded-md border border-border p-3 bg-card">
                              <p className="text-muted-foreground">
                                Escalations processed
                              </p>
                              <p className="font-medium mt-1">
                                {
                                  workflowAutomationStatus.escalationsProcessedLastRun
                                }
                                <span className="text-muted-foreground ml-1">
                                  (total{" "}
                                  {
                                    workflowAutomationStatus.totalEscalationsProcessed
                                  }
                                  )
                                </span>
                              </p>
                            </div>
                            <div className="rounded-md border border-border p-3 bg-card sm:col-span-2 lg:col-span-4">
                              <p className="text-muted-foreground">
                                Last error
                              </p>
                              <p
                                className={`font-medium mt-1 ${workflowAutomationStatus.lastError ? "text-destructive" : "text-success"}`}
                              >
                                {workflowAutomationStatus.lastError ||
                                  "No errors reported"}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {isLoadingWorkflowAutomationStatus
                              ? "Loading workflow automation status..."
                              : "No workflow automation status available yet."}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          Allow Public Memos
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Users can create memos visible to everyone
                        </p>
                      </div>
                      <Switch
                        checked={allowPublicMemos}
                        onCheckedChange={setAllowPublicMemos}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          Require Approval for Broadcasts
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Memos sent to all must be admin-approved first
                        </p>
                      </div>
                      <Switch
                        checked={requireApproval}
                        onCheckedChange={setRequireApproval}
                      />
                    </div>

                    <Separator />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Max Attachment Size (MB)</Label>
                        <Select
                          value={maxAttachmentSize}
                          onValueChange={setMaxAttachmentSize}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5 MB</SelectItem>
                            <SelectItem value="10">10 MB</SelectItem>
                            <SelectItem value="25">25 MB</SelectItem>
                            <SelectItem value="50">50 MB</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Audit Log Retention (days)</Label>
                        <Select
                          value={auditRetention}
                          onValueChange={setAuditRetention}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 days</SelectItem>
                            <SelectItem value="90">90 days</SelectItem>
                            <SelectItem value="180">180 days</SelectItem>
                            <SelectItem value="365">1 year</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button onClick={handleSaveSystem} className="gap-1.5">
                      <Save className="h-3.5 w-3.5" /> Save System Settings
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* DEVELOPER (super_admin only) */}
              <TabsContent value="developer" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <Code className="h-4 w-4 text-destructive" /> Developer
                      Tools
                    </CardTitle>
                    <CardDescription>
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                        Super Admin only — affects core platform behavior
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 space-y-3">
                      <p className="text-sm font-medium text-destructive">
                        Danger Zone
                      </p>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Debug Mode</p>
                          <p className="text-xs text-muted-foreground">
                            Enable verbose logging and debug panels
                          </p>
                        </div>
                        <Switch
                          checked={debugMode}
                          onCheckedChange={setDebugMode}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            API Rate Limiting
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Control request throttling
                          </p>
                        </div>
                        <Select value={rateLimit} onValueChange={setRateLimit}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="strict">Strict</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            Maintenance Mode
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Show maintenance page to non-admin users
                          </p>
                        </div>
                        <Switch
                          checked={maintenanceMode}
                          onCheckedChange={setMaintenanceMode}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        Integration Endpoints
                      </p>
                      <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs text-muted-foreground">
                            Webhook URL
                          </span>
                          <code className="text-[10px] bg-muted px-2 py-1 rounded break-all">
                            https://api.memohub.com/webhooks
                          </code>
                        </div>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs text-muted-foreground">
                            API Version
                          </span>
                          <code className="text-[10px] bg-muted px-2 py-1 rounded">
                            v2.1.0
                          </code>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={handleSaveDeveloper}
                      variant="destructive"
                      className="gap-1.5"
                    >
                      <Save className="h-3.5 w-3.5" /> Save Developer Settings
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Settings;
