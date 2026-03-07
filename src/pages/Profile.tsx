import { AppLayout } from "@/components/layout/AppLayout";
import { currentUser, groups } from "@/data/mock";
import { getUserInitials } from "@/data/mock";
import { useMemos } from "@/context/MemoContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MemoCard } from "@/components/memo/MemoCard";
import { FileText, Users, Mail, Building } from "lucide-react";

const Profile = () => {
  const { memos } = useMemos();
  const myMemos = memos.filter(m => m.creatorId === currentUser.id);
  const myGroups = groups.filter(g => g.memberIds.includes(currentUser.id));

  return (
    <AppLayout title="Profile">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="widget-card flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <Avatar className="h-20 w-20 avatar-ring">
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-display font-bold">
              {getUserInitials(currentUser.name)}
            </AvatarFallback>
          </Avatar>
          <div className="text-center sm:text-left">
            <h2 className="font-display text-xl font-bold">{currentUser.name}</h2>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap justify-center sm:justify-start">
              <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {currentUser.email}</span>
              <span className="flex items-center gap-1"><Building className="h-3.5 w-3.5" /> {currentUser.department}</span>
            </div>
            <div className="flex gap-2 mt-3 justify-center sm:justify-start">
              <Badge>{currentUser.role}</Badge>
              <Badge variant="outline" className="capitalize">
                <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${currentUser.status === 'online' ? 'bg-success' : currentUser.status === 'away' ? 'bg-warning' : 'bg-muted-foreground'}`} />
                {currentUser.status}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="widget-card flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><FileText className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-xl font-display font-bold">{myMemos.length}</p>
              <p className="text-xs text-muted-foreground">Memos Created</p>
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

        <div>
          <h3 className="font-display font-semibold mb-3">My Memos</h3>
          <div className="space-y-3">
            {myMemos.map(m => <MemoCard key={m.id} memo={m} />)}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;
