import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { users, tags, currentUser, getUserInitials, getUserById } from "@/data/mock";
import { useMemos } from "@/context/MemoContext";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { AttachmentUploader } from "@/components/attachment/AttachmentManager";
import { MemoReferencePicker } from "@/components/memo/MemoReferencePicker";
import { MemoVisibility, Attachment } from "@/types";
import { useState } from "react";
import { Globe, Lock, Shield, Send, X, Link2, FileText } from "lucide-react";
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

  const otherUsers = users.filter((u) => u.id !== currentUser.id);

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

  const handleSend = () => {
    if (!title.trim()) {
      toast.error("Please add a title");
      return;
    }
    if (!body.trim() && body !== '<p></p>') {
      toast.error("Please add content");
      return;
    }

    addMemo({
      title,
      body,
      creatorId: currentUser.id,
      visibility,
      status: 'sent',
      recipientIds: selectedRecipients,
      tags: selectedTags,
      attachments,
      pinned: false,
      archived: false,
      referencedMemoIds,
      groupId: undefined,
    });

    toast.success("Memo sent successfully!");
    navigate("/memos");
  };

  const visIcons = { public: Globe, private: Lock, protected: Shield };
  const VisIcon = visIcons[visibility];

  return (
    <AppLayout title="Compose Memo">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="widget-card space-y-5">
          {/* Title */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title</label>
            <Input
              placeholder="Enter memo title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-display text-lg"
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Visibility</label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as MemoVisibility)}>
              <SelectTrigger className="w-48">
                <div className="flex items-center gap-2">
                  <VisIcon className="h-4 w-4" />
                  <SelectValue />
                </div>
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

          {/* Recipients */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Recipients
              {selectedRecipients.length > 0 && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({selectedRecipients.length} selected)
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-2">
              {otherUsers.map((user) => (
                <Badge
                  key={user.id}
                  variant={selectedRecipients.includes(user.id) ? "default" : "outline"}
                  className="cursor-pointer transition-colors"
                  onClick={() => toggleRecipient(user.id)}
                >
                  {user.name}
                  {selectedRecipients.includes(user.id) && (
                    <X className="h-3 w-3 ml-1" />
                  )}
                </Badge>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tags</label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={selectedTags.includes(tag.name) ? "default" : "secondary"}
                  className="cursor-pointer transition-colors"
                  onClick={() => toggleTag(tag.name)}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Rich Text Content */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Content</label>
            <RichTextEditor
              content={body}
              onChange={setBody}
              placeholder="Write your memo content... Use the toolbar for formatting."
              minHeight="200px"
            />
          </div>

          {/* References */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">References</label>
            <div className="flex items-center gap-2 flex-wrap">
              <MemoReferencePicker
                onSelect={(id) => setReferencedMemoIds(prev => [...prev, id])}
                selectedIds={referencedMemoIds}
              />
              {referencedMemoIds.map(refId => {
                const ref = getMemoById(refId);
                return (
                  <Badge key={refId} variant="outline" className="gap-1">
                    <FileText className="h-3 w-3" />
                    {ref?.title || refId}
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() => setReferencedMemoIds(prev => prev.filter(id => id !== refId))}
                    />
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
            <Button variant="outline" onClick={() => navigate("/memos")}>
              Cancel
            </Button>
            <Button onClick={handleSend} className="gap-2">
              <Send className="h-4 w-4" />
              Send Memo
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Compose;
