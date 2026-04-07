import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { AttachmentUploader } from "@/components/attachment/AttachmentManager";
import { MemoReferencePicker } from "@/components/memo/MemoReferencePicker";
import { UserHoverCard } from "@/components/user/UserHoverCard";
import { MemoVisibility, Memo, Attachment } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useTags } from "@/context/TagContext";
import { useUsers } from "@/context/UserContext";
import { getUserInitials } from "@/lib/user-utils";
import { Globe, Lock, Shield, Save, X, FileText } from "lucide-react";
import { useMemos } from "@/context/MemoContext";
import { toast } from "sonner";

interface MemoEditDialogProps {
  memo: Memo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MemoEditDialog({
  memo,
  open,
  onOpenChange,
}: MemoEditDialogProps) {
  const { currentUser } = useAuth();
  const { tags: tagOptions, refreshTags } = useTags();
  const { users: allUsers, getUserById } = useUsers();
  const { editMemo, getMemoById } = useMemos();
  const [title, setTitle] = useState(memo.title);
  const [body, setBody] = useState(memo.body);
  const [visibility, setVisibility] = useState<MemoVisibility>(memo.visibility);
  const [selectedTags, setSelectedTags] = useState<string[]>(memo.tags);
  const [attachments, setAttachments] = useState<Attachment[]>(
    memo.attachments,
  );
  const [recipientIds, setRecipientIds] = useState<string[]>(memo.recipientIds);
  const [referencedMemoIds, setReferencedMemoIds] = useState<string[]>(
    memo.referencedMemoIds,
  );
  const [customTagInput, setCustomTagInput] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");

  const otherUsers = allUsers.filter((u) => u.id !== currentUser?.id);
  const filteredUsers = otherUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(recipientSearch.toLowerCase()),
  );

  const availableTags = useMemo(() => tagOptions, [tagOptions]);

  const toggleTag = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName)
        : [...prev, tagName],
    );
  };

  const toggleRecipient = (userId: string) => {
    setRecipientIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const addCustomTag = () => {
    const tag = customTagInput.trim();
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags((prev) => [...prev, tag]);
      setCustomTagInput("");
    }
  };

  const handleSave = () => {
    editMemo(
      memo.id,
      {
        title,
        body,
        tags: selectedTags,
        visibility,
        attachments,
        recipientIds,
        referencedMemoIds,
      },
      currentUser.id,
    );
    toast.success("Memo updated successfully!");
    void refreshTags();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Edit Memo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-display"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Visibility
            </label>
            <Select
              value={visibility}
              onValueChange={(v) => setVisibility(v as MemoVisibility)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <span className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5" /> Public
                  </span>
                </SelectItem>
                <SelectItem value="private">
                  <span className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" /> Private
                  </span>
                </SelectItem>
                <SelectItem value="protected">
                  <span className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5" /> Protected
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recipients */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Recipients ({recipientIds.length})
            </label>
            <Input
              placeholder="Search recipients..."
              value={recipientSearch}
              onChange={(e) => setRecipientSearch(e.target.value)}
              className="mb-2 h-8 text-sm"
            />
            {recipientIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {recipientIds.map((uid) => {
                  const user = getUserById(uid);
                  return user ? (
                    <Badge
                      key={uid}
                      variant="default"
                      className="gap-1 cursor-pointer"
                      onClick={() => toggleRecipient(uid)}
                    >
                      <Avatar className="h-4 w-4">
                        <AvatarFallback className="text-[7px] bg-primary-foreground/20 text-primary-foreground">
                          {getUserInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      {user.name}
                      <X className="h-3 w-3 ml-0.5" />
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
            <div className="flex flex-wrap gap-2 max-h-24 overflow-auto">
              {filteredUsers
                .filter((u) => !recipientIds.includes(u.id))
                .map((user) => (
                  <Badge
                    key={user.id}
                    variant="outline"
                    className="cursor-pointer gap-1.5"
                    onClick={() => toggleRecipient(user.id)}
                  >
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-[7px] bg-secondary text-secondary-foreground">
                        {getUserInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    {user.name}
                  </Badge>
                ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {availableTags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={
                    selectedTags.includes(tag.name) ? "default" : "secondary"
                  }
                  className="cursor-pointer transition-colors"
                  onClick={() => toggleTag(tag.name)}
                >
                  {tag.name}
                  {selectedTags.includes(tag.name) && (
                    <X className="h-3 w-3 ml-1" />
                  )}
                </Badge>
              ))}
              {selectedTags
                .filter((t) => !availableTags.some((pt) => pt.name === t))
                .map((tag) => (
                  <Badge
                    key={tag}
                    variant="default"
                    className="cursor-pointer"
                    onClick={() => toggleTag(tag)}
                  >
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
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addCustomTag())
                }
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={addCustomTag}
                disabled={!customTagInput.trim()}
              >
                Add
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Content</label>
            <RichTextEditor
              content={body}
              onChange={setBody}
              placeholder="Edit memo content..."
              minHeight="150px"
            />
          </div>

          {/* References */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              References
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <MemoReferencePicker
                onSelect={(id) => setReferencedMemoIds((prev) => [...prev, id])}
                selectedIds={referencedMemoIds}
              />
              {referencedMemoIds.map((refId) => {
                const ref = getMemoById(refId);
                return (
                  <Badge key={refId} variant="outline" className="gap-1">
                    <FileText className="h-3 w-3" />
                    {ref?.title || refId}
                    <X
                      className="h-3 w-3 ml-1 cursor-pointer"
                      onClick={() =>
                        setReferencedMemoIds((prev) =>
                          prev.filter((id) => id !== refId),
                        )
                      }
                    />
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Attachments */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Attachments
            </label>
            <AttachmentUploader
              attachments={attachments}
              onAdd={(newAtts) =>
                setAttachments((prev) => [...prev, ...newAtts])
              }
              onRemove={(id) =>
                setAttachments((prev) => prev.filter((a) => a.id !== id))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
