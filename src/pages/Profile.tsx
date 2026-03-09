import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { getUserInitials, groups } from "@/data/mock";
import { useMemos } from "@/context/MemoContext";
import { useOnlineStatuses } from "@/hooks/useOnlineStatus";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MemoCard } from "@/components/memo/MemoCard";
import { FileText, Users, Mail, Building, FileEdit, Settings, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

const statusColors: Record<string, string> = {
  online: "bg-emerald-500",
  away: "bg-amber-500",
  offline: "bg-muted-foreground/40",
};

const Profile = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { memos } = useMemos();
  const { getUserStatus } = useOnlineStatuses();

  if (!currentUser) return null;

  const status = getUserStatus(currentUser.id);
  const myMemos = memos.filter(m => m.creatorId === currentUser.id && m.status !== 'draft');
  const myDrafts = memos.filter(m => m.creatorId === currentUser.id && m.status === 'draft');
  const myGroups = groups.filter(g => g.memberIds.includes(currentUser.id));

  return (
    <AppLayout title="Profile">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="widget-card flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative">
            <Avatar className="h-20 w-20 avatar-ring">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-display font-bold">
                {getUserInitials(currentUser.name)}
              </AvatarFallback>
            </Avatar>
            <span className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card ${statusColors[status]}`} />
          </div>
          <div className="text-center sm:text-left flex-1">
            <h2 className="font-display text-xl font-bold">{currentUser.name}</h2>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap justify-center sm:justify-start">
              <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {currentUser.email}</span>
              <span className="flex items-center gap-1"><Building className="h-3.5 w-3.5" /> {currentUser.department}</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Joined {formatDistanceToNow(new Date(currentUser.createdAt), { addSuffix: true })}</span>
            </div>
            <div className="flex gap-2 mt-3 justify-center sm:justify-start">
              <Badge>{currentUser.role}</Badge>
              <Badge variant="outline" className="capitalize">
                <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${statusColors[status]}`} />
                {status}
              </Badge>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/settings')}>
            <Settings className="h-4 w-4" /> Edit Profile
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="widget-card flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><FileText className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-xl font-display font-bold">{myMemos.length}</p>
              <p className="text-xs text-muted-foreground">Memos Created</p>
            </div>
          </div>
          <div className="widget-card flex items-center gap-3 cursor-pointer" onClick={() => navigate("/drafts")}>
            <div className="p-2 rounded-lg bg-warning/10"><FileEdit className="h-5 w-5 text-warning" /></div>
            <div>
              <p className="text-xl font-display font-bold">{myDrafts.length}</p>
              <p className="text-xs text-muted-foreground">Drafts</p>
            </div>
          </div>
          <div className="widget-card flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10"><Users className="h-5 w-5 text-accent" /></div>
            <div>
              <p className="text-xl font-display font-bold">{myGroups.length}</p>
              <p className="text-xs text-muted-foreground">Groups</p>
            </div>
          </div>
        </div>

        {myGroups.length > 0 && (
          <div>
            <h3 className="font-display font-semibold mb-3">My Groups</h3>
            <div className="flex flex-wrap gap-2">
              {myGroups.map(g => (
                <Badge key={g.id} variant="secondary" className="cursor-pointer" onClick={() => navigate(`/groups/${g.id}`)}>
                  <Users className="h-3 w-3 mr-1" /> {g.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {myDrafts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold">My Drafts</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate("/drafts")}>View All</Button>
            </div>
            <div className="space-y-3">
              {myDrafts.slice(0, 3).map(m => <MemoCard key={m.id} memo={m} />)}
            </div>
          </div>
        )}

        <div>
          <h3 className="font-display font-semibold mb-3">My Memos</h3>
          <div className="space-y-3">
            {myMemos.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No memos yet</p>
            ) : (
              myMemos.map(m => <MemoCard key={m.id} memo={m} />)
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;
