import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { Group, GroupInvite, GroupFile } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { apiRequest, getSafeErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { AlertCircle, X } from "lucide-react";

interface GroupContextType {
  groups: Group[];
  addGroup: (data: {
    name: string;
    description: string;
    type: Group["type"];
    memberIds: string[];
  }) => Promise<Group>;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
  addMember: (groupId: string, userId: string) => void;
  removeMember: (groupId: string, userId: string) => void;
  addAdmin: (groupId: string, userId: string) => void;
  removeAdmin: (groupId: string, userId: string) => void;
  getGroupById: (id: string) => Group | undefined;
  inviteUser: (groupId: string, userId: string) => Promise<void>;
  acceptInvite: (groupId: string, userId: string) => Promise<void>;
  declineInvite: (groupId: string, userId: string) => Promise<void>;
  cancelInvite: (groupId: string, userId: string) => Promise<void>;
  getInviteStatus: (groupId: string, userId: string) => GroupInvite | undefined;
  addFile: (
    groupId: string,
    file: Omit<GroupFile, "id" | "uploadedAt">,
  ) => void;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

function showFriendlyErrorToast(message: string) {
  toast.custom(
    (toastId) => (
      <div className="w-[400px] flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 shadow-lg">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-red-900">
            Action not completed
          </p>
          <p className="mt-0.5 text-xs text-red-800">{message}</p>
        </div>
        <button
          onClick={() => toast.dismiss(toastId)}
          className="shrink-0 rounded p-0.5 text-red-500 hover:text-red-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    ),
    { duration: 5000 },
  );
}

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, isAuthenticated } = useAuth();
  const { onEvent, offEvent } = useSocket();
  const [groups, setGroups] = useState<Group[]>([]);

  // ── mapping ─────────────────────────────────────────────────────
  const mapGroup = useCallback(
    (g: any): Group => ({
      id: g.id,
      name: g.name,
      description: g.description || "",
      type: (g.type || "public").toLowerCase() as Group["type"],
      memberIds: (g.members || []).map((m: any) => m.userId || m.id),
      adminIds: (g.members || [])
        .filter((m: any) => (m.role || "").toLowerCase() === "admin")
        .map((m: any) => m.userId || m.id),
      pendingInvites: (g.pendingInvites || []).map((i: any) => ({
        id: i.id,
        userId: i.userId,
        status: (i.status || "pending").toLowerCase() as GroupInvite["status"],
        invitedAt: i.invitedAt || i.createdAt || new Date().toISOString(),
        respondedAt: i.respondedAt,
      })),
      files: (g.files || []).map((f: any) => ({
        id: f.id,
        name: f.name || f.filename,
        url: f.url,
        type: f.type || f.mimeType || "file",
        size: f.size,
        uploadedBy: f.uploadedBy || f.uploaderId,
        uploadedAt: f.uploadedAt || f.createdAt || new Date().toISOString(),
      })),
      avatar: g.avatar || "",
      createdAt: g.createdAt || new Date().toISOString(),
    }),
    [],
  );

  const refreshGroups = useCallback(async () => {
    if (!isAuthenticated) return;
    const res = await apiRequest<{ groups: any[] }>("/groups");
    setGroups((res.data.groups || []).map(mapGroup));
  }, [isAuthenticated, mapGroup]);

  // ── initial load ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    void refreshGroups().catch((err) =>
      console.error("Failed to load groups:", err),
    );
  }, [isAuthenticated, refreshGroups]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;

    const handleNotificationCreated = (notification: {
      userId?: string;
      type?: string;
    }) => {
      if (
        notification?.userId === currentUser.id &&
        notification?.type === "group_invite"
      ) {
        void refreshGroups().catch((error) => {
          console.error(
            "Failed to refresh groups after invite notification:",
            error,
          );
        });
      }
    };

    onEvent("notification:new", handleNotificationCreated);

    return () => {
      offEvent("notification:new", handleNotificationCreated);
    };
  }, [currentUser?.id, isAuthenticated, onEvent, offEvent, refreshGroups]);

  // Refresh groups when any group membership changes (member joined, left, removed, invited)
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;

    const handleGroupMemberUpdated = () => {
      void refreshGroups().catch((error) => {
        console.error("Failed to refresh groups after member update:", error);
      });
    };

    onEvent("group:member_updated", handleGroupMemberUpdated);

    return () => {
      offEvent("group:member_updated", handleGroupMemberUpdated);
    };
  }, [currentUser?.id, isAuthenticated, onEvent, offEvent, refreshGroups]);

  const getGroupById = useCallback(
    (id: string) => groups.find((g) => g.id === id),
    [groups],
  );

  const addGroup = useCallback(
    async (data: {
      name: string;
      description: string;
      type: Group["type"];
      memberIds: string[];
    }) => {
      if (!currentUser) {
        throw new Error("Unauthorized");
      }
      const optimistic: Group = {
        id: `g${Date.now()}`,
        name: data.name,
        description: data.description,
        type: data.type,
        memberIds: [currentUser.id],
        adminIds: [currentUser.id],
        pendingInvites: data.memberIds.map((uid) => ({
          userId: uid,
          status: "pending" as const,
          invitedAt: new Date().toISOString(),
        })),
        files: [],
        avatar: "",
        createdAt: new Date().toISOString(),
      };
      setGroups((prev) => [...prev, optimistic]);

      try {
        const res = await apiRequest<{ group: any }>("/groups", {
          method: "POST",
          body: JSON.stringify({
            name: data.name,
            description: data.description,
            type: data.type,
            memberIds: data.memberIds,
          }),
        });

        if (!res.data.group) {
          throw new Error("Failed to create group");
        }

        const saved = mapGroup(res.data.group);
        setGroups((prev) =>
          prev.map((g) => (g.id === optimistic.id ? saved : g)),
        );

        return saved;
      } catch (err) {
        setGroups((prev) => prev.filter((g) => g.id !== optimistic.id));
        showFriendlyErrorToast(
          getSafeErrorMessage(
            err,
            "The group could not be created. Please try again.",
          ),
        );
        throw err;
      }
    },
    [currentUser, mapGroup],
  );

  const updateGroup = useCallback((id: string, updates: Partial<Group>) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...updates } : g)),
    );
    apiRequest(`/groups/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }).catch((err) =>
      showFriendlyErrorToast(
        getSafeErrorMessage(
          err,
          "The group could not be updated. Please try again.",
        ),
      ),
    );
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
    apiRequest(`/groups/${id}`, { method: "DELETE" }).catch((err) =>
      showFriendlyErrorToast(
        getSafeErrorMessage(
          err,
          "The group could not be deleted. Please try again.",
        ),
      ),
    );
  }, []);

  const addMember = useCallback((groupId: string, userId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId || g.memberIds.includes(userId)) return g;
        return { ...g, memberIds: [...g.memberIds, userId] };
      }),
    );
    apiRequest(`/groups/${groupId}/members`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    }).catch((err) =>
      showFriendlyErrorToast(
        getSafeErrorMessage(
          err,
          "The member could not be added. Please try again.",
        ),
      ),
    );
  }, []);

  const removeMember = useCallback((groupId: string, userId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          memberIds: g.memberIds.filter((id) => id !== userId),
          adminIds: g.adminIds.filter((id) => id !== userId),
        };
      }),
    );
    apiRequest(`/groups/${groupId}/members/${userId}`, {
      method: "DELETE",
    }).catch((err) =>
      showFriendlyErrorToast(
        getSafeErrorMessage(
          err,
          "The member could not be removed. Please try again.",
        ),
      ),
    );
  }, []);

  const addAdmin = useCallback((groupId: string, userId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId || g.adminIds.includes(userId)) return g;
        return { ...g, adminIds: [...g.adminIds, userId] };
      }),
    );
  }, []);

  const removeAdmin = useCallback((groupId: string, userId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        return { ...g, adminIds: g.adminIds.filter((id) => id !== userId) };
      }),
    );
  }, []);

  const inviteUser = useCallback(
    async (groupId: string, userId: string) => {
      const now = new Date().toISOString();
      const optimisticId = `tmp-invite-${groupId}-${userId}-${Date.now()}`;

      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== groupId) return g;
          if (g.memberIds.includes(userId)) return g;
          if (
            g.pendingInvites.some(
              (i) => i.userId === userId && i.status === "pending",
            )
          ) {
            return g;
          }

          const invite: GroupInvite = {
            id: optimisticId,
            userId,
            status: "pending",
            invitedAt: now,
          };
          return { ...g, pendingInvites: [...g.pendingInvites, invite] };
        }),
      );

      try {
        await apiRequest(`/groups/${groupId}/members/invite`, {
          method: "POST",
          body: JSON.stringify({ userId }),
        });
      } catch (error) {
        setGroups((prev) =>
          prev.map((g) => {
            if (g.id !== groupId) return g;
            return {
              ...g,
              pendingInvites: g.pendingInvites.filter(
                (invite) => invite.id !== optimisticId,
              ),
            };
          }),
        );
        throw error;
      }

      void refreshGroups().catch((error) => {
        console.error("Failed to refresh groups after inviting user:", error);
      });
    },
    [refreshGroups],
  );

  const acceptInvite = useCallback(
    async (groupId: string, userId: string) => {
      const group = groups.find((g) => g.id === groupId);
      const invite = group?.pendingInvites.find(
        (pendingInvite) => pendingInvite.userId === userId,
      );
      const inviteId = invite?.id || userId;

      await apiRequest(`/groups/${groupId}/invites/${inviteId}/respond`, {
        method: "POST",
        body: JSON.stringify({ status: "accepted" }),
      });

      const now = new Date().toISOString();
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            memberIds: g.memberIds.includes(userId)
              ? g.memberIds
              : [...g.memberIds, userId],
            pendingInvites: g.pendingInvites.filter(
              (pendingInvite) => pendingInvite.userId !== userId,
            ),
          };
        }),
      );

      void refreshGroups().catch((error) => {
        console.error(
          "Failed to refresh groups after accepting invite:",
          error,
        );
      });
    },
    [groups, refreshGroups],
  );

  const declineInvite = useCallback(
    async (groupId: string, userId: string) => {
      const group = groups.find((g) => g.id === groupId);
      const invite = group?.pendingInvites.find(
        (pendingInvite) => pendingInvite.userId === userId,
      );
      const inviteId = invite?.id || userId;

      await apiRequest(`/groups/${groupId}/invites/${inviteId}/respond`, {
        method: "POST",
        body: JSON.stringify({ status: "declined" }),
      });

      const now = new Date().toISOString();
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            memberIds: g.memberIds.filter((memberId) => memberId !== userId),
            adminIds: g.adminIds.filter((adminId) => adminId !== userId),
            pendingInvites: g.pendingInvites.filter(
              (pendingInvite) => pendingInvite.userId !== userId,
            ),
          };
        }),
      );

      void refreshGroups().catch((error) => {
        console.error(
          "Failed to refresh groups after declining invite:",
          error,
        );
      });
    },
    [groups, refreshGroups],
  );

  const cancelInvite = useCallback(
    async (groupId: string, userId: string) => {
      await apiRequest(`/groups/${groupId}/invites/${userId}`, {
        method: "DELETE",
      });

      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== groupId) return g;
          return {
            ...g,
            pendingInvites: g.pendingInvites.filter(
              (invite) =>
                invite.userId !== userId || invite.status !== "pending",
            ),
          };
        }),
      );

      void refreshGroups().catch((error) => {
        console.error(
          "Failed to refresh groups after canceling invite:",
          error,
        );
      });
    },
    [refreshGroups],
  );

  const getInviteStatus = useCallback(
    (groupId: string, userId: string) => {
      const group = groups.find((g) => g.id === groupId);
      return group?.pendingInvites.find((i) => i.userId === userId);
    },
    [groups],
  );

  const addFile = useCallback(
    (groupId: string, file: Omit<GroupFile, "id" | "uploadedAt">) => {
      setGroups((prev) =>
        prev.map((g) => {
          if (g.id !== groupId) return g;
          const newFile: GroupFile = {
            ...file,
            id: `gf${Date.now()}`,
            uploadedAt: new Date().toISOString(),
          };
          return { ...g, files: [...g.files, newFile] };
        }),
      );
    },
    [],
  );

  return (
    <GroupContext.Provider
      value={{
        groups,
        addGroup,
        updateGroup,
        deleteGroup,
        addMember,
        removeMember,
        addAdmin,
        removeAdmin,
        getGroupById,
        inviteUser,
        acceptInvite,
        declineInvite,
        cancelInvite,
        getInviteStatus,
        addFile,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
}

export function useGroups() {
  const context = useContext(GroupContext);
  if (!context) throw new Error("useGroups must be used within GroupProvider");
  return context;
}
