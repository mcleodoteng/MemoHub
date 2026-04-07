const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const TOKEN_STORAGE_KEY = "memohub_auth_token";
const TOKEN_PERSIST_KEY = "memohub_auth_persist";
const AUTH_REDIRECT_EXEMPT_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/verify-2fa",
  "/auth/resend-2fa",
  "/auth/complete-password-setup",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/validate-reset-token",
];

let hasTriggeredSessionRedirect = false;

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface BackendUser {
  id: string;
  name: string;
  email: string;
  bio?: string | null;
  avatar?: string | null;
  role?: string;
  assignedRoleKey?: string;
  assignedRoleName?: string;
  baseRole?: string;
  department?: string;
  status?: string;
  isBlocked?: boolean;
  createdAt?: string;
  twoFactorEnabled?: boolean;
  sessionTimeoutMinutes?: number;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function getStoredToken() {
  return (
    localStorage.getItem(TOKEN_STORAGE_KEY) ||
    sessionStorage.getItem(TOKEN_STORAGE_KEY)
  );
}

export function storeToken(token: string, persist: boolean) {
  if (persist) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(TOKEN_PERSIST_KEY, "true");
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } else {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_PERSIST_KEY);
  }
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_PERSIST_KEY);
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

function shouldRedirectToLoginOnUnauthorized(path: string, hasToken: boolean) {
  if (!hasToken) return false;

  const normalizedPath = path.toLowerCase();
  return !AUTH_REDIRECT_EXEMPT_PATHS.some((exemptPath) =>
    normalizedPath.startsWith(exemptPath),
  );
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const rawError =
      typeof data?.error === "string" ? data.error : "Request failed";
    const normalized = rawError.toLowerCase();

    let friendlyMessage =
      "We could not complete your request. Please try again.";

    if (response.status === 401) {
      if (normalized.includes("invalid credentials")) {
        friendlyMessage = "Invalid email or password.";
      } else if (normalized.includes("invalid verification code")) {
        friendlyMessage = "Invalid verification code.";
      } else if (
        normalized.includes("verification code has expired") ||
        normalized.includes("expired verification session")
      ) {
        friendlyMessage =
          "Your verification session has expired. Please sign in again.";
      } else if (normalized.includes("password setup session")) {
        friendlyMessage =
          "Your password setup session has expired. Please sign in again.";
      } else {
        friendlyMessage = "Your session has expired. Please sign in again.";
      }
    } else if (response.status === 403) {
      friendlyMessage = "You do not have permission to do that.";
    } else if (
      response.status === 404 &&
      normalized.includes("email") &&
      normalized.includes("cannot be found")
    ) {
      friendlyMessage = "The email you entered cannot be found.";
    } else if (response.status === 404 || normalized.includes("not found")) {
      friendlyMessage = "That item could not be found.";
    } else if (
      normalized.includes("already reacted") &&
      normalized.includes("comment")
    ) {
      friendlyMessage = "You have already reacted to this comment.";
    } else if (
      normalized.includes("already reacted") &&
      normalized.includes("memo")
    ) {
      friendlyMessage = "You have already reacted to this memo.";
    } else if (normalized.includes("already reacted")) {
      friendlyMessage = "You have already reacted to this item.";
    } else if (
      normalized.includes("current password") &&
      normalized.includes("incorrect")
    ) {
      friendlyMessage =
        "Your current password is incorrect. Please re-enter it and try again.";
    } else if (normalized.includes("max attachment size")) {
      friendlyMessage = rawError;
    } else if (
      normalized.includes("invalid") ||
      normalized.includes("required") ||
      response.status === 400
    ) {
      friendlyMessage =
        "Some information is missing or invalid. Please check and try again.";
    } else if (response.status >= 500) {
      friendlyMessage = "Something went wrong on our side. Please try again.";
    }

    throw new Error(friendlyMessage);
  }

  return data as T;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}) {
  const token = getStoredToken();
  const hasToken = Boolean(token);
  const headers = new Headers(init.headers || {});

  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (
    response.status === 401 &&
    shouldRedirectToLoginOnUnauthorized(path, hasToken)
  ) {
    clearStoredToken();

    if (!hasTriggeredSessionRedirect && typeof window !== "undefined") {
      hasTriggeredSessionRedirect = true;
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }
  }

  return parseResponse<T>(response);
}

export function getSafeErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("already reacted") && message.includes("comment")) {
    return "You have already reacted to this comment.";
  }

  if (message.includes("already reacted")) {
    return "You have already reacted to this memo.";
  }

  if (message.includes("unauthorized") || message.includes("invalid token")) {
    return "Your session has expired. Please sign in again.";
  }

  if (message.includes("forbidden") || message.includes("permission")) {
    return "You do not have permission to do this action.";
  }

  if (message.includes("not found")) {
    return "The item you requested could not be found.";
  }

  return fallback;
}

export function normalizeRole(
  role?: string,
): "super_admin" | "admin" | "manager" | "group_leader" | "member" {
  const normalized = (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  switch (normalized) {
    case "superuser":
    case "super_user":
    case "superadmin":
      return "super_admin";
    case "super_admin":
    case "admin":
    case "manager":
    case "group_leader":
      return normalized;
    default:
      return "member";
  }
}

export function normalizeStatus(
  status?: string,
): "online" | "away" | "offline" {
  switch (status) {
    case "away":
    case "offline":
      return status;
    default:
      return "online";
  }
}
