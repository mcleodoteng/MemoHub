import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMemos } from "@/context/MemoContext";
import { getUserById, getUserInitials, currentUser } from "@/data/mock";
import { UserHoverCard } from "@/components/user/UserHoverCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MemoActions, StatusTracker } from "@/components/memo/MemoActions";
import { MemoEditDialog } from "@/components/memo/MemoEditDialog";
import { MemoEditHistory } from "@/components/memo/MemoEditHistory";
import { MentionInput } from "@/components/editor/MentionInput";
import { AttachmentViewer } from "@/components/attachment/AttachmentManager";
import {
  Globe, Lock, Shield, Pin, Archive, Trash2,
  ArrowLeft, FileText, Edit3, Send,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

const visConfig = {
  public: { icon: Globe, label: "Public", className: "visibility-public" },
  private: { icon: Lock, label: "Private", className: "visibility-private" },
  protected: { icon: Shield, label: "Protected", className: "visibility-protected" },
};

const MemoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [replyText, setReplyText] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const { getMemoById, getCommentsByMemoId, togglePin, toggleArchive, deleteMemo, addComment, addReaction, updateMemo } = useMemos();

  const memo = getMemoById(id || "");

  if (!memo) {
    return (
      <AppLayout title="Memo Not Found">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">Memo not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/memos")}>Back to Memos</Button>
        </div>
      </AppLayout>
    );
  }

  const creator = getUserById(memo.creatorId);
  const vis = visConfig[memo.visibility];
  const VisIcon = vis.icon;
  const memoComments = getCommentsByMemoId(memo.id);
  const isCreator = memo.creatorId === currentUser.id;
  const isDraft = memo.status === 'draft';

  const handleReply = () => {
    if (!replyText.trim()) return;
    addComment(memo.id, replyText, currentUser.id);
    setReplyText("");
    toast.success("Comment added!");
  };

  const handleSendDraft = () => {
    updateMemo(memo.id, { status: 'sent' });
    toast.success("Memo sent!");
  };

  return (
    <AppLayout title="">
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/memos")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Memos
        </Button>

        {/* Draft banner */}
        {isDraft && isCreator && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <Badge variant="outline" className="text-warning border-warning/30">Draft</Badge>
            <span className="text-sm text-muted-foreground flex-1">This memo hasn't been sent yet.</span>
            <Button size="sm" onClick={handleSendDraft} className="gap-1.5">
              <Send className="h-3.5 w-3.5" /> Send Now
            </Button>
          </div>
        )}

        {/* Main Card */}
        <div className="widget-card space-y-4">
          <div className="flex items-start gap-3">
            {creator ? (
              <UserHoverCard user={creator}>
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {getUserInitials(creator.name)}
                  </AvatarFallback>
                </Avatar>
              </UserHoverCard>
            ) : (
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">?</AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {creator ? (
                  <UserHoverCard user={creator}>
                    <span className="font-semibold cursor-pointer hover:underline">{creator.name}</span>
                  </UserHoverCard>
                ) : (
                  <span className="font-semibold">Unknown</span>
                )}
                <span className={`flex items-center gap-1 text-xs ${vis.className}`}>
                  <VisIcon className="h-3 w-3" /> {vis.label}
                </span>
                {memo.pinned && <Pin className="h-3 w-3 text-warning" />}
                {memo.archived && <Badge variant="secondary" className="text-[10px]">Archived</Badge>}
                {isDraft && <Badge variant="outline" className="text-[10px] text-warning border-warning/30">Draft</Badge>}
                {memo.editHistory.length > 0 && (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">Edited</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(memo.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            <div className="flex gap-1">
              {isCreator && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)}>
                  <Edit3 className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className={`h-8 w-8 ${memo.pinned ? 'text-warning' : ''}`}
                onClick={() => { togglePin(memo.id); toast.success(memo.pinned ? 'Unpinned' : 'Pinned!'); }}>
                <Pin className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => { toggleArchive(memo.id); toast.success(memo.archived ? 'Unarchived' : 'Archived!'); }}>
                <Archive className="h-4 w-4" />
              </Button>
              {isCreator && (
                <Button variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => { deleteMemo(memo.id); toast.success('Memo deleted!'); navigate('/memos'); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>

          {/* Recipients */}
          {memo.recipientIds.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">To:</span>
              {memo.recipientIds.map(uid => {
                const user = getUserById(uid);
                return user ? (
                  <UserHoverCard key={uid} user={user}>
                    <Badge variant="secondary" className="gap-1 text-xs cursor-pointer">
                      <Avatar className="h-4 w-4">
                        <AvatarFallback className="text-[7px] bg-primary/10 text-primary">
                          {getUserInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      {user.name}
                    </Badge>
                  </UserHoverCard>
                ) : null;
              })}
            </div>
          )}

          <div>
            <h2 className="font-display text-xl font-bold">{memo.title}</h2>
            {memo.body.startsWith('<') ? (
              <div className="text-sm text-muted-foreground mt-2 leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: memo.body }} />
            ) : (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{memo.body}</p>
            )}
          </div>

          {memo.tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {memo.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
            </div>
          )}

          <AttachmentViewer attachments={memo.attachments} />

          {memo.reactions.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {memo.reactions.map(r => {
                const isActive = r.users.includes(currentUser.id);
                return (
                  <Button key={r.emoji} variant={isActive ? "secondary" : "outline"} size="sm" className="gap-1 h-7 text-xs"
                    onClick={() => addReaction(memo.id, r.emoji, currentUser.id)}>
                    {r.emoji} {r.users.length}
                  </Button>
                );
              })}
            </div>
          )}

          {memo.referencedMemoIds.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <FileText className="h-3 w-3" /> References:
              {memo.referencedMemoIds.map(refId => {
                const ref = getMemoById(refId);
                return (
                  <span key={refId} className="text-primary cursor-pointer hover:underline" onClick={() => navigate(`/memos/${refId}`)}>
                    {ref?.title || refId}
                  </span>
                );
              })}
            </div>
          )}

          {!isDraft && (
            <div className="pt-2 border-t">
              <MemoActions memoId={memo.id} />
            </div>
          )}
        </div>

        {!isDraft && <StatusTracker memoId={memo.id} />}

        <MemoEditHistory history={memo.editHistory} />

        {/* Comments */}
        {!isDraft && (
          <div className="widget-card">
            <h3 className="font-display font-semibold mb-3">Comments ({memoComments.length})</h3>
            <div className="space-y-4">
              {memoComments.map(comment => {
                const author = getUserById(comment.authorId);
                return (
                  <div key={comment.id} className="flex gap-3 animate-slide-in">
                    {author ? (
                      <UserHoverCard user={author}>
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                            {getUserInitials(author.name)}
                          </AvatarFallback>
                        </Avatar>
                      </UserHoverCard>
                    ) : (
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">?</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {author ? (
                          <UserHoverCard user={author}>
                            <span className="text-sm font-medium cursor-pointer hover:underline">{author.name}</span>
                          </UserHoverCard>
                        ) : (
                          <span className="text-sm font-medium">Unknown</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm mt-0.5">{comment.body}</p>
                      {comment.reactions.length > 0 && (
                        <div className="flex gap-1.5 mt-1">
                          {comment.reactions.map(r => (
                            <span key={r.emoji} className="text-xs bg-secondary px-1.5 py-0.5 rounded-full">{r.emoji} {r.users.length}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="space-y-2 pt-2 border-t">
                <MentionInput value={replyText} onChange={setReplyText} placeholder="Write a comment... (type @ to mention)" rows={2} />
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleReply} disabled={!replyText.trim()}>Reply</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isCreator && <MemoEditDialog memo={memo} open={editOpen} onOpenChange={setEditOpen} />}
    </AppLayout>
  );
};

export default MemoDetail;
