import { useMemos } from "@/context/MemoContext";
import { useAuth } from "@/context/AuthContext";
import { useUsers } from "@/context/UserContext";
import { useOnlineStatuses } from "@/hooks/useOnlineStatus";
import { getUserInitials } from "@/lib/user-utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Eye,
  CheckCircle2,
  ThumbsUp,
  MessageCircle,
  Smile,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const quickEmojis = ["👍", "❤️", "🎉", "🚀", "👏", "😊", "🔥", "💯"];

interface MemoActionsProps {
  memoId: string;
}

export function MemoActions({ memoId }: MemoActionsProps) {
  const { currentUser } = useAuth();
  const { getUserById } = useUsers();
  const { getMemoById, acknowledgeMemo, approveMemo, addReaction } = useMemos();
  const memo = getMemoById(memoId);

  if (!memo) return null;

  const myStatus = memo.recipientStatuses.find(
    (s) => s.userId === currentUser?.id,
  );
  const isCreator = memo.creatorId === currentUser.id;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Only recipients can acknowledge/approve */}
      {myStatus && !isCreator && (
        <>
          <Button
            variant={myStatus.acknowledged ? "secondary" : "outline"}
            size="sm"
            className="gap-1.5 h-8 text-xs"
            disabled={myStatus.acknowledged}
            onClick={() => {
              acknowledgeMemo(memoId, currentUser.id);
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {myStatus.acknowledged ? "Acknowledged" : "Acknowledge"}
          </Button>

          <Button
            variant={myStatus.approved ? "secondary" : "outline"}
            size="sm"
            className="gap-1.5 h-8 text-xs"
            disabled={myStatus.approved}
            onClick={() => {
              approveMemo(memoId, currentUser.id);
            }}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            {myStatus.approved ? "Approved" : "Approve"}
          </Button>
        </>
      )}

      {/* Emoji Reactions */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Smile className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex gap-1">
            {quickEmojis.map((emoji) => (
              <button
                key={emoji}
                className="h-8 w-8 flex items-center justify-center rounded hover:bg-secondary transition-colors text-lg"
                onClick={() => {
                  addReaction(memoId, emoji, currentUser.id);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Status tracker with progress
interface StatusTrackerProps {
  memoId: string;
}

export function StatusTracker({ memoId }: StatusTrackerProps) {
  const { getMemoById } = useMemos();
  const { getUserById } = useUsers();
  const { getUserStatus } = useOnlineStatuses();
  const memo = getMemoById(memoId);

  if (!memo) return null;

  const total = memo.recipientStatuses.length;
  if (total === 0) return null;

  const opened = memo.recipientStatuses.filter((s) => s.opened).length;
  const ack = memo.recipientStatuses.filter((s) => s.acknowledged).length;
  const approved = memo.recipientStatuses.filter((s) => s.approved).length;
  const replied = memo.recipientStatuses.filter((s) => s.replied).length;

  const ProgressBar = ({
    value,
    max,
    className,
  }: {
    value: number;
    max: number;
    className: string;
  }) => (
    <div className="h-1.5 flex-1 rounded-full bg-secondary">
      <div
        className={`h-full rounded-full transition-all duration-500 ${className}`}
        style={{ width: `${(value / max) * 100}%` }}
      />
    </div>
  );

  return (
    <div className="widget-card">
      <h3 className="font-display font-semibold mb-4">Recipient Status</h3>

      {/* Summary bars */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Eye className="h-3 w-3" /> Opened
            </span>
            <span className="font-medium">
              {opened}/{total}
            </span>
          </div>
          <ProgressBar value={opened} max={total} className="bg-info" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" /> Ack'd
            </span>
            <span className="font-medium">
              {ack}/{total}
            </span>
          </div>
          <ProgressBar value={ack} max={total} className="bg-warning" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <ThumbsUp className="h-3 w-3" /> Approved
            </span>
            <span className="font-medium">
              {approved}/{total}
            </span>
          </div>
          <ProgressBar value={approved} max={total} className="bg-success" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <MessageCircle className="h-3 w-3" /> Replied
            </span>
            <span className="font-medium">
              {replied}/{total}
            </span>
          </div>
          <ProgressBar value={replied} max={total} className="bg-primary" />
        </div>
      </div>

      {/* Per-user status */}
      <div className="space-y-2.5">
        {memo.recipientStatuses.map((status) => {
          const user = getUserById(status.userId);
          const userStatus = getUserStatus(status.userId);
          return (
            <div key={status.userId} className="flex items-center gap-3">
              <div className="relative shrink-0">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                    {user ? getUserInitials(user.name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-card ${userStatus === "online" ? "bg-success" : userStatus === "away" ? "bg-warning" : "bg-muted-foreground/40"}`}
                />
              </div>
              <span className="text-sm font-medium min-w-[110px]">
                {user?.name}
              </span>
              <div className="flex gap-1.5 flex-wrap">
                <span
                  className={
                    status.opened
                      ? "status-badge-opened"
                      : "status-badge opacity-30"
                  }
                >
                  <Eye className="h-3 w-3" /> Opened
                </span>
                <span
                  className={
                    status.acknowledged
                      ? "status-badge-acknowledged"
                      : "status-badge opacity-30"
                  }
                >
                  <CheckCircle2 className="h-3 w-3" /> Acknowledged
                </span>
                <span
                  className={
                    status.approved
                      ? "status-badge-approved"
                      : "status-badge opacity-30"
                  }
                >
                  <ThumbsUp className="h-3 w-3" /> Approved
                </span>
                <span
                  className={
                    status.replied
                      ? "status-badge-replied"
                      : "status-badge opacity-30"
                  }
                >
                  <MessageCircle className="h-3 w-3" /> Replied
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
