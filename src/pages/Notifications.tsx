import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useNotifications } from "@/context/NotificationContext";
import { useMemos } from "@/context/MemoContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FileText, MessageCircle, Heart, Mail, AtSign, Users,
  CheckCircle2, CheckCheck, Bell, Clock, Star, Filter, X, GitMerge,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useReminders } from "@/context/ReminderContext";
import { useGroups } from "@/context/GroupContext";
import { currentUser } from "@/data/mock";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getActiveWorkflowMemos, getCurrentPendingApprovalStep } from "@/lib/workflow";

const typeIcons: Record<string, typeof FileText> = {
  memo_received: Mail,
  memo_approved: CheckCircle2,
  comment_added: MessageCircle,
  reaction_added: Heart,
  message_received: MessageCircle,
  mention: AtSign,
  group_invite: Users,
  reminder: Clock,
  starred_activity: Star,
  workflow_pending_approval: GitMerge,
};

const typeLabels: Record<string, string> = {
  memo_received: "Memos",
  memo_approved: "Approvals",
  comment_added: "Comments",
  reaction_added: "Reactions",
  message_received: "Messages",
  mention: "Mentions",
  group_invite: "Groups",
  reminder: "Reminders",
  starred_activity: "Starred",
  workflow_pending_approval: "Workflow",
};

const typeColors: Record<string, string> = {
  memo_received: "bg-info/10 text-info",
  memo_approved: "bg-success/10 text-success",
  comment_added: "bg-primary/10 text-primary",
  reaction_added: "bg-destructive/10 text-destructive",
  message_received: "bg-accent/10 text-accent",
  mention: "bg-warning/10 text-warning",
  group_invite: "bg-primary/10 text-primary",
  reminder: "bg-warning/10 text-warning",
  starred_activity: "bg-warning/10 text-warning",
  workflow_pending_approval: "bg-warning/10 text-warning",
};

const Notifications = () => {
  const navigate = useNavigate();
  const { reminders } = useReminders();
  const { groups } = useGroups();
  const { memos } = useMemos();
  const { notifications: contextNotifs, markRead, markAllRead } = useNotifications();

  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [dismissedWorkflowNotifIds, setDismissedWorkflowNotifIds] = useState<string[]>([]);

  // Merge in dynamic notifications from groups/reminders/workflow approvals
  const allNotifs = useMemo(() => {
    const extras: typeof contextNotifs = [];

    groups.forEach(g => {
      g.pendingInvites
        .filter(i => i.userId === currentUser.id && i.status === "pending")
        .forEach(i => {
          extras.push({
            id: `ginv-${g.id}-${i.userId}`,
            userId: currentUser.id,
            type: "group_invite",
            title: "Group Invitation",
            body: `You've been invited to join "${g.name}"`,
            read: false,
            actionUrl: `/groups/${g.id}`,
            createdAt: i.invitedAt,
          });
        });
    });

    reminders
      .filter(r => r.fired)
      .forEach(r => {
        extras.push({
          id: `rem-${r.id}`,
          userId: currentUser.id,
          type: "reminder",
          title: "Reminder Due",
          body: r.title + (r.description ? `: ${r.description}` : ""),
          read: false,
          actionUrl: "/reminders",
          createdAt: r.dueAt,
        });
      });

    getActiveWorkflowMemos(memos).forEach(memo => {
      if (memo.archived || (memo.hiddenBy || []).includes(currentUser.id)) return;

      const pendingStep = getCurrentPendingApprovalStep(memo);
      if (!pendingStep || pendingStep.approverId !== currentUser.id) return;

      const workflowNotificationId = `wf-${memo.id}-${pendingStep.id}`;
      extras.push({
        id: workflowNotificationId,
        userId: currentUser.id,
        type: "workflow_pending_approval",
        title: "Approval Needed",
        body: `"${memo.title}" is awaiting your approval (step ${pendingStep.order}/${memo.workflow?.approvalChain.length || 0}).`,
        read: dismissedWorkflowNotifIds.includes(workflowNotificationId),
        actionUrl: "/workflow",
        createdAt: memo.updatedAt,
      });
    });

    return [...contextNotifs, ...extras].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [contextNotifs, groups, reminders, memos, dismissedWorkflowNotifIds]);

  const filtered = useMemo(() => {
    let items = allNotifs;
    if (tab === "unread") items = items.filter(n => !n.read);
    if (activeFilter) items = items.filter(n => n.type === activeFilter);
    return items;
  }, [allNotifs, tab, activeFilter]);

  const totalUnread = allNotifs.filter(n => !n.read).length;
  const filterTypes = [...new Set(allNotifs.map(n => n.type))];

  const handleMarkAllRead = () => {
    markAllRead();

    const workflowIds = allNotifs
      .filter(notif => notif.type === "workflow_pending_approval")
      .map(notif => notif.id);

    setDismissedWorkflowNotifIds(prev => Array.from(new Set([...prev, ...workflowIds])));
  };

  return (
    <AppLayout title="Notifications">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-primary shrink-0" />
            <div>
              <h2 className="font-display font-bold text-lg">Notification Center</h2>
              <p className="text-xs text-muted-foreground">{totalUnread} unread</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Filter className="h-3.5 w-3.5" />
                      {activeFilter ? typeLabels[activeFilter] || activeFilter : "Filter"}
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Filter notifications by type</TooltipContent>
              </Tooltip>
              <PopoverContent className="w-48 p-2" align="end">
                <button
                  className={`w-full text-left text-sm px-2 py-1.5 rounded hover:bg-secondary transition-colors ${!activeFilter ? "bg-secondary font-medium" : ""}`}
                  onClick={() => setActiveFilter(null)}
                >
                  All types
                </button>
                {filterTypes.map(type => {
                  const Icon = typeIcons[type] || FileText;
                  return (
                    <button
                      key={type}
                      className={`w-full text-left text-sm px-2 py-1.5 rounded hover:bg-secondary transition-colors flex items-center gap-2 ${activeFilter === type ? "bg-secondary font-medium" : ""}`}
                      onClick={() => setActiveFilter(type)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {typeLabels[type] || type}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleMarkAllRead} disabled={totalUnread === 0}>
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mark all notifications as read</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {activeFilter && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 text-xs">
              Filtered: {typeLabels[activeFilter]}
              <button onClick={() => setActiveFilter(null)}><X className="h-3 w-3" /></button>
            </Badge>
          </div>
        )}

        <Tabs value={tab} onValueChange={v => setTab(v as "all" | "unread")}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs gap-1">
              All <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{allNotifs.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs gap-1">
              Unread {totalUnread > 0 && <Badge className="text-[10px] px-1.5 py-0 ml-1">{totalUnread}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-3">
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No notifications</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filtered.map(notif => {
                  const Icon = typeIcons[notif.type] || FileText;
                  return (
                    <div
                      key={notif.id}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                        notif.read
                          ? "opacity-60 hover:bg-secondary/50 hover:opacity-80"
                          : "bg-secondary/30 hover:bg-secondary/60"
                      }`}
                      onClick={() => {
                        if (notif.type === "workflow_pending_approval") {
                          setDismissedWorkflowNotifIds(prev => Array.from(new Set([...prev, notif.id])));
                        }
                        markRead(notif.id);
                        if (notif.actionUrl) navigate(notif.actionUrl);
                      }}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${typeColors[notif.type] || "bg-muted"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm ${notif.read ? "" : "font-semibold"}`}>{notif.title}</p>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-transparent">
                            {typeLabels[notif.type] || notif.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{notif.body}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      {!notif.read && <span className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0 animate-pulse" />}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Notifications;
