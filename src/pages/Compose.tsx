import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { users, tags, currentUser, getUserInitials, getUserById } from "@/data/mock";
import { UserHoverCard } from "@/components/user/UserHoverCard";
import { useMemos } from "@/context/MemoContext";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { AttachmentUploader } from "@/components/attachment/AttachmentManager";
import { MemoReferencePicker } from "@/components/memo/MemoReferencePicker";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MemoVisibility, Attachment } from "@/types";
import { useState, useMemo } from "react";
import { Globe, Lock, Shield, Send, X, FileText, Save } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Compose = () => {
  const navigate = useNavigate();
  const { addMemo, getMemoById } = useMemos();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<MemoVisibility>("public");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [referencedMemoIds, setReferencedMemoIds] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [customTagInput, setCustomTagInput] = useState("");

  const otherUsers = users.filter((u) => u.id !== currentUser.id);
  const filteredUsers = useMemo(() =>
    otherUsers.filter((u) =>
      u.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      u.department.toLowerCase().includes(recipientSearch.toLowerCase())
    ), [recipientSearch]);

  const toggleRecipient = (userId: string) => {
    setSelectedRecipients((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  const addCustomTag = () => {
    const tag = customTagInput.trim();
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags((prev) => [...prev, tag]);
      setCustomTagInput("");
    }
  };

  const handleSend = () => {
    if (!title.trim()) { toast.error("Please add a title"); return; }
    if (!body.trim() && body !== '<p></p>') { toast.error("Please add content"); return; }
    addMemo({
      title, body, creatorId: currentUser.id, visibility, status: 'sent',
      recipientIds: selectedRecipients, tags: selectedTags, attachments,
      pinned: false, archived: false, referencedMemoIds, groupId: undefined,
    });
    toast.success("Memo sent successfully!");
    navigate("/memos");
  };

  const handleSaveDraft = () => {
    if (!title.trim()) { toast.error("Please add a title for the draft"); return; }
    addMemo({
      title, body, creatorId: currentUser.id, visibility, status: 'draft',
      recipientIds: selectedRecipients, tags: selectedTags, attachments,
      pinned: false, archived: false, referencedMemoIds, groupId: undefined,
    });
    toast.success("Draft saved!");
    navigate("/memos");
  };

  return (
    <AppLayout title="Compose Memo">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="widget-card space-y-5">
          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title</label>
            <Input placeholder="Enter memo title..." value={title} onChange={(e) => setTitle(e.target.value)} className="font-display text-lg" />
          </div>

          {/* Visibility - fixed: no duplicate icon */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Visibility</label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as MemoVisibility)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Public</span>
                </SelectItem>
                <SelectItem value="private">
                  <span className="flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Private</span>
                </SelectItem>
                <SelectItem value="protected">
                  <span className="flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> Protected</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recipients with search */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Recipients
              {selectedRecipients.length > 0 && (
                <span className="text-xs text-muted-foreground ml-2">({selectedRecipients.length} selected)</span>
              )}
            </label>
            <Input
              placeholder="Search recipients by name, email, or department..."
              value={recipientSearch}
              onChange={(e) => setRecipientSearch(e.target.value)}
              className="mb-2 h-8 text-sm"
            />
            {/* Selected recipients */}
            {selectedRecipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedRecipients.map((userId) => {
                  const user = getUserById(userId);
                  return user ? (
                    <Badge key={userId} variant="default" className="gap-1 cursor-pointer" onClick={() => toggleRecipient(userId)}>
                      <UserHoverCard user={user}>
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="text-[7px] bg-primary-foreground/20 text-primary-foreground">
                            {getUserInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                      </UserHoverCard>
                      {user.name}
                      <X className="h-3 w-3 ml-0.5" />
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
            {/* Available recipients */}
            <div className="flex flex-wrap gap-2 max-h-32 overflow-auto">
              {filteredUsers
                .filter((u) => !selectedRecipients.includes(u.id))
                .map((user) => (
                  <UserHoverCard key={user.id} user={user}>
                    <Badge
                      variant="outline"
                      className="cursor-pointer transition-colors gap-1.5"
                      onClick={() => toggleRecipient(user.id)}
                    >
                      <Avatar className="h-4 w-4">
                        <AvatarFallback className="text-[7px] bg-secondary text-secondary-foreground">
                          {getUserInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      {user.name}
                      <span className="text-[10px] text-muted-foreground">· {user.department}</span>
                    </Badge>
                  </UserHoverCard>
                ))}
              {filteredUsers.filter((u) => !selectedRecipients.includes(u.id)).length === 0 && recipientSearch && (
                <p className="text-xs text-muted-foreground py-2">No users match "{recipientSearch}"</p>
              )}
            </div>
          </div>

          {/* Tags with custom input */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={selectedTags.includes(tag.name) ? "default" : "secondary"}
                  className="cursor-pointer transition-colors"
                  onClick={() => toggleTag(tag.name)}
                >
                  {tag.name}
                  {selectedTags.includes(tag.name) && <X className="h-3 w-3 ml-1" />}
                </Badge>
              ))}
              {/* Custom tags not in predefined list */}
              {selectedTags.filter(t => !tags.some(pt => pt.name === t)).map(tag => (
                <Badge key={tag} variant="default" className="cursor-pointer transition-colors" onClick={() => toggleTag(tag)}>
                  {tag} <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add custom tag..."
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                className="h-8 text-sm w-48"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomTag())}
              />
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={addCustomTag} disabled={!customTagInput.trim()}>
                Add
              </Button>
            </div>
          </div>

          {/* Rich Text Content */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Content</label>
            <RichTextEditor content={body} onChange={setBody} placeholder="Write your memo content..." minHeight="200px" />
          </div>

          {/* References */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">References</label>
            <div className="flex items-center gap-2 flex-wrap">
              <MemoReferencePicker onSelect={(id) => setReferencedMemoIds(prev => [...prev, id])} selectedIds={referencedMemoIds} />
              {referencedMemoIds.map(refId => {
                const ref = getMemoById(refId);
                return (
                  <Badge key={refId} variant="outline" className="gap-1">
                    <FileText className="h-3 w-3" />
                    {ref?.title || refId}
                    <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setReferencedMemoIds(prev => prev.filter(id => id !== refId))} />
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Attachments */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Attachments</label>
            <AttachmentUploader
              attachments={attachments}
              onAdd={(newAtts) => setAttachments(prev => [...prev, ...newAtts])}
              onRemove={(id) => setAttachments(prev => prev.filter(a => a.id !== id))}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t">
            <div className="flex-1" />
            <Button variant="outline" onClick={() => navigate("/memos")}>Cancel</Button>
            <Button variant="secondary" onClick={handleSaveDraft} className="gap-2">
              <Save className="h-4 w-4" /> Save Draft
            </Button>
            <Button onClick={handleSend} className="gap-2">
              <Send className="h-4 w-4" /> Send Memo
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Compose;
