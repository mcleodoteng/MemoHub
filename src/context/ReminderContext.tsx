import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { format } from "date-fns";
import { Bell, User, Users as UsersIcon } from "lucide-react";
import { Reminder } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { useUsers } from "@/context/UserContext";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ReminderContextType {
  reminders: Reminder[];
  addReminder: (data: {
    title: string;
    description?: string;
    dueAt: string;
    groupId?: string;
    creatorName?: string;
  }) => Promise<Reminder | null>;
  deleteReminder: (id: string) => Promise<void>;
  firedReminders: Reminder[];
  missedReminders: Reminder[];
  dismissFired: (id: string) => void;
  dismissMissed: (id: string) => void;
  refreshReminders: () => Promise<void>;
}

const ReminderContext = createContext<ReminderContextType | undefined>(
  undefined,
);

function playBeep(times = 3) {
  try {
    const ctx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
    const cycleMs = 700;

    for (let index = 0; index < times; index += 1) {
      const offset = index * cycleMs;

      const lowTone = ctx.createOscillator();
      const lowGain = ctx.createGain();
      lowTone.connect(lowGain);
      lowGain.connect(ctx.destination);
      lowTone.frequency.value = 880;
      lowTone.type = "sine";
      lowGain.gain.value = 0.3;
      lowTone.start(ctx.currentTime + offset / 1000);
      lowTone.stop(ctx.currentTime + (offset + 200) / 1000);

      const highTone = ctx.createOscillator();
      const highGain = ctx.createGain();
      highTone.connect(highGain);
      highGain.connect(ctx.destination);
      highTone.frequency.value = 1100;
      highTone.type = "sine";
      highGain.gain.value = 0.3;
      highTone.start(ctx.currentTime + (offset + 250) / 1000);
      highTone.stop(ctx.currentTime + (offset + 500) / 1000);
    }
  } catch {
    // Audio not supported.
  }
}

const sortReminders = (items: Reminder[]) =>
  [...items].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
  );

