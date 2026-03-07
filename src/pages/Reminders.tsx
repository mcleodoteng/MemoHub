import { AppLayout } from "@/components/layout/AppLayout";
import { useReminders } from "@/context/ReminderContext";
import { useGroups } from "@/context/GroupContext";
import { currentUser } from "@/data/mock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Bell, Plus, Trash2, Clock, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

const Reminders = () => {
  const { reminders, addReminder, deleteReminder } = useReminders();
  const { groups } = useGroups();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [groupId, setGroupId] = useState<string>("");

  const myGroups = groups.filter(g => g.memberIds.includes(currentUser.id));
  const myReminders = reminders.filter(r => r.userId === currentUser.id || (r.groupId && myGroups.some(g => g.id === r.groupId)));
  const upcoming = myReminders.filter(r => !r.fired).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const past = myReminders.filter(r => r.fired).sort((a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime());

  const handleCreate = () => {
    if (!title.trim() || !dueAt) { toast.error("Title and date are required"); return; }
    addReminder({ title, description: description || undefined, dueAt: new Date(dueAt).toISOString(), groupId: groupId || undefined });
    toast.success("Reminder created!");
    setDialogOpen(false);
    setTitle(""); setDescription(""); setDueAt(""); setGroupId("");
  };

  return (
    <AppLayout title="Reminders">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{upcoming.length} upcoming reminder{upcoming.length !== 1 ? 's' : ''}</p>
          <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New Reminder
          </Button>
        </div>

        {upcoming.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-display font-semibold text-sm">Upcoming</h3>
            {upcoming.map(r => {
              const grp = r.groupId ? groups.find(g => g.id === r.groupId) : null;
              return (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-secondary/30 transition-colors">
                  <div className="p-2 rounded-lg bg-warning/10">
                    <Bell className="h-4 w-4 text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.title}</p>
                    {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {format(new Date(r.dueAt), 'MMM d, yyyy h:mm a')}
                      </span>
                      <span className="text-[11px] text-primary">
                        {formatDistanceToNow(new Date(r.dueAt), { addSuffix: true })}
                      </span>
                      {grp && (
                        <span className="text-[11px] text-accent flex items-center gap-1">
                          <Users className="h-3 w-3" /> {grp.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteReminder(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {past.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-display font-semibold text-sm text-muted-foreground">Past</h3>
            {past.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card opacity-60">
                <div className="p-2 rounded-lg bg-muted">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.title}</p>
                  <span className="text-[11px] text-muted-foreground">{format(new Date(r.dueAt), 'MMM d, yyyy h:mm a')}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteReminder(r.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {myReminders.length === 0 && (
          <div className="text-center py-16">
            <Bell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No reminders yet</p>
            <Button size="sm" className="mt-3 gap-1.5" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Create Reminder
            </Button>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">New Reminder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Title *</label>
              <Input placeholder="Reminder title" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Input placeholder="Optional details" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Due Date & Time *</label>
              <Input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Group (optional)</label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger><SelectValue placeholder="Personal reminder" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Personal</SelectItem>
                  {myGroups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} className="gap-1.5"><Bell className="h-3.5 w-3.5" /> Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Reminders;
