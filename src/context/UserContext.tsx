import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { User } from "@/types";
import {
  apiRequest,
  BackendUser,
  normalizeRole,
  normalizeStatus,
} from "@/lib/api";
import { AuthContext } from "@/context/AuthContext";

interface UserContextType {
  users: User[];
  isLoading: boolean;
  getUserById: (id: string) => User | undefined;
  refreshUsers: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

function mapBackendUser(user: BackendUser): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    bio: user.bio || "",
    avatar: user.avatar || "",
    role: normalizeRole(user.role),
    assignedRoleKey: user.assignedRoleKey || user.role,
    assignedRoleName: user.assignedRoleName || undefined,
    baseRole: normalizeRole(user.baseRole || user.role),
    department: user.department || "General",
    status: normalizeStatus(user.status),
    isBlocked: user.isBlocked || false,
    createdAt: user.createdAt || new Date().toISOString(),
  };
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const auth = useContext(AuthContext);
  const isAuthenticated = auth?.isAuthenticated ?? false;
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshUsers = useCallback(async () => {
    if (!isAuthenticated) {
      setUsers([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest<{ users: BackendUser[] }>("/users");
      setUsers((response.data.users || []).map(mapBackendUser));
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

  const getUserById = useCallback(
    (id: string) => users.find((user) => user.id === id),
    [users],
  );

  const value = useMemo(
    () => ({
      users,
      isLoading,
      getUserById,
      refreshUsers,
    }),
    [users, isLoading, getUserById, refreshUsers],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUsers() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUsers must be used within UserProvider");
  return context;
}
