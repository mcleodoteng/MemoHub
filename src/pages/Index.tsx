import { AppLayout } from "@/components/layout/AppLayout";
import { memos, notifications, conversations, groups, currentUser, getUserById } from "@/data/mock";
import { MemoCard } from "@/components/memo/MemoCard";
import {
  FileText,
  Bell,
  Users,
  MessageSquare,
  CheckCircle2,
  Clock,
  TrendingUp,
  Pin,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const stats = [
  {
    label: "Total Memos",
    value: memos.length,
    icon: FileText,
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    label: "Unread Notifications",
    value: notifications.filter((n) => !n.read).length,
    icon: Bell,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  {
    label: "Active Groups",
    value: groups.filter((g) => g.memberIds.includes(currentUser.id)).length,
    icon: Users,
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    label: "Conversations",
    value: conversations.length,
    icon: MessageSquare,
    color: "text-info",
    bgColor: "bg-info/10",
  },
];

const pendingApprovals = memos.filter((m) =>
  m.recipientStatuses.some(
    (s) => s.userId === currentUser.id && s.opened && !s.approved
  )
);

const pinnedMemos = memos.filter((m) => m.pinned);

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <AppLayout title="Dashboard">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Welcome */}
        <div>
          <h2 className="font-display text-2xl font-bold">
            Welcome back, {currentUser.name.split(" ")[0]} 👋
          </h2>
          <p className="text-muted-foreground mt-1">
            Here's what's happening today
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
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

        <div className="grid md:grid-cols-2 gap-6">
          {/* Pending Approvals */}
          <div className="widget-card">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-warning" />
              <h3 className="font-display font-semibold">Pending Approvals</h3>
              <span className="ml-auto text-xs text-muted-foreground">
                {pendingApprovals.length} items
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
                      onClick={() => navigate(`/memos/${memo.id}`)}
                    >
                      <CheckCircle2 className="h-4 w-4 text-warning shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{memo.title}</p>
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

          {/* Pinned Memos */}
          <div className="widget-card">
            <div className="flex items-center gap-2 mb-4">
              <Pin className="h-4 w-4 text-primary" />
              <h3 className="font-display font-semibold">Pinned Memos</h3>
              <span className="ml-auto text-xs text-muted-foreground">
                {pinnedMemos.length} items
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
                      onClick={() => navigate(`/memos/${memo.id}`)}
                    >
                      <Pin className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{memo.title}</p>
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
        </div>

        {/* Recent Memos */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-semibold">Recent Memos</h3>
          </div>
          <div className="space-y-3">
            {memos.slice(0, 4).map((memo) => (
              <MemoCard key={memo.id} memo={memo} />
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
