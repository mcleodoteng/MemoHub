import { AppLayout } from "@/components/layout/AppLayout";
import { useReminders } from "@/context/ReminderContext";
import { useGroups } from "@/context/GroupContext";
import { useAuth } from "@/context/AuthContext";
import { useUsers } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Bell, Plus, Trash2, Clock, Users, User, Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

const Reminders = () => {
  const { currentUser } = useAuth();
  const { getUserById } = useUsers();
  const { reminders, addReminder, deleteReminder } = useReminders();
  const { groups } = useGroups();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [groupId, setGroupId] = useState<string>("none");
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "all">(
    "upcoming",
  );
  const [now, setNow] = useState(() => Date.now());
  const [reminderToDelete, setReminderToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const myGroups = groups.filter((g) => g.memberIds.includes(currentUser.id));
  const myReminders = reminders;
  const upcoming = myReminders
    .filter((r) => !r.fired)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const past = myReminders
    .filter((r) => r.fired)
    .sort((a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime());

  const allSorted = [...myReminders].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (dueAtIso: string) => {
    const diffMs = Math.max(0, new Date(dueAtIso).getTime() - now);
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  };

  const getReminderMeta = (reminder: (typeof myReminders)[number]) => {
    const group = reminder.groupId
      ? groups.find((g) => g.id === reminder.groupId)
      : null;
    const reminderType: "personal" | "group" | "public" =
      reminder.visibility ||
      (reminder.groupType === "department"
        ? "public"
        : reminder.groupId
          ? "group"
          : "personal");

    const creatorName =
      reminder.creatorName ||
      getUserById(reminder.userId)?.name ||
      (reminder.userId === currentUser.id ? "You" : "Unknown user");

    return { group, reminderType, creatorName };
  };

  const renderReminderCard = (
    reminder: (typeof myReminders)[number],
    opts?: { compact?: boolean; muted?: boolean },
  ) => {
    const { group, reminderType, creatorName } = getReminderMeta(reminder);
    const compact = Boolean(opts?.compact);
    const muted = Boolean(opts?.muted);

    const TypeIcon =
      reminderType === "public"
        ? Globe
        : reminderType === "group"
          ? Users
          : User;

    const typeLabel =
      reminderType === "public"
        ? "Public Reminder"
        : reminderType === "group"
          ? "Group Reminder"
          : "Personal Reminder";

    return (
      <div
        key={reminder.id}
        className={`flex items-start gap-3 rounded-xl border bg-card p-3 transition-colors ${
          muted ? "opacity-60" : "hover:bg-secondary/30"
        }`}
      >
        <div
          className={`rounded-lg p-2 ${muted ? "bg-muted" : "bg-warning/10"}`}
        >
          <Bell
            className={`h-4 w-4 ${muted ? "text-muted-foreground" : "text-warning"}`}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                reminderType === "public"
                  ? "bg-primary/10 text-primary"
                  : reminderType === "group"
                    ? "bg-accent/20 text-accent"
                    : "bg-secondary text-secondary-foreground"
              }`}
            >
              <TypeIcon className="h-3 w-3" /> {typeLabel}
            </span>
            {group && (
              <span className="text-[11px] text-accent flex items-center gap-1">
                <Users className="h-3 w-3" /> {group.name}
              </span>
            )}
          </div>

          <div>
            <p className="break-words text-sm font-semibold leading-tight">
              {reminder.title}
            </p>
            {reminder.description && (
              <p className="mt-1 break-words text-xs text-muted-foreground">
                {reminder.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" /> Created by {creatorName}
            </span>
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(reminder.dueAt), "MMM d, yyyy h:mm a")}
            </span>
            {!reminder.fired && !compact && (
              <span className="text-primary font-medium">
                ⏳ {formatCountdown(reminder.dueAt)}
              </span>
            )}
            {!reminder.fired && (
              <span className="text-primary">
                {formatDistanceToNow(new Date(reminder.dueAt), {
                  addSuffix: true,
                })}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 ${muted ? "" : "text-destructive"}`}
          onClick={() =>
            setReminderToDelete({ id: reminder.id, title: reminder.title })
          }
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };

  const handleCreate = async () => {
    if (!title.trim() || !dueAt) {
      toast.error("Title and date are required");
      return;
    }

    try {
      await addReminder({
        title,
        description: description || undefined,
        dueAt: new Date(dueAt).toISOString(),
        groupId: groupId !== "none" ? groupId : undefined,
        creatorName: currentUser.name,
      });

      setTitle("");
      setDescription("");
      setDueAt("");
      setGroupId("none");
      setDialogOpen(false);
      toast.success("Reminder created");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create reminder";
      toast.error(message);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display">Reminders</h1>
            <p className="text-sm text-muted-foreground">
              Manage your personal and group reminders
            </p>
          </div>
          <Button className="gap-1.5" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New Reminder
          </Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as "upcoming" | "past" | "all")
          }
        >
          <TabsList>
            <TabsTrigger value="upcoming">
              Upcoming ({upcoming.length})
            </TabsTrigger>
            <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
            <TabsTrigger value="all">All ({allSorted.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-4">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No upcoming reminders
              </p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((r) => renderReminderCard(r))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-4">
            {past.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No past reminders
              </p>
            ) : (
              <div className="space-y-2">
                {past.map((r) =>
                  renderReminderCard(r, { compact: true, muted: true }),
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            {allSorted.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No reminders yet
              </p>
            ) : (
              <div className="space-y-2">
                {allSorted.map((r) =>
                  renderReminderCard(r, { compact: r.fired, muted: r.fired }),
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">New Reminder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Title *</label>
              <Input
                placeholder="Reminder title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Description
              </label>
              <Input
                placeholder="Optional details"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Due Date & Time *
              </label>
              <Input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Group (optional)
              </label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Personal reminder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Personal</SelectItem>
                  {myGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} className="gap-1.5">
              <Bell className="h-3.5 w-3.5" /> Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(reminderToDelete)}
        onOpenChange={(open) => {
          if (!open) setReminderToDelete(null);
        }}
      >
        <AlertDialogContent className="max-w-md overflow-hidden">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this reminder?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              {reminderToDelete
                ? `Are you sure you want to delete "${reminderToDelete.title}"?`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!reminderToDelete) return;
                deleteReminder(reminderToDelete.id);
                setReminderToDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Reminders;
