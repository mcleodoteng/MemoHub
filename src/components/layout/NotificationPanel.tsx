import { useEffect, useMemo, useRef, useState } from "react";
import { useNotifications } from "@/context/NotificationContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  Trash2,
  ChevronRight,
} from "lucide-react";
import { Notification, NotificationType } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type NotificationCategory = "all" | "mentions" | "workflow" | "messages";

const categoryLabels: Record<NotificationCategory, string> = {
  all: "All",
  mentions: "Mentions",
  workflow: "Workflow",
  messages: "Messages",
};

function matchesCategory(
  notification: Notification,
  category: NotificationCategory,
): boolean {
  if (category === "all") return true;

  if (category === "mentions") {
    return notification.type === "mention";
  }

  if (category === "workflow") {
    return (
      notification.type === "workflow_pending_approval" ||
      notification.type === "memo_approved" ||
      notification.type === "memo_rejected"
    );
  }

  return (
    notification.type === "message_received" ||
    notification.type === "comment_added"
  );
}

const notificationIcons: Record<NotificationType, React.ReactNode> = {
  memo_received: <MessageSquare className="h-4 w-4 text-blue-400" />,
  memo_approved: <CheckCircle className="h-4 w-4 text-green-400" />,
  memo_rejected: <XCircle className="h-4 w-4 text-red-400" />,
  comment_added: <MessageSquare className="h-4 w-4 text-cyan-400" />,
  reaction_added: <Heart className="h-4 w-4 text-pink-400" />,
  message_received: <MessageSquare className="h-4 w-4 text-purple-400" />,
  mention: <Users className="h-4 w-4 text-yellow-400" />,
  group_invite: <Users className="h-4 w-4 text-indigo-400" />,
  group_activity: <Users className="h-4 w-4 text-indigo-400" />,
  reminder: <Clock className="h-4 w-4 text-orange-400" />,
  starred_activity: <Star className="h-4 w-4 text-amber-400" />,
  workflow_pending_approval: <Zap className="h-4 w-4 text-amber-400" />,
};

interface NotificationPanelProps {
  unreadCount: number;
}

