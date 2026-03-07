import { AppLayout } from "@/components/layout/AppLayout";
import { groups, getUserById, getUserInitials } from "@/data/mock";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";

const typeColors: Record<string, string> = {
  department: "bg-primary/10 text-primary",
  project: "bg-accent/10 text-accent",
  custom: "bg-warning/10 text-warning",
};

const Groups = () => {
  return (
    <AppLayout title="Groups & Departments">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">{groups.length} groups</p>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Group
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {groups.map((group) => (
            <div key={group.id} className="widget-card cursor-pointer hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-semibold">{group.name}</h3>
                    <Badge variant="secondary" className={`text-[10px] ${typeColors[group.type] || ""}`}>
                      {group.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{group.description}</p>
                  <div className="flex items-center gap-1 mt-3">
                    <div className="flex -space-x-2">
                      {group.memberIds.slice(0, 4).map((id) => {
                        const user = getUserById(id);
                        return (
                          <Avatar key={id} className="h-6 w-6 border-2 border-card">
                            <AvatarFallback className="text-[9px] bg-secondary font-semibold">
                              {user ? getUserInitials(user.name) : "?"}
                            </AvatarFallback>
                          </Avatar>
                        );
                      })}
                    </div>
                    <span className="text-xs text-muted-foreground ml-2">
                      {group.memberIds.length} members
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Groups;
