import { AppLayout } from "@/components/layout/AppLayout";
import { useGroups } from "@/context/GroupContext";
import { useMemos } from "@/context/MemoContext";
import { users, currentUser, getUserById, getUserInitials } from "@/data/mock";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Users, Settings, UserPlus, UserMinus, ShieldCheck, Send, X, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Group } from "@/types";

const typeColors: Record<string, string> = {
  department: "bg-primary/10 text-primary",
  project: "bg-accent/10 text-accent",
  custom: "bg-warning/10 text-warning",
};

const Groups = () => {
  const { groups, addGroup, addMember, removeMember, addAdmin, removeAdmin, deleteGroup } = useGroups();
  const { addMemo } = useMemos();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [memoDialogGroup, setMemoDialogGroup] = useState<Group | null>(null);

  // Create group form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<Group['type']>("custom");
  const [newMembers, setNewMembers] = useState<string[]>([]);

  // Group memo form
  const [memoTitle, setMemoTitle] = useState("");
  const [memoBody, setMemoBody] = useState("");

  const otherUsers = users.filter(u => u.id !== currentUser.id);

  const handleCreateGroup = () => {
    if (!newName.trim()) { toast.error("Group name is required"); return; }
    addGroup({ name: newName, description: newDesc, type: newType, memberIds: newMembers });
    toast.success("Group created!");
    setCreateOpen(false);
    setNewName(""); setNewDesc(""); setNewType("custom"); setNewMembers([]);
  };

  const handleSendGroupMemo = () => {
    if (!memoDialogGroup || !memoTitle.trim()) { toast.error("Title is required"); return; }
    const recipientIds = memoDialogGroup.memberIds.filter(id => id !== currentUser.id);
    addMemo({
      title: memoTitle,
      body: memoBody,
      creatorId: currentUser.id,
      visibility: 'private',
      status: 'sent',
      recipientIds,
      tags: [],
      attachments: [],
      pinned: false,
      archived: false,
      referencedMemoIds: [],
      groupId: memoDialogGroup.id,
    });
    toast.success(`Memo sent to ${memoDialogGroup.name}!`);
    setMemoDialogGroup(null);
    setMemoTitle(""); setMemoBody("");
  };

  const isAdmin = (group: Group) => group.adminIds.includes(currentUser.id);

  return (
    <AppLayout title="Groups & Departments">
      <div className="max-w-4xl mx-auto space-y-4">
        {selectedGroup ? (
          // Group Detail View
          <div className="space-y-4">
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedGroup(null)}>
              <ArrowLeft className="h-4 w-4" /> Back to Groups
            </Button>

            <div className="widget-card space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl font-bold">{selectedGroup.name}</h2>
                    <Badge variant="secondary" className={`text-xs ${typeColors[selectedGroup.type] || ""}`}>{selectedGroup.type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{selectedGroup.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="gap-1" onClick={() => setMemoDialogGroup(selectedGroup)}>
                    <Send className="h-3.5 w-3.5" /> Send Memo
                  </Button>
                  {isAdmin(selectedGroup) && (
                    <Button size="sm" variant="destructive" onClick={() => { deleteGroup(selectedGroup.id); setSelectedGroup(null); toast.success("Group deleted"); }}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>

              {/* Members */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-semibold text-sm">{selectedGroup.memberIds.length} Members</h3>
                  {isAdmin(selectedGroup) && (
                    <Select onValueChange={id => { addMember(selectedGroup.id, id); setSelectedGroup({ ...selectedGroup, memberIds: [...selectedGroup.memberIds, id] }); toast.success("Member added"); }}>
                      <SelectTrigger className="w-40 h-8 text-xs">
                        <div className="flex items-center gap-1"><UserPlus className="h-3 w-3" /> Add Member</div>
                      </SelectTrigger>
                      <SelectContent>
                        {otherUsers.filter(u => !selectedGroup.memberIds.includes(u.id)).map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  {selectedGroup.memberIds.map(id => {
                    const user = getUserById(id);
                    if (!user) return null;
                    const isGroupAdmin = selectedGroup.adminIds.includes(id);
                    return (
                      <div key={id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                            {getUserInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{user.name}</span>
                            {isGroupAdmin && <Badge variant="secondary" className="text-[10px]"><ShieldCheck className="h-3 w-3 mr-0.5" /> Admin</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{user.department}</p>
                        </div>
                        {isAdmin(selectedGroup) && id !== currentUser.id && (
                          <div className="flex gap-1">
                            {!isGroupAdmin ? (
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { addAdmin(selectedGroup.id, id); setSelectedGroup({ ...selectedGroup, adminIds: [...selectedGroup.adminIds, id] }); toast.success("Admin added"); }}>
                                Make Admin
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { removeAdmin(selectedGroup.id, id); setSelectedGroup({ ...selectedGroup, adminIds: selectedGroup.adminIds.filter(a => a !== id) }); toast.success("Admin removed"); }}>
                                Remove Admin
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { removeMember(selectedGroup.id, id); setSelectedGroup({ ...selectedGroup, memberIds: selectedGroup.memberIds.filter(m => m !== id) }); toast.success("Member removed"); }}>
                              <UserMinus className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Group List View
          <>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">{groups.length} groups</p>
              <Button className="gap-2" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Create Group
              </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {groups.map(group => (
                <div key={group.id} className="widget-card cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedGroup(group)}>
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
          </>
        )}
      </div>

      {/* Create Group Dialog */}
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

      {/* Send Group Memo Dialog */}
      <Dialog open={!!memoDialogGroup} onOpenChange={() => setMemoDialogGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Send Memo to {memoDialogGroup?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title</label>
              <Input placeholder="Memo title" value={memoTitle} onChange={e => setMemoTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Content</label>
              <Textarea placeholder="Write your memo..." value={memoBody} onChange={e => setMemoBody(e.target.value)} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemoDialogGroup(null)}>Cancel</Button>
            <Button onClick={handleSendGroupMemo} className="gap-2"><Send className="h-4 w-4" /> Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Groups;
