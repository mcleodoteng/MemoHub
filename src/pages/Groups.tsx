import { AppLayout } from "@/components/layout/AppLayout";
import { useGroups } from "@/context/GroupContext";
import { users, currentUser, getUserById, getUserInitials } from "@/data/mock";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Users, X, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Group } from "@/types";

const typeColors: Record<string, string> = {
  department: "bg-primary/10 text-primary",
  project: "bg-accent/10 text-accent",
  custom: "bg-warning/10 text-warning",
};

const Groups = () => {
  const navigate = useNavigate();
  const { groups, addGroup } = useGroups();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<Group['type']>("custom");
  const [newMembers, setNewMembers] = useState<string[]>([]);

  const otherUsers = users.filter(u => u.id !== currentUser.id);
  const myGroups = groups.filter(g => g.memberIds.includes(currentUser.id));
  const invitedGroups = groups.filter(g => !g.memberIds.includes(currentUser.id) && g.pendingInvites.some(i => i.userId === currentUser.id && i.status === 'pending'));
  const otherGroups = groups.filter(g => !g.memberIds.includes(currentUser.id) && !g.pendingInvites.some(i => i.userId === currentUser.id && i.status === 'pending'));

  const handleCreateGroup = () => {
    if (!newName.trim()) { toast.error("Group name is required"); return; }
    const newGroup = addGroup({ name: newName, description: newDesc, type: newType, memberIds: newMembers });
    toast.success("Group created!");
    setCreateOpen(false);
    setNewName(""); setNewDesc(""); setNewType("custom"); setNewMembers([]);
    navigate(`/groups/${newGroup.id}`);
  };

  const handleGroupClick = (group: Group) => {
    if (group.memberIds.includes(currentUser.id) || group.pendingInvites.some(i => i.userId === currentUser.id && i.status === 'pending')) {
      navigate(`/groups/${group.id}`);
    } else {
      toast.error("You are not a member of this group");
    }
  };

  return (
    <AppLayout title="Groups & Departments">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">{groups.length} groups</p>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create Group
          </Button>
        </div>

        {myGroups.length > 0 && (
          <div>
            <h3 className="font-display font-semibold text-sm mb-3">My Groups</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {myGroups.map(group => (
                <div key={group.id} className="widget-card cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleGroupClick(group)}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-semibold">{group.name}</h3>
                        <Badge variant="secondary" className={`text-[10px] ${typeColors[group.type] || ""}`}>{group.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{group.description}</p>
                      <div className="flex items-center gap-1 mt-3">
                        <div className="flex -space-x-2">
                          {group.memberIds.slice(0, 4).map(id => {
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
                        <span className="text-xs text-muted-foreground ml-2">{group.memberIds.length} members</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {otherGroups.length > 0 && (
          <div>
            <h3 className="font-display font-semibold text-sm mb-3 text-muted-foreground">Other Groups</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {otherGroups.map(group => (
                <div key={group.id} className="widget-card opacity-60 cursor-not-allowed">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                      <Lock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-semibold">{group.name}</h3>
                        <Badge variant="secondary" className={`text-[10px] ${typeColors[group.type] || ""}`}>{group.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{group.description}</p>
                      <p className="text-xs text-muted-foreground mt-2">{group.memberIds.length} members · Not a member</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Create New Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Name</label>
              <Input placeholder="Group name" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <Textarea placeholder="What is this group for?" value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Type</label>
              <Select value={newType} onValueChange={v => setNewType(v as Group['type'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Members</label>
              <div className="flex flex-wrap gap-2">
                {otherUsers.map(user => (
                  <Badge
                    key={user.id}
                    variant={newMembers.includes(user.id) ? "default" : "outline"}
                    className="cursor-pointer transition-colors"
                    onClick={() => setNewMembers(prev => prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id])}
                  >
                    {user.name} {newMembers.includes(user.id) && <X className="h-3 w-3 ml-1" />}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateGroup} className="gap-2"><Plus className="h-4 w-4" /> Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Groups;
