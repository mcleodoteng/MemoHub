import { AppLayout } from "@/components/layout/AppLayout";
import { notifications } from "@/data/mock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  MessageCircle,
  Heart,
  Mail,
  AtSign,
  Users,
  CheckCircle2,
  CheckCheck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

const typeIcons: Record<string, typeof FileText> = {
  memo_received: Mail,
  memo_approved: CheckCircle2,
  comment_added: MessageCircle,
  reaction_added: Heart,
  message_received: MessageCircle,
  mention: AtSign,
  group_invite: Users,
};

const typeColors: Record<string, string> = {
  memo_received: "bg-info/10 text-info",
  memo_approved: "bg-success/10 text-success",
  comment_added: "bg-primary/10 text-primary",
  reaction_added: "bg-destructive/10 text-destructive",
  message_received: "bg-accent/10 text-accent",
  mention: "bg-warning/10 text-warning",
  group_invite: "bg-primary/10 text-primary",
};

const Notifications = () => {
  const navigate = useNavigate();
  const unread = notifications.filter((n) => !n.read);
  const read = notifications.filter((n) => n.read);

  const NotifItem = ({ notif }: { notif: typeof notifications[0] }) => {
    const Icon = typeIcons[notif.type] || FileText;
    return (
      <div
        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
          notif.read ? "opacity-70 hover:bg-secondary/50" : "bg-secondary/30 hover:bg-secondary/60"
        }`}
        onClick={() => notif.actionUrl && navigate(notif.actionUrl)}
      >
        <div className={`p-2 rounded-lg shrink-0 ${typeColors[notif.type] || "bg-muted"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${notif.read ? "" : "font-semibold"}`}>{notif.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{notif.body}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
          </p>
        </div>
        {!notif.read && <span className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />}
      </div>
    );
  };

  return (
    <AppLayout title="Notifications">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {unread.length} unread notifications
          </p>
          <Button variant="outline" size="sm" className="gap-2">
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        </div>

        {unread.length > 0 && (
          <div>
            <h3 className="font-display font-semibold text-sm mb-2">New</h3>
            <div className="space-y-1">
              {unread.map((n) => <NotifItem key={n.id} notif={n} />)}
            </div>
          </div>
        )}

        {read.length > 0 && (
          <div>
            <h3 className="font-display font-semibold text-sm mb-2 text-muted-foreground">Earlier</h3>
            <div className="space-y-1">
              {read.map((n) => <NotifItem key={n.id} notif={n} />)}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Notifications;
