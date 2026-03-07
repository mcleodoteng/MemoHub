import { AppLayout } from "@/components/layout/AppLayout";
import { useMemos } from "@/context/MemoContext";
import { useMessages } from "@/context/MessageContext";
import { MemoCard } from "@/components/memo/MemoCard";
import { notifications, currentUser, getUserById } from "@/data/mock";
import {
  FileText, Bell, Users, MessageSquare,
  CheckCircle2, Clock, TrendingUp, Pin, Activity, FileEdit,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

const Dashboard = () => {
  const navigate = useNavigate();
  const { memos } = useMemos();
  const { conversations } = useMessages();

  const unreadMessages = conversations.filter(c =>
    c.lastMessage && !c.lastMessage.readBy.includes(currentUser.id)
  ).length;

  const draftMemos = memos.filter(m => m.status === 'draft' && m.creatorId === currentUser.id);

  const stats = [
    { label: "Total Memos", value: memos.filter(m => m.status !== 'draft').length, icon: FileText, color: "text-primary", bgColor: "bg-primary/10" },
    { label: "Unread Messages", value: unreadMessages, icon: MessageSquare, color: "text-info", bgColor: "bg-info/10" },
    { label: "Notifications", value: notifications.filter(n => !n.read).length, icon: Bell, color: "text-destructive", bgColor: "bg-destructive/10" },
    { label: "Drafts", value: draftMemos.length, icon: FileEdit, color: "text-warning", bgColor: "bg-warning/10" },
  ];

  const pendingApprovals = memos.filter(m =>
    m.recipientStatuses.some(s => s.userId === currentUser.id && s.opened && !s.approved)
  );
  const pinnedMemos = memos.filter(m => m.pinned);

  // Activity feed from notifications
  const recentActivity = notifications.slice(0, 5);

  return (
    <AppLayout title="Dashboard">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold">Welcome back, {currentUser.name.split(" ")[0]} 👋</h2>
          <p className="text-muted-foreground mt-1">Here's what's happening today</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(stat => (
            <div key={stat.label} className="widget-card">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold">{stat.value}</p>
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
              <span className="ml-auto text-xs text-muted-foreground">{pendingApprovals.length}</span>
            </div>
            <div className="space-y-3">
              {pendingApprovals.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">All caught up! 🎉</p>
              ) : (
                pendingApprovals.slice(0, 3).map(memo => {
                  const creator = getUserById(memo.creatorId);
                  return (
                    <div key={memo.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors" onClick={() => navigate(`/memos/${memo.id}`)}>
                      <CheckCircle2 className="h-4 w-4 text-warning shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{memo.title}</p>
                        <p className="text-xs text-muted-foreground">from {creator?.name}</p>
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
              <span className="ml-auto text-xs text-muted-foreground">{pinnedMemos.length}</span>
            </div>
            <div className="space-y-3">
              {pinnedMemos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No pinned memos</p>
              ) : (
                pinnedMemos.slice(0, 3).map(memo => {
                  const creator = getUserById(memo.creatorId);
                  return (
                    <div key={memo.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors" onClick={() => navigate(`/memos/${memo.id}`)}>
                      <Pin className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{memo.title}</p>
                        <p className="text-xs text-muted-foreground">by {creator?.name}</p>
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
            </div>
            <div className="space-y-3">
              {recentActivity.map(n => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
                  onClick={() => n.actionUrl && navigate(n.actionUrl)}
                >
                  <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${n.read ? 'bg-muted-foreground/30' : 'bg-primary'}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{n.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Drafts */}
        {draftMemos.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <FileEdit className="h-4 w-4 text-warning" />
              <h3 className="font-display text-lg font-semibold">Your Drafts</h3>
            </div>
            <div className="space-y-3">
              {draftMemos.map(memo => <MemoCard key={memo.id} memo={memo} />)}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-semibold">Recent Memos</h3>
          </div>
          <div className="space-y-3">
            {memos.filter(m => m.status !== 'draft').slice(0, 4).map(memo => (
              <MemoCard key={memo.id} memo={memo} />
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
