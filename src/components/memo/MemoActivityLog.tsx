import { MemoActivityEntry } from "@/types";
import { getUserById, getUserInitials } from "@/data/mock";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Eye, CheckCircle2, XCircle, ThumbsUp, ThumbsDown, MessageCircle, Heart, ChevronDown } from "lucide-react";
import { useState } from "react";

const actionConfig: Record<string, { icon: typeof Eye; label: string; className: string }> = {
  opened: { icon: Eye, label: "opened this memo", className: "text-info" },
  acknowledged: { icon: CheckCircle2, label: "acknowledged this memo", className: "text-warning" },
  unacknowledged: { icon: XCircle, label: "unacknowledged this memo", className: "text-muted-foreground" },
  approved: { icon: ThumbsUp, label: "approved this memo", className: "text-success" },
  unapproved: { icon: ThumbsDown, label: "unapproved this memo", className: "text-muted-foreground" },
  commented: { icon: MessageCircle, label: "commented on this memo", className: "text-primary" },
  reacted: { icon: Heart, label: "reacted to this memo", className: "text-destructive" },
};

interface MemoActivityLogProps {
  activityLog: MemoActivityEntry[];
}

export function MemoActivityLog({ activityLog }: MemoActivityLogProps) {
  const [expanded, setExpanded] = useState(false);

  if (activityLog.length === 0) return null;

  const displayItems = expanded ? activityLog : activityLog.slice(0, 4);
  const hasMore = activityLog.length > 4;

  return (
    <div className="widget-card">
      <h3 className="font-display font-semibold mb-3">Activity History</h3>
      <div className="space-y-2.5">
        {displayItems.map((entry) => {
          const user = getUserById(entry.userId);
          const config = actionConfig[entry.action] || actionConfig.opened;
          const Icon = config.icon;
          return (
            <div key={entry.id} className="flex items-start gap-2.5 text-sm">
              <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                <AvatarFallback className="text-[8px] bg-secondary text-secondary-foreground font-bold">
                  {user ? getUserInitials(user.name) : '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm">{user?.name || 'Unknown'}</span>{' '}
                <span className={`inline-flex items-center gap-1 text-xs ${config.className}`}>
                  <Icon className="h-3 w-3" />
                  {config.label}
                </span>
                {entry.detail && <span className="text-xs text-muted-foreground ml-1">— {entry.detail}</span>}
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <Button variant="ghost" size="sm" className="mt-2 w-full text-xs gap-1" onClick={() => setExpanded(!expanded)}>
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? 'Show less' : `Read more (${activityLog.length - 4} more)`}
        </Button>
      )}
    </div>
  );
}
