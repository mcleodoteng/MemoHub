import { AppLayout } from "@/components/layout/AppLayout";
import { useMemos } from "@/context/MemoContext";
import { useMessages } from "@/context/MessageContext";
import { MemoCard } from "@/components/memo/MemoCard";
import { useAuth } from "@/context/AuthContext";
import { useUsers } from "@/context/UserContext";
import { useNotifications } from "@/context/NotificationContext";
import {
  FileText,
  Bell,
  Users,
  MessageSquare,
  CheckCircle2,
  Clock,
  TrendingUp,
  Pin,
  Activity,
  FileEdit,
  ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Notification } from "@/types";
import { memoPath } from "@/lib/memo-url";

const toSentenceCase = (value: string) => {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const normalizeNotificationText = (notif: Notification) => {
  const title = (notif.title || "Notification").trim();
  const body = (notif.body || "").trim();
  const lowerTitle = title.toLowerCase();

  if (notif.type === "reaction_added") {
    const cleanBody = body
      .replace(/\s+/g, " ")
      .replace("reacted", "liked")
      .replace("New reaction", "")
      .trim();

    return {
      title: "Like",
      body: toSentenceCase(cleanBody || "Someone liked your memo."),
    };
  }

  if (notif.type === "comment_added") {
    const cleanTitle =
      lowerTitle === "new comment" || lowerTitle === "new reply"
        ? title.replace("New ", "")
        : title;
    return {
      title: toSentenceCase(cleanTitle),
      body: toSentenceCase(body || "A new comment was added."),
    };
  }

  return {
    title: toSentenceCase(title),
    body: toSentenceCase(body),
  };
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { getUserById } = useUsers();
  const { memos } = useMemos();
  const { conversations } = useMessages();
  const { notifications } = useNotifications();

  const sortByCreatedAtDesc = <T extends { createdAt: string }>(items: T[]) =>
    [...items].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const unreadMessages = conversations.filter(
    (c) => c.lastMessage && !c.lastMessage.readBy.includes(currentUser.id),
  ).length;
  const unreadGroupChats = conversations.filter(
    (c) =>
      c.type === "group" &&
      c.lastMessage &&
      !c.lastMessage.readBy.includes(currentUser.id) &&
      c.lastMessage.senderId !== currentUser.id,
  ).length;

  const draftMemos = sortByCreatedAtDesc(
    memos.filter((m) => m.status === "draft" && m.creatorId === currentUser.id),
  );

  const stats = [
    {
      label: "Memos Created",
      value: memos.filter(
        (m) => m.status !== "draft" && m.creatorId === currentUser.id,
      ).length,
      icon: FileText,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Unread Messages",
      value: unreadMessages,
      icon: MessageSquare,
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      label: "Unread Group Chats",
      value: unreadGroupChats,
      icon: Users,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      label: "Notifications",
      value: notifications.filter((n) => !n.read).length,
      icon: Bell,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      label: "Drafts",
      value: draftMemos.length,
      icon: FileEdit,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
  ];

  const pendingApprovals = sortByCreatedAtDesc(
    memos.filter((m) =>
      m.recipientStatuses.some(
        (s) => s.userId === currentUser.id && s.opened && !s.approved,
      ),
    ),
  );
  const pinnedMemos = sortByCreatedAtDesc(memos.filter((m) => m.pinned));

  // Activity feed from notifications
  const sortedActivity = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const recentActivity = sortedActivity.slice(0, 5);

  return (
    <AppLayout title="Dashboard">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold">
            Welcome back, {currentUser.name.split(" ")[0]} 👋
          </h2>
          <p className="text-muted-foreground mt-1">
            Here's what's happening today
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="widget-card">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="widget-card">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-warning" />
              <h3 className="font-display font-semibold">Pending Approvals</h3>
              <span className="ml-auto text-xs text-muted-foreground">
                {pendingApprovals.length}
              </span>
            </div>
            <div className="space-y-3">
              {pendingApprovals.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  All caught up! 🎉
                </p>
              ) : (
                pendingApprovals.slice(0, 3).map((memo) => {
                  const creator = getUserById(memo.creatorId);
                  return (
                    <div
                      key={memo.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
                      onClick={() => navigate(memoPath(memo))}
                    >
                      <CheckCircle2 className="h-4 w-4 text-warning shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {memo.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          from {creator?.name}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="widget-card">
            <div className="flex items-center gap-2 mb-4">
              <Pin className="h-4 w-4 text-primary" />
              <h3 className="font-display font-semibold">Pinned Memos</h3>
              <span className="ml-auto text-xs text-muted-foreground">
                {pinnedMemos.length}
              </span>
            </div>
            <div className="space-y-3">
              {pinnedMemos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No pinned memos
                </p>
              ) : (
                pinnedMemos.slice(0, 3).map((memo) => {
                  const creator = getUserById(memo.creatorId);
                  return (
                    <div
                      key={memo.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
                      onClick={() => navigate(memoPath(memo))}
                    >
                      <Pin className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {memo.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          by {creator?.name}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="widget-card">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-accent" />
              <h3 className="font-display font-semibold">Recent Activity</h3>
              {sortedActivity.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto h-7 px-2 text-[10px]"
                    >
                      All History
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-[340px] max-h-[420px] overflow-y-auto"
                  >
                    {sortedActivity.map((item) => {
                      const readable = normalizeNotificationText(item);
                      return (
                        <DropdownMenuItem
                          key={`history-${item.id}`}
                          className="items-start py-2"
                          onClick={() =>
                            item.actionUrl && navigate(item.actionUrl)
                          }
                        >
                          <div className="min-w-0 space-y-1">
                            <p className="text-xs font-medium truncate">
                              {readable.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {readable.body}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(item.createdAt), {
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
            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No activity yet
                </p>
              ) : (
                recentActivity.map((n) => {
                  const readable = normalizeNotificationText(n);
                  return (
                    <div
                      key={n.id}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
                      onClick={() => n.actionUrl && navigate(n.actionUrl)}
                    >
                      <div
                        className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${n.read ? "bg-muted-foreground/30" : "bg-primary"}`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">
                          {readable.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {readable.body}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Drafts */}
        {draftMemos.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <FileEdit className="h-4 w-4 text-warning" />
              <h3 className="font-display text-lg font-semibold">
                Your Drafts
              </h3>
            </div>
            <div className="space-y-3">
              {draftMemos.map((memo) => (
                <MemoCard key={memo.id} memo={memo} />
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-semibold">Recent Memos</h3>
          </div>
          <div className="space-y-3">
            {sortByCreatedAtDesc(memos.filter((m) => m.status !== "draft"))
              .slice(0, 4)
              .map((memo) => (
                <MemoCard key={memo.id} memo={memo} />
              ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
