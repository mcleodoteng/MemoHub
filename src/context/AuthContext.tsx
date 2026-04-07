import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { User } from "@/types";
import {
  apiRequest,
  BackendUser,
  clearStoredToken,
  getStoredToken,
  normalizeRole,
  normalizeStatus,
  storeToken,
} from "@/lib/api";

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshCurrentUser: () => Promise<void>;
  login: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<{
    success: boolean;
    requiresTwoFactor?: boolean;
    challengeToken?: string;
    error?: string;
  }>;
  verifyTwoFactor: (
    challengeToken: string,
    code: string,
    rememberMe?: boolean,
  ) => Promise<{
    success: boolean;
    error?: string;
  }>;
  completePasswordSetup: (
    setupToken: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    payload: {
      name: string;
      email: string;
      password: string;
      department?: string;
    },
    rememberMe?: boolean,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

const LAST_ACTIVITY_KEY = "memohub_last_activity";

function touchActivity() {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function getLastActivity(): number {
  try {
    return (
      parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || "0", 10) || Date.now()
    );
  } catch {
    return Date.now();
  }
}

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
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    sessionTimeoutMinutes:
      typeof user.sessionTimeoutMinutes === "number"
        ? user.sessionTimeoutMinutes
        : 30,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const logout = useCallback(() => {
    void apiRequest("/auth/logout", { method: "POST" }).catch(() => undefined);
    setCurrentUser(null);
    clearStoredToken();
    try {
      localStorage.removeItem(LAST_ACTIVITY_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // Session timeout enforcement
  useEffect(() => {
    if (!currentUser) {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    const timeoutMs = (currentUser.sessionTimeoutMinutes ?? 30) * 60 * 1000;

    const handleActivity = () => touchActivity();
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    window.addEventListener("click", handleActivity, { passive: true });
    window.addEventListener("scroll", handleActivity, { passive: true });

    touchActivity(); // mark fresh activity on login / mount

    timeoutRef.current = setInterval(() => {
      if (Date.now() - getLastActivity() > timeoutMs) {
        logout();
      }
    }, 30_000);

    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
        timeoutRef.current = null;
      }
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
    };
  }, [currentUser?.id, currentUser?.sessionTimeoutMinutes, logout]);

  const refreshCurrentUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setCurrentUser(null);
      return;
    }

    try {
      const response = await apiRequest<{ user: BackendUser }>("/users/me");
      setCurrentUser(mapBackendUser(response.data.user));
    } catch {
      clearStoredToken();
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadCurrentUser = async () => {
      const token = getStoredToken();

      if (!token) {
        if (active) {
          setCurrentUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        await refreshCurrentUser();
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadCurrentUser();

    return () => {
      active = false;
    };
  }, [refreshCurrentUser]);

  const login = useCallback(
    async (email: string, password: string, rememberMe = false) => {
      try {
        const response = await apiRequest<
          | { user: BackendUser; token: string }
          | { requiresTwoFactor: true; challengeToken: string }
        >("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
          }),
        });

        const data = response.data;

        if ("requiresTwoFactor" in data && data.requiresTwoFactor) {
          return {
            success: true,
            requiresTwoFactor: true as const,
            challengeToken: data.challengeToken,
          };
        }

        const loginData = data as { user: BackendUser; token: string };
        storeToken(loginData.token, rememberMe);
        setCurrentUser(mapBackendUser(loginData.user));
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Login failed",
        };
      }
    },
    [],
  );

  const verifyTwoFactor = useCallback(
    async (challengeToken: string, code: string, rememberMe = false) => {
      try {
        const response = await apiRequest<{ user: BackendUser; token: string }>(
          "/auth/verify-2fa",
          {
            method: "POST",
            body: JSON.stringify({ challengeToken, code }),
          },
        );

        const loginData = response.data;
        storeToken(loginData.token, rememberMe);
        setCurrentUser(mapBackendUser(loginData.user));
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Verification failed",
        };
      }
    },
    [],
  );

  const completePasswordSetup = useCallback(
    async (setupToken: string, password: string, rememberMe = false) => {
      try {
        const response = await apiRequest<{ user: BackendUser; token: string }>(
          "/auth/complete-password-setup",
          {
            method: "POST",
            body: JSON.stringify({ setupToken, password }),
          },
        );

        storeToken(response.data.token, rememberMe);
        setCurrentUser(mapBackendUser(response.data.user));
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Password setup failed",
        };
      }
    },
    [],
  );

  const register = useCallback(
    async (
      payload: {
        name: string;
        email: string;
        password: string;
        department?: string;
      },
      rememberMe = true,
    ) => {
      try {
        const response = await apiRequest<{ user: BackendUser; token: string }>(
          "/auth/register",
          {
            method: "POST",
            body: JSON.stringify({
              ...payload,
              email: payload.email.trim().toLowerCase(),
            }),
          },
        );

        storeToken(response.data.token, rememberMe);
        setCurrentUser(mapBackendUser(response.data.user));
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Registration failed",
        };
      }
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        refreshCurrentUser,
        login,
        verifyTwoFactor,
        completePasswordSetup,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
