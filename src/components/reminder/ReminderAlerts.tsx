import { useReminders } from "@/context/ReminderContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";

export function ReminderAlerts() {
  const { firedReminders, dismissFired } = useReminders();

  if (firedReminders.length === 0) return null;

  const latest = firedReminders[firedReminders.length - 1];

  return (
    <Dialog open={true} onOpenChange={() => dismissFired(latest.id)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <div className="p-2 rounded-full bg-warning/10">
              <Bell className="h-5 w-5 text-warning animate-bounce" />
            </div>
            Reminder
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <h4 className="font-semibold text-lg">{latest.title}</h4>
          {latest.description && <p className="text-sm text-muted-foreground">{latest.description}</p>}
          {latest.groupId && <p className="text-xs text-primary">Group reminder</p>}
        </div>
        <DialogFooter>
          <Button onClick={() => dismissFired(latest.id)} className="gap-2">
            <X className="h-4 w-4" /> Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