export function NotificationPanel({ unreadCount }: NotificationPanelProps) {
  const {
    notifications,
    hasMoreNotifications,
    isLoadingNotifications,
    loadMoreNotifications,
    markRead,
    markAllRead,
    deleteNotification,
    clearAllRead,
  } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] =
    useState<NotificationCategory>("all");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markRead(notification.id);
    }
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
      setOpen(false);
    }
  };

  const categoryCounts = useMemo(() => {
    return {
      all: notifications.length,
      mentions: notifications.filter((n) => matchesCategory(n, "mentions"))
        .length,
      workflow: notifications.filter((n) => matchesCategory(n, "workflow"))
        .length,
      messages: notifications.filter((n) => matchesCategory(n, "messages"))
        .length,
    } satisfies Record<NotificationCategory, number>;
  }, [notifications]);

  const filteredNotifications = useMemo(
    () => notifications.filter((n) => matchesCategory(n, activeCategory)),
    [notifications, activeCategory],
  );

  const unreadNotifications = useMemo(
    () => filteredNotifications.filter((n) => !n.read),
    [filteredNotifications],
  );

  const readNotifications = useMemo(
    () => filteredNotifications.filter((n) => n.read),
    [filteredNotifications],
  );

  const hasMore = hasMoreNotifications;

  useEffect(() => {
    if (
      open &&
      filteredNotifications.length === 0 &&
      notifications.length > 0 &&
      hasMoreNotifications &&
      !isLoadingNotifications
    ) {
      void loadMoreNotifications();
    }
  }, [
    open,
    filteredNotifications.length,
    notifications.length,
    hasMoreNotifications,
    isLoadingNotifications,
    loadMoreNotifications,
  ]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !open || !hasMore || isLoadingNotifications) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreNotifications();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, open, isLoadingNotifications, loadMoreNotifications]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[420px] p-0 rounded-xl border border-white/20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
        align="end"
        sideOffset={12}
      >
        <div className="flex flex-col h-[500px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sticky top-0 z-10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Notifications
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
            <div className="flex gap-2">
              {filteredNotifications.length > 0 && (
                <>
                  {filteredNotifications.some((n) => !n.read) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] text-slate-400 hover:text-slate-200"
                      onClick={markAllRead}
                      title="Mark all as read"
                    >
                      Mark all read
                    </Button>
                  )}
                  {filteredNotifications.some((n) => n.read) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] text-slate-400 hover:text-slate-200"
                      onClick={clearAllRead}
                      title="Clear read notifications"
                    >
                      Clear read
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="border-b border-white/10 px-4 py-2.5 bg-slate-900/70">
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              {(Object.keys(categoryLabels) as NotificationCategory[]).map(
                (category) => (
                  <Button
                    key={category}
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveCategory(category)}
                    className={cn(
                      "h-7 rounded-full px-3 text-[11px] whitespace-nowrap border transition-all",
                      activeCategory === category
                        ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-100"
                        : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                    )}
                  >
                    {categoryLabels[category]}
                    <span className="ml-1.5 rounded-full bg-black/30 px-1.5 py-0.5 text-[10px] leading-none">
                      {categoryCounts[category]}
                    </span>
                  </Button>
                ),
              )}
            </div>
          </div>

          {/* Notifications List */}
          <ScrollArea className="flex-1">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-4 py-12 text-center">
                <Bell className="h-8 w-8 text-slate-600 mb-3" />
                <p className="text-sm text-slate-400">
                  No {categoryLabels[activeCategory].toLowerCase()}{" "}
                  notifications
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Try another filter or check again soon
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {/* Unread notifications */}
                {unreadNotifications.length > 0 && (
                  <>
                    {unreadNotifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        icon={notificationIcons[notification.type]}
                        onClickNotification={handleNotificationClick}
                        onDelete={deleteNotification}
                        onMarkRead={markRead}
                      />
                    ))}
                  </>
                )}

                {/* Separator between unread and read */}
                {unreadNotifications.length > 0 &&
                  readNotifications.length > 0 && (
                    <div className="px-4 py-2">
                      <p className="text-xs text-slate-500">Earlier</p>
                    </div>
                  )}

                {/* Read notifications */}
                {readNotifications.length > 0 &&
                  readNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      icon={notificationIcons[notification.type]}
                      onClickNotification={handleNotificationClick}
                      onDelete={deleteNotification}
                      onMarkRead={markRead}
                      isRead
                    />
                  ))}

                {hasMore && (
                  <div ref={loadMoreRef} className="px-4 py-3 text-center">
                    <p className="text-[11px] text-slate-500">
                      {isLoadingNotifications
                        ? "Loading more..."
                        : "Scroll to load more"}
                    </p>
                  </div>
                )}

                {!hasMore && filteredNotifications.length > 0 && (
                  <div className="px-4 py-3 text-center">
                    <p className="text-[11px] text-slate-500">
                      Loaded {filteredNotifications.length} notifications
                    </p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-white/10 px-4 py-3 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8 border-white/10 text-slate-300 hover:text-slate-100 hover:bg-white/5"
                onClick={() => {
                  navigate("/notifications");
                  setOpen(false);
                }}
              >
                View all notifications
                <ChevronRight className="h-3 w-3 ml-1.5" />
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface NotificationItemProps {
  notification: Notification;
  icon: React.ReactNode;
  onClickNotification: (notification: Notification) => void;
  onDelete: (id: string) => void;
  onMarkRead: (id: string) => void;
  isRead?: boolean;
}

function NotificationItem({
  notification,
  icon,
  onClickNotification,
  onDelete,
  onMarkRead,
  isRead,
}: NotificationItemProps) {
  return (
    <div
      className={cn(
        "group px-4 py-3 transition-colors cursor-pointer relative",
        !isRead ? "bg-blue-500/5 hover:bg-blue-500/10" : "hover:bg-white/5",
      )}
      onClick={() => onClickNotification(notification)}
    >
      <div className="grid grid-cols-[auto,minmax(0,1fr),auto] items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0",
            !isRead ? "bg-blue-400/20" : "bg-white/5",
          )}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "text-xs font-semibold truncate",
                  !isRead ? "text-slate-100" : "text-slate-300",
                )}
              >
                {notification.title}
              </p>
              {notification.body && (
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {notification.body}
                </p>
              )}
            </div>

            {/* Unread Indicator */}
            {!isRead && (
              <div className="flex-shrink-0 h-2 w-2 rounded-full bg-blue-400 mt-1" />
            )}
          </div>

          {/* Timestamp */}
          <p className="text-[11px] text-slate-500 mt-1.5">
            {formatDistanceToNow(new Date(notification.createdAt), {
              addSuffix: true,
            })}
          </p>
        </div>

        {/* Actions */}
        <div className="w-8 flex-shrink-0 flex flex-col gap-1 items-end">
          {!isRead ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md bg-white/5 text-slate-400 hover:bg-white/10 group-hover:text-slate-200"
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(notification.id);
              }}
              title="Mark as read"
              aria-label="Mark notification as read"
            >
              <CheckCircle className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <div className="h-7 w-7" />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md bg-white/5 text-slate-400 hover:bg-red-500/20 hover:text-red-400"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notification.id);
            }}
            title="Delete"
            aria-label="Delete notification"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
