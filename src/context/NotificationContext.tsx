import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { Notification, NotificationType } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import {
  Bell,
  MessageSquare,
  CheckCircle,
  XCircle,
  Heart,
  Users,
  Clock,
  Star,
  Zap,
  X,
} from "lucide-react";

// ── OS / browser system notification helper ──────────────────────────────────
/**
 * Request permission once and return whether we can fire OS notifications.
 * Silently returns false in environments that don't support the API.
 */
async function requestOsNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (window.Notification.permission === "granted") return true;
  if (window.Notification.permission === "denied") return false;
  const result = await window.Notification.requestPermission();
  return result === "granted";
}

function fireOsNotification(title: string, body?: string, icon?: string) {
  if (!("Notification" in window)) return;
  if (window.Notification.permission !== "granted") return;
  // Don't fire when the tab is already in the foreground
  if (!document.hidden) return;
  try {
    const n = new window.Notification(title, {
      body: body || undefined,
      icon: icon || "/favicon.ico",
      tag: "memohub-notification",
    });
    // Auto-close after 6 seconds
    setTimeout(() => n.close(), 6000);
  } catch {
    // Some browsers block Notification construction — ignore silently
  }
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  hasMoreNotifications: boolean;
  isLoadingNotifications: boolean;
  loadMoreNotifications: () => Promise<void>;
  addNotification: (notif: Omit<Notification, "id" | "createdAt">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  deleteNotification: (id: string) => void;
  clearAllRead: () => void;
  notifyMentions: (
    text: string,
    sourceTitle: string,
    actionUrl: string,
    authorId: string,
  ) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

const NOTIFICATIONS_PAGE_SIZE = 50;

const SYNTHETIC_NOTIFICATION_PREFIXES = ["wf-", "rem-", "ginv-"];

const isPersistentNotificationId = (id: string) =>
  !SYNTHETIC_NOTIFICATION_PREFIXES.some((prefix) => id.startsWith(prefix));

/**
 * Get icon and color for notification type
 */
function getNotificationIcon(type: NotificationType): {
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
} {
  switch (type) {
    case "memo_received":
      return {
        icon: <MessageSquare className="h-4 w-4" />,
        bgColor: "bg-blue-500/20",
        textColor: "text-blue-400",
      };
    case "memo_approved":
      return {
        icon: <CheckCircle className="h-4 w-4" />,
        bgColor: "bg-green-500/20",
        textColor: "text-green-400",
      };
    case "memo_rejected":
      return {
        icon: <XCircle className="h-4 w-4" />,
        bgColor: "bg-red-500/20",
        textColor: "text-red-400",
      };
    case "comment_added":
      return {
        icon: <MessageSquare className="h-4 w-4" />,
        bgColor: "bg-cyan-500/20",
        textColor: "text-cyan-400",
      };
    case "reaction_added":
      return {
        icon: <Heart className="h-4 w-4" />,
        bgColor: "bg-pink-500/20",
        textColor: "text-pink-400",
      };
    case "message_received":
      return {
        icon: <MessageSquare className="h-4 w-4" />,
        bgColor: "bg-purple-500/20",
        textColor: "text-purple-400",
      };
    case "mention":
      return {
        icon: <Users className="h-4 w-4" />,
        bgColor: "bg-yellow-500/20",
        textColor: "text-yellow-400",
      };
    case "group_invite":
      return {
        icon: <Users className="h-4 w-4" />,
        bgColor: "bg-indigo-500/20",
        textColor: "text-indigo-400",
      };
    case "group_activity":
      return {
        icon: <Users className="h-4 w-4" />,
        bgColor: "bg-indigo-500/20",
        textColor: "text-indigo-400",
      };
    case "reminder":
      return {
        icon: <Clock className="h-4 w-4" />,
        bgColor: "bg-orange-500/20",
        textColor: "text-orange-400",
      };
    case "starred_activity":
      return {
        icon: <Star className="h-4 w-4" />,
        bgColor: "bg-amber-500/20",
        textColor: "text-amber-400",
      };
    case "workflow_pending_approval":
      return {
        icon: <Zap className="h-4 w-4" />,
        bgColor: "bg-amber-500/20",
        textColor: "text-amber-400",
      };
    default:
      return {
        icon: <Bell className="h-4 w-4" />,
        bgColor: "bg-cyan-500/20",
        textColor: "text-cyan-400",
      };
  }
}

function showNotificationToast(notification: Notification) {
  const { icon, bgColor, textColor } = getNotificationIcon(notification.type);

  // Fire OS notification in parallel (when tab is not focused)
  fireOsNotification(notification.title, notification.body || undefined);

  toast.custom(
    (toastId) => (
      <div className="w-[400px] rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-900 shadow-2xl animate-in slide-in-from-left-4 fade-in duration-300">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${bgColor} ${textColor} flex-shrink-0`}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              {notification.title}
            </p>
            {notification.body && (
              <p className="mt-1 line-clamp-2 text-xs text-slate-700 leading-relaxed">
                {notification.body}
              </p>
            )}
            <p className="mt-1.5 text-[11px] text-slate-500">Just now</p>
          </div>
          <button
            type="button"
            onClick={() => toast.dismiss(toastId)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-800"
            aria-label="Close notification"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    ),
    { duration: 25000 },
  );
}

/**
 * Extract mentioned user IDs from text containing @mentions.
 * Supports both plain text "@Name" and HTML mention anchors.
 */
function extractMentionedUserIds(text: string): string[] {
  const ids = new Set<string>();

  // Match HTML mention anchors: data-mention="userId"
  const htmlMentionRegex = /data-mention=["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = htmlMentionRegex.exec(text)) !== null) {
    ids.add(match[1]);
  }

  return Array.from(ids);
}

function normalizeNotificationType(type?: string): NotificationType {
  switch (type) {
    case "memo_received":
    case "memo_approved":
    case "memo_rejected":
    case "comment_added":
    case "reaction_added":
    case "message_received":
    case "mention":
    case "group_invite":
    case "group_activity":
    case "reminder":
    case "starred_activity":
    case "workflow_pending_approval":
      return type;
    case "new_memo":
      return "memo_received";
    case "new_comment":
      return "comment_added";
    case "new_message":
      return "message_received";
    case "reaction":
      return "reaction_added";
    case "workflow_approval":
    case "memo_status_update":
      return "memo_approved";
    default:
      return "memo_received";
  }
}

function sanitizeNotificationText(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  if (trimmed.startsWith("enc:v1:")) {
    return fallback;
  }

  return trimmed;
}

function mapBackendNotification(n: any): Notification {
  return {
    id: n.id,
    userId: n.userId,
    type: normalizeNotificationType(n.type),
    title: sanitizeNotificationText(n.title, "Notification"),
    body: sanitizeNotificationText(n.body || n.message, ""),
    read: Boolean(n.read ?? n.isRead ?? false),
    actionUrl: n.actionUrl,
    createdAt: n.createdAt || new Date().toISOString(),
  };
}

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, isAuthenticated } = useAuth();
  const { socket, onEvent, offEvent } = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(true);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const nextOffsetRef = useRef(0);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const hasHydratedRef = useRef(false);
  const [stickyReadIds, setStickyReadIds] = useState<Set<string>>(new Set());
  const [stickyReadNotifications, setStickyReadNotifications] = useState<
    Record<string, Notification>
  >({});

  useEffect(() => {
    if (!currentUser?.id) {
      setStickyReadIds(new Set());
      setStickyReadNotifications({});
      return;
    }

    const key = `memohub_sticky_read_notifs_${currentUser.id}`;
    const notifKey = `memohub_sticky_read_notif_objects_${currentUser.id}`;
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      setStickyReadIds(new Set(Array.isArray(parsed) ? parsed : []));

      const rawNotifs = localStorage.getItem(notifKey);
      const parsedNotifs = rawNotifs ? JSON.parse(rawNotifs) : {};
      if (parsedNotifs && typeof parsedNotifs === "object") {
        setStickyReadNotifications(
          parsedNotifs as Record<string, Notification>,
        );
      } else {
        setStickyReadNotifications({});
      }
    } catch {
      setStickyReadIds(new Set());
      setStickyReadNotifications({});
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const key = `memohub_sticky_read_notifs_${currentUser.id}`;
    localStorage.setItem(key, JSON.stringify(Array.from(stickyReadIds)));
  }, [stickyReadIds, currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const notifKey = `memohub_sticky_read_notif_objects_${currentUser.id}`;
    localStorage.setItem(notifKey, JSON.stringify(stickyReadNotifications));
  }, [stickyReadNotifications, currentUser?.id]);

  const loadNotifications = useCallback(
    async (append = false) => {
      if (!isAuthenticated || !currentUser?.id) {
        setNotifications([]);
        setHasMoreNotifications(false);
        nextOffsetRef.current = 0;
        knownNotificationIdsRef.current = new Set();
        hasHydratedRef.current = false;
        return;
      }

      try {
        setIsLoadingNotifications(true);
        const offset = append ? nextOffsetRef.current : 0;
        const res = await apiRequest<{ notifications: any[] }>(
          `/notifications?limit=${NOTIFICATIONS_PAGE_SIZE}&offset=${offset}`,
        );
        const rawList = res.data.notifications || [];

        const mapped = rawList.map((notification) => {
          const normalized = mapBackendNotification(notification);
          if (stickyReadIds.has(normalized.id)) {
            return {
              ...(stickyReadNotifications[normalized.id] || normalized),
              ...normalized,
              read: true,
            };
          }
          return normalized;
        });

        nextOffsetRef.current = offset + mapped.length;
        setHasMoreNotifications(mapped.length === NOTIFICATIONS_PAGE_SIZE);

        if (!append && hasHydratedRef.current) {
          const incomingNew = mapped.filter(
            (notification) =>
              !knownNotificationIdsRef.current.has(notification.id) &&
              !notification.read,
          );

          incomingNew
            .slice(0, 3)
            .forEach((notification) => showNotificationToast(notification));

          mapped.forEach((notification) => {
            knownNotificationIdsRef.current.add(notification.id);
          });
        }

        if (!append && !hasHydratedRef.current) {
          mapped.forEach((notification) => {
            knownNotificationIdsRef.current.add(notification.id);
          });
          hasHydratedRef.current = true;
        }

        const mappedIds = new Set(
          mapped.map((notification) => notification.id),
        );
        const cachedReadNotifs = append
          ? []
          : Object.values(stickyReadNotifications).filter(
              (notification) =>
                isPersistentNotificationId(notification.id) &&
                stickyReadIds.has(notification.id) &&
                !mappedIds.has(notification.id),
            );

        setNotifications((prev) => {
          const merged = append
            ? [...prev, ...mapped]
            : [...mapped, ...cachedReadNotifs];

          const deduped = new Map<string, Notification>();
          merged.forEach((notification) => {
            deduped.set(notification.id, notification);
            knownNotificationIdsRef.current.add(notification.id);
          });

          return Array.from(deduped.values()).sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        });
      } catch (err) {
        console.error("Failed to load notifications:", err);
      } finally {
        setIsLoadingNotifications(false);
      }
    },
    [isAuthenticated, currentUser?.id, stickyReadIds, stickyReadNotifications],
  );

  const loadMoreNotifications = useCallback(async () => {
    if (!hasMoreNotifications || isLoadingNotifications) return;
    await loadNotifications(true);
  }, [hasMoreNotifications, isLoadingNotifications, loadNotifications]);

  // ── initial load ───────────────────────────────────────────────────
  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  // ── request OS notification permission once after authentication ──
  useEffect(() => {
    if (isAuthenticated) {
      void requestOsNotificationPermission();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;

    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 8000);

    const handleFocus = () => {
      void loadNotifications();
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        void loadNotifications();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isAuthenticated, currentUser?.id, loadNotifications]);

  // ── socket.io real-time listeners ──────────────────────────────
  useEffect(() => {
    if (!socket || !currentUser) return;

    const handleNotificationCreated = (data: {
      id: string;
      userId: string;
      type: NotificationType;
      title: string;
      body: string;
      read?: boolean;
      isRead?: boolean;
      actionUrl?: string;
      createdAt: string;
    }) => {
      // Only add if it's for the current user
      if (data.userId === currentUser.id) {
        const mapped = mapBackendNotification(data);
        showNotificationToast(mapped);
        knownNotificationIdsRef.current.add(mapped.id);

        setNotifications((prev) => {
          if (prev.some((item) => item.id === mapped.id)) return prev;
          return [mapped, ...prev];
        });
        if (isPersistentNotificationId(mapped.id)) {
          setStickyReadNotifications((prev) => {
            if (prev[mapped.id]) return prev;
            return { ...prev, [mapped.id]: mapped };
          });
        }
      }
    };

    const handleNotificationRead = ({ id }: { id: string }) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    };

    const handleAllNotificationsRead = () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    };

    onEvent("notification:new", handleNotificationCreated);
    onEvent("notification:read", handleNotificationRead);
    onEvent("notification:all_read", handleAllNotificationsRead);

    const handleReconnect = () => {
      void loadNotifications();
    };
    socket.on("connect", handleReconnect);

    return () => {
      offEvent("notification:new", handleNotificationCreated);
      offEvent("notification:read", handleNotificationRead);
      offEvent("notification:all_read", handleAllNotificationsRead);
      socket.off("connect", handleReconnect);
    };
  }, [socket, currentUser?.id, onEvent, offEvent, loadNotifications]);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const addNotification = useCallback(
    (notif: Omit<Notification, "id" | "createdAt">) => {
      const newNotif: Notification = {
        ...notif,
        id: `n${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      showNotificationToast(newNotif);
      knownNotificationIdsRef.current.add(newNotif.id);
      setNotifications((prev) => [newNotif, ...prev]);
    },
    [],
  );

  const markRead = useCallback(
    (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );

      setStickyReadIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      setStickyReadNotifications((prev) => {
        if (!isPersistentNotificationId(id)) return prev;
        const existing = notifications.find(
          (notification) => notification.id === id,
        );
        if (existing) return { ...prev, [id]: { ...existing, read: true } };
        return prev;
      });

      if (!isPersistentNotificationId(id)) {
        return;
      }

      apiRequest(`/notifications/${id}/read`, { method: "POST" }).catch(
        console.error,
      );
    },
    [notifications],
  );

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setStickyReadIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((notification) => next.add(notification.id));
      return next;
    });
    setStickyReadNotifications((prev) => {
      const next = { ...prev };
      notifications
        .filter((notification) => isPersistentNotificationId(notification.id))
        .forEach((notification) => {
          next[notification.id] = { ...notification, read: true };
        });
      return next;
    });
    apiRequest("/notifications/read-all", { method: "PUT" }).catch(
      console.error,
    );
  }, [notifications]);

  const deleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setStickyReadIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setStickyReadNotifications((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (isPersistentNotificationId(id)) {
      apiRequest(`/notifications/${id}`, { method: "DELETE" }).catch(
        console.error,
      );
    }
  }, []);

  const clearAllRead = useCallback(() => {
    setNotifications((prev) => {
      const readPersistentIds = prev
        .filter((n) => n.read && isPersistentNotificationId(n.id))
        .map((n) => n.id);
      // Delete each persistent read notification from backend
      readPersistentIds.forEach((id) => {
        apiRequest(`/notifications/${id}`, { method: "DELETE" }).catch(
          console.error,
        );
      });
      return prev.filter((n) => !n.read || !isPersistentNotificationId(n.id));
    });
    setStickyReadIds((prev) => {
      const next = new Set(prev);
      notifications
        .filter((notification) => notification.read)
        .forEach((notification) => next.delete(notification.id));
      return next;
    });
    setStickyReadNotifications((prev) => {
      const next = { ...prev };
      notifications
        .filter(
          (notification) =>
            notification.read && isPersistentNotificationId(notification.id),
        )
        .forEach((notification) => {
          delete next[notification.id];
        });
      return next;
    });
  }, [notifications]);

  const notifyMentions = useCallback(
    (
      text: string,
      sourceTitle: string,
      actionUrl: string,
      authorId: string,
    ) => {
      const mentionedIds = extractMentionedUserIds(text);
      const recipients = [...new Set(mentionedIds)].filter(
        (userId) => userId && userId !== authorId,
      );

      if (recipients.length === 0) return;

      apiRequest("/notifications/mentions", {
        method: "POST",
        body: JSON.stringify({
          mentionedUserIds: recipients,
          sourceTitle,
          actionUrl,
        }),
      }).catch((error) => {
        console.error("Failed to create mention notifications:", error);
      });
    },
    [],
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        hasMoreNotifications,
        isLoadingNotifications,
        loadMoreNotifications,
        addNotification,
        markRead,
        markAllRead,
        deleteNotification,
        clearAllRead,
        notifyMentions,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context)
    throw new Error(
      "useNotifications must be used within NotificationProvider",
    );
  return context;
}