function sanitizeReminderText(value: unknown, fallback: string) {
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

export function ReminderProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, isAuthenticated } = useAuth();
  const { socket, onEvent, offEvent } = useSocket();
  const { getUserById } = useUsers();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [firedReminders, setFiredReminders] = useState<Reminder[]>([]);
  const [missedReminders, setMissedReminders] = useState<Reminder[]>([]);
  const [hasLoadedShownReminderIds, setHasLoadedShownReminderIds] =
    useState(false);
  const [loadedShownReminderKey, setLoadedShownReminderKey] = useState<
    string | null
  >(null);
  const activeFiredReminder = firedReminders[0];
  const shownReminderIdsRef = useRef<Set<string>>(new Set());
  const soundedReminderIdsRef = useRef<Set<string>>(new Set());
  const sessionStartedAtRef = useRef<number>(Date.now());

  const shownReminderStorageKey = currentUser?.id
    ? `memohub_shown_reminder_alerts_${currentUser.id}`
    : null;

  useEffect(() => {
    setHasLoadedShownReminderIds(false);
    setLoadedShownReminderKey(null);

    if (!shownReminderStorageKey) {
      shownReminderIdsRef.current = new Set();
      setHasLoadedShownReminderIds(true);
      setLoadedShownReminderKey(shownReminderStorageKey);
      return;
    }

    try {
      const raw = localStorage.getItem(shownReminderStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      shownReminderIdsRef.current = new Set(
        Array.isArray(parsed) ? parsed : [],
      );
    } catch {
      shownReminderIdsRef.current = new Set();
    } finally {
      setLoadedShownReminderKey(shownReminderStorageKey);
      setHasLoadedShownReminderIds(true);
    }
  }, [shownReminderStorageKey]);

  const isShownReminderStoreReady =
    hasLoadedShownReminderIds &&
    loadedShownReminderKey === shownReminderStorageKey;

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) {
      sessionStartedAtRef.current = Date.now();
      soundedReminderIdsRef.current = new Set();
      return;
    }

    // Track login/session boundary so "missed" reminders only represent items
    // that fired before the current session (i.e. while user was offline).
    sessionStartedAtRef.current = Date.now();
    soundedReminderIdsRef.current = new Set();
  }, [currentUser?.id, isAuthenticated]);

  const persistShownReminderIds = useCallback(
    (next: Set<string>) => {
      if (!shownReminderStorageKey) return;
      try {
        localStorage.setItem(
          shownReminderStorageKey,
          JSON.stringify(Array.from(next)),
        );
      } catch {
        // Ignore storage failures.
      }
    },
    [shownReminderStorageKey],
  );

  const mapReminder = useCallback((raw: any): Reminder => {
    const visibility: Reminder["visibility"] = raw.group
      ? raw.group.type === "department"
        ? "public"
        : "group"
      : "personal";

    return {
      id: raw.id,
      title: sanitizeReminderText(raw.title, "Encrypted reminder"),
      description: sanitizeReminderText(raw.description, "") || undefined,
      userId: raw.userId,
      creatorName: raw.creatorName || raw.user?.name,
      groupId: raw.groupId || undefined,
      groupName: raw.group?.name,
      groupType: raw.group?.type,
      visibility,
      dueAt: raw.dueAt,
      fired: Boolean(raw.fired),
      firedAt: raw.firedAt || undefined,
      createdAt: raw.createdAt,
    };
  }, []);

  const upsertReminder = useCallback((reminder: Reminder) => {
    setReminders((prev) =>
      sortReminders([
        ...prev.filter((existing) => existing.id !== reminder.id),
        reminder,
      ]),
    );
  }, []);

  const notifyForDueReminders = useCallback(
    (items: Reminder[]) => {
      if (!isShownReminderStoreReady) {
        return;
      }

      const now = Date.now();
      const sessionStartedAt = sessionStartedAtRef.current;

      const newlyShown = items.filter(
        (reminder) => !shownReminderIdsRef.current.has(reminder.id),
      );

      if (newlyShown.length === 0) {
        return;
      }

      const nextShown = new Set(shownReminderIdsRef.current);
      newlyShown.forEach((reminder) => nextShown.add(reminder.id));
      shownReminderIdsRef.current = nextShown;
      persistShownReminderIds(nextShown);

      // Separate fired (recent) from missed (past) reminders
      const firedNow: Reminder[] = [];
      const missedNow: Reminder[] = [];

      newlyShown.forEach((reminder) => {
        const firedTime = new Date(
          reminder.firedAt || reminder.dueAt,
        ).getTime();

        // Only mark as "missed" when the reminder fired before this session,
        // which means the user was offline when it happened.
        if (firedTime < sessionStartedAt && firedTime <= now) {
          missedNow.push(reminder);
          return;
        }

        firedNow.push(reminder);
      });

      // Handle fired reminders (with sound)
      if (firedNow.length > 0) {
        setFiredReminders((prev) => {
          const existingIds = new Set(prev.map((reminder) => reminder.id));
          return [
            ...prev,
            ...firedNow.filter((item) => !existingIds.has(item.id)),
          ];
        });

        firedNow.forEach((reminder) => {
          // Only play sound if we haven't already for this reminder
          if (!soundedReminderIdsRef.current.has(reminder.id)) {
            soundedReminderIdsRef.current.add(reminder.id);

            const creatorName =
              reminder.creatorName ||
              getUserById(reminder.userId)?.name ||
              "Someone";
            const body = `${creatorName} scheduled \"${reminder.title}\"${reminder.description ? `: ${reminder.description}` : ""}`;

            playBeep(3);
            toast("Reminder Due", {
              description: body,
              duration: 5000,
            });

            if (
              typeof Notification !== "undefined" &&
              Notification.permission === "granted"
            ) {
              new Notification("Reminder Due", {
                body,
                icon: "/favicon.ico",
              });
            }
          }
        });
      }

      // Handle missed reminders (no sound)
      if (missedNow.length > 0) {
        setMissedReminders((prev) => {
          const existingIds = new Set(prev.map((reminder) => reminder.id));
          return [
            ...prev,
            ...missedNow.filter((item) => !existingIds.has(item.id)),
          ];
        });

        missedNow.forEach((reminder) => {
          const body = `You missed \"${reminder.title}\" while offline. See Past reminders for details.`;

          // Keep missed reminder alerts subtle and brief.
          toast("Past Reminder", {
            description: body,
            duration: 3500,
          });
        });
      }
    },
    [getUserById, isShownReminderStoreReady, persistShownReminderIds],
  );

  const refreshReminders = useCallback(async () => {
    if (!isAuthenticated || !currentUser?.id) {
      setReminders([]);
      setFiredReminders([]);
      setMissedReminders([]);
      return;
    }

    if (!isShownReminderStoreReady) {
      return;
    }

    try {
      const res = await apiRequest<{ reminders: any[] }>("/reminders");
      const mapped = sortReminders((res.data.reminders || []).map(mapReminder));
      setReminders(mapped);
      notifyForDueReminders(mapped.filter((reminder) => reminder.fired));
    } catch (error) {
      console.error("Failed to load reminders:", error);
    }
  }, [
    currentUser?.id,
    isShownReminderStoreReady,
    isAuthenticated,
    mapReminder,
    notifyForDueReminders,
    shownReminderStorageKey,
  ]);

  useEffect(() => {
    void refreshReminders();
  }, [refreshReminders]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;

    const interval = window.setInterval(() => {
      void refreshReminders();
    }, 15000);

    const handleFocus = () => {
      void refreshReminders();
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        void refreshReminders();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [currentUser?.id, isAuthenticated, refreshReminders]);

  useEffect(() => {
    if (!socket || !isAuthenticated || !currentUser?.id) return;

    const handleReconnect = () => {
      void refreshReminders();
    };

    const handleReminderCreated = (data: { reminder: any }) => {
      const reminder = mapReminder(data.reminder);
      upsertReminder(reminder);
      if (reminder.fired) {
        notifyForDueReminders([reminder]);
      }
    };

    const handleReminderDeleted = (data: { reminderId: string }) => {
      setReminders((prev) =>
        prev.filter((reminder) => reminder.id !== data.reminderId),
      );
      setFiredReminders((prev) =>
        prev.filter((reminder) => reminder.id !== data.reminderId),
      );
      setMissedReminders((prev) =>
        prev.filter((reminder) => reminder.id !== data.reminderId),
      );
    };

    const handleReminderFired = (data: { reminder: any }) => {
      const reminder = {
        ...mapReminder(data.reminder),
        fired: true,
        firedAt: data.reminder.firedAt || new Date().toISOString(),
      };
      upsertReminder(reminder);
      notifyForDueReminders([reminder]);
    };

    socket.on("connect", handleReconnect);
    onEvent("reminder:created", handleReminderCreated);
    onEvent("reminder:deleted", handleReminderDeleted);
    onEvent("reminder:fired", handleReminderFired);

    return () => {
      socket.off("connect", handleReconnect);
      offEvent("reminder:created", handleReminderCreated);
      offEvent("reminder:deleted", handleReminderDeleted);
      offEvent("reminder:fired", handleReminderFired);
    };
  }, [
    socket,
    currentUser?.id,
    isAuthenticated,
    refreshReminders,
    mapReminder,
    notifyForDueReminders,
    offEvent,
    onEvent,
    upsertReminder,
  ]);

  useEffect(() => {
    if (!reminders.length) return;

    const interval = window.setInterval(() => {
      const now = Date.now();
      const newlyDue: Reminder[] = [];

      setReminders((prev) =>
        prev.map((reminder) => {
          if (reminder.fired) return reminder;
          if (new Date(reminder.dueAt).getTime() > now) return reminder;

          const updated = {
            ...reminder,
            fired: true,
            firedAt: new Date(now).toISOString(),
          };
          newlyDue.push(updated);
          return updated;
        }),
      );

      if (newlyDue.length > 0) {
        notifyForDueReminders(newlyDue);
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [notifyForDueReminders, reminders.length]);

  const addReminder = useCallback(
    async (data: {
      title: string;
      description?: string;
      dueAt: string;
      groupId?: string;
      creatorName?: string;
    }) => {
      if (!currentUser?.id) {
        return null;
      }

      const res = await apiRequest<{ reminder: any }>("/reminders", {
        method: "POST",
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          dueAt: data.dueAt,
          groupId: data.groupId,
        }),
      });

      const saved = mapReminder(res.data.reminder);
      upsertReminder(saved);

      return saved;
    },
    [currentUser?.id, mapReminder, upsertReminder],
  );

  const deleteReminder = useCallback(
    async (id: string) => {
      await apiRequest(`/reminders/${id}`, { method: "DELETE" });
      setReminders((prev) => prev.filter((reminder) => reminder.id !== id));
      setFiredReminders((prev) =>
        prev.filter((reminder) => reminder.id !== id),
      );
      setMissedReminders((prev) =>
        prev.filter((reminder) => reminder.id !== id),
      );

      if (shownReminderIdsRef.current.has(id)) {
        const nextShown = new Set(shownReminderIdsRef.current);
        nextShown.delete(id);
        shownReminderIdsRef.current = nextShown;
        persistShownReminderIds(nextShown);
      }
    },
    [persistShownReminderIds],
  );

  const dismissFired = useCallback((id: string) => {
    setFiredReminders((prev) => prev.filter((reminder) => reminder.id !== id));
  }, []);

  const dismissMissed = useCallback((id: string) => {
    setMissedReminders((prev) => prev.filter((reminder) => reminder.id !== id));
  }, []);

  return (
    <ReminderContext.Provider
      value={{
        reminders,
        addReminder,
        deleteReminder,
        firedReminders,
        missedReminders,
        dismissFired,
        dismissMissed,
        refreshReminders,
      }}
    >
      {children}

      <AlertDialog
        open={Boolean(activeFiredReminder)}
        onOpenChange={(open) => {
          if (!open && activeFiredReminder) {
            dismissFired(activeFiredReminder.id);
          }
        }}
      >
        <AlertDialogContent className="max-w-md overflow-hidden">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="rounded-full bg-warning/10 p-2">
                <Bell className="h-5 w-5 animate-bounce text-warning" />
              </div>
              Reminder Due
            </AlertDialogTitle>
          </AlertDialogHeader>
          {activeFiredReminder && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2">
                {activeFiredReminder.visibility === "group" ||
                activeFiredReminder.visibility === "public" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-medium text-accent">
                    <UsersIcon className="h-3 w-3" />
                    {activeFiredReminder.visibility === "public"
                      ? "Public Reminder"
                      : "Group Reminder"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    <User className="h-3 w-3" /> Personal Reminder
                  </span>
                )}
              </div>

              {(activeFiredReminder.creatorName ||
                getUserById(activeFiredReminder.userId)?.name) && (
                <p className="text-xs text-muted-foreground">
                  Created by{" "}
                  <span className="font-medium text-foreground">
                    {activeFiredReminder.creatorName ||
                      getUserById(activeFiredReminder.userId)?.name}
                  </span>
                </p>
              )}

              <h4 className="break-words text-base font-semibold leading-tight">
                {activeFiredReminder.title}
              </h4>

              {activeFiredReminder.description && (
                <p className="break-words text-sm text-muted-foreground">
                  {activeFiredReminder.description}
                </p>
              )}

              {activeFiredReminder.groupName && (
                <p className="text-xs text-muted-foreground">
                  Group: {activeFiredReminder.groupName}
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Due{" "}
                {format(
                  new Date(activeFiredReminder.dueAt),
                  "MMM d, yyyy h:mm a",
                )}
              </p>
            </div>
          )}
          <AlertDialogFooter className="gap-2 sm:justify-end">
            <AlertDialogAction
              onClick={() => {
                if (!activeFiredReminder) return;
                dismissFired(activeFiredReminder.id);
              }}
            >
              Dismiss
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ReminderContext.Provider>
  );
}

export function useReminders() {
  const context = useContext(ReminderContext);
  if (!context) {
    throw new Error("useReminders must be used within ReminderProvider");
  }
  return context;
}
