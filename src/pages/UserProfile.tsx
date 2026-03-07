import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { getUserById, getUserInitials, currentUser, groups } from "@/data/mock";
import { useMemos } from "@/context/MemoContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MemoCard } from "@/components/memo/MemoCard";
import { FileText, Users, Mail, Building, ArrowLeft, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { memos } = useMemos();

  const user = getUserById(userId || "");

  if (!user) {
    return (
      <AppLayout title="User Not Found">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">User not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </AppLayout>
    );
  }

  // If viewing own profile, redirect
  if (user.id === currentUser.id) {
    navigate("/profile", { replace: true });
    return null;
  }

  const userMemos = memos.filter(m => m.creatorId === user.id && m.status !== 'draft' && m.visibility === 'public');
  const userGroups = groups.filter(g => g.memberIds.includes(user.id));

  return (
    <AppLayout title={user.name}>
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div className="widget-card flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <Avatar className="h-20 w-20 avatar-ring">
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-display font-bold">
              {getUserInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="text-center sm:text-left flex-1">
            <h2 className="font-display text-xl font-bold">{user.name}</h2>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap justify-center sm:justify-start">
              <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {user.email}</span>
              <span className="flex items-center gap-1"><Building className="h-3.5 w-3.5" /> {user.department}</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}</span>
            </div>
            <div className="flex gap-2 mt-3 justify-center sm:justify-start">
              <Badge>{user.role}</Badge>
              <Badge variant="outline" className="capitalize">
                <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${user.status === 'online' ? 'bg-emerald-500' : user.status === 'away' ? 'bg-amber-500' : 'bg-muted-foreground'}`} />
                {user.status}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="widget-card flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><FileText className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-xl font-display font-bold">{userMemos.length}</p>
              <p className="text-xs text-muted-foreground">Public Memos</p>
            </div>
          </div>
          <div className="widget-card flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10"><Users className="h-5 w-5 text-accent" /></div>
            <div>
              <p className="text-xl font-display font-bold">{userGroups.length}</p>
              <p className="text-xs text-muted-foreground">Groups</p>
            </div>
          </div>
        </div>

        {userGroups.length > 0 && (
          <div>
            <h3 className="font-display font-semibold mb-3">Groups</h3>
            <div className="flex flex-wrap gap-2">
              {userGroups.map(g => (
                <Badge key={g.id} variant="secondary" className="cursor-pointer" onClick={() => navigate(`/groups/${g.id}`)}>
                  <Users className="h-3 w-3 mr-1" /> {g.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {userMemos.length > 0 && (
          <div>
            <h3 className="font-display font-semibold mb-3">Public Memos by {user.name.split(' ')[0]}</h3>
            <div className="space-y-3">
              {userMemos.map(m => <MemoCard key={m.id} memo={m} />)}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default UserProfile;
