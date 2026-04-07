import { MemoActivityEntry } from "@/types";
import { useUsers } from "@/context/UserContext";
import { getUserInitials } from "@/lib/user-utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import {
  Eye,
  CheckCircle2,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Heart,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const actionConfig: Record<
  string,
  { icon: typeof Eye; label: string; className: string }
> = {
  opened: { icon: Eye, label: "opened this memo", className: "text-info" },
  acknowledged: {
    icon: CheckCircle2,
    label: "acknowledged this memo",
    className: "text-warning",
  },
  unacknowledged: {
    icon: XCircle,
    label: "unacknowledged this memo",
    className: "text-muted-foreground",
  },
  approved: {
    icon: ThumbsUp,
    label: "approved this memo",
    className: "text-success",
  },
  unapproved: {
    icon: ThumbsDown,
    label: "unapproved this memo",
    className: "text-muted-foreground",
  },
  commented: {
    icon: MessageCircle,
    label: "commented on your memo",
    className: "text-primary",
  },
  replied: {
    icon: MessageCircle,
    label: "replied",
    className: "text-primary",
  },
  edited_comment: {
    icon: MessageCircle,
    label: "edited a comment",
    className: "text-info",
  },
  deleted_comment: {
    icon: XCircle,
    label: "deleted a comment",
    className: "text-primary",
  },
  reacted: {
    icon: Heart,
    label: "reacted to your memo",
    className: "text-destructive",
  },
  reactedComment: {
    icon: MessageCircle,
    label: "reacted to a comment",
    className: "text-primary",
  },
};

const getActivityConfig = (entry: MemoActivityEntry) => {
  if (
    entry.action === "reacted" &&
    typeof entry.detail === "string" &&
    entry.detail.includes("on a comment")
  ) {
    return actionConfig.reactedComment;
  }
  return actionConfig[entry.action] || actionConfig.opened;
};

const normalizeActivityDetail = (detail?: string) => {
  if (!detail) return "";

  if (detail.startsWith("with ") && detail.includes(" on a comment")) {
    const emoji = detail.replace("with ", "").replace(" on a comment", "");
    return `with ${emoji}`;
  }

  if (detail.startsWith("updated a reply")) {
    return detail.replace("updated a reply", "reply updated");
  }

  if (detail.startsWith("updated a comment")) {
    return "comment updated";
  }

  if (detail.startsWith("deleted a reply")) {
    return "reply deleted";
  }

  if (detail.startsWith("deleted a comment")) {
    return "comment deleted";
  }

  return detail;
};

const formatActivitySentence = (
  entry: MemoActivityEntry,
  userName: string,
  config: { label: string },
) => {
  const detail = normalizeActivityDetail(entry.detail);

  if (entry.action === "reacted") {
    if (detail) {
      return `${userName} reacted ${detail}`;
    }
    return `${userName} ${config.label}`;
  }

  if (entry.action === "replied" && detail) {
    return `${userName} replied ${detail}`;
  }

  if (
    (entry.action === "edited_comment" || entry.action === "deleted_comment") &&
    detail
  ) {
    return `${userName} ${detail}`;
  }

  return `${userName} ${config.label}`;
};

interface MemoActivityLogProps {
  activityLog: MemoActivityEntry[];
}

export function MemoActivityLog({ activityLog }: MemoActivityLogProps) {
  const [expanded, setExpanded] = useState(false);
  const { getUserById } = useUsers();

  const sortedLog = [...activityLog].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const displayItems = expanded ? sortedLog : sortedLog.slice(0, 4);
  const hasMore = sortedLog.length > 4;

  return (
    <div className="widget-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-display font-semibold">Activity History</h3>
        {activityLog.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
              >
                View all
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[360px] max-h-[420px] overflow-y-auto"
            >
              {sortedLog.map((entry) => {
                const user = getUserById(entry.userId);
                const config = getActivityConfig(entry);
                const Icon = config.icon;
                const userName = user?.name || "Unknown";
                const sentence = formatActivitySentence(
                  entry,
                  userName,
                  config,
                );
                return (
                  <DropdownMenuItem
                    key={`dropdown-${entry.id}`}
                    className="items-start py-2"
                  >
                    <div className="min-w-0 space-y-1">
                      <p
                        className={`text-xs inline-flex items-center gap-1 ${config.className}`}
                      >
                        <Icon className="h-3 w-3" />
                        <span className="font-medium text-foreground">
                          {sentence}
                        </span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(entry.timestamp), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="space-y-2.5">
        {displayItems.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">No activity yet.</p>
        ) : (
          displayItems.map((entry) => {
            const user = getUserById(entry.userId);
            const config = getActivityConfig(entry);
            const Icon = config.icon;
            const userName = user?.name || "Unknown";
            const sentence = formatActivitySentence(entry, userName, config);
            return (
              <div key={entry.id} className="flex items-start gap-2.5 text-sm">
                <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                  <AvatarFallback className="text-[8px] bg-secondary text-secondary-foreground font-bold">
                    {user ? getUserInitials(user.name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <span
                    className={`inline-flex items-center gap-1 text-xs ${config.className}`}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="font-medium text-foreground">
                      {sentence}
                    </span>
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(entry.timestamp), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full text-xs gap-1"
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronDown
            className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
          {expanded
            ? "Show less"
            : `Read more (${activityLog.length - 4} more)`}
        </Button>
      )}
    </div>
  );
}
