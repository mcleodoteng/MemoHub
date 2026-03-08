import { useParams, useNavigate, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMemos } from "@/context/MemoContext";
import { getUserById, getUserInitials, currentUser } from "@/data/mock";
import { UserHoverCard } from "@/components/user/UserHoverCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MemoEditDialog } from "@/components/memo/MemoEditDialog";
import { MemoEditHistory } from "@/components/memo/MemoEditHistory";
import { MemoActivityLog } from "@/components/memo/MemoActivityLog";
import { MentionInput } from "@/components/editor/MentionInput";
import { MentionText, processMentionsInHtml } from "@/components/shared/MentionText";
import { AttachmentViewer } from "@/components/attachment/AttachmentManager";
import {
  Globe, Lock, Shield, Pin, Archive, Trash2, EyeOff,
  ArrowLeft, FileText, Edit3, Send,
  CheckCircle2, ThumbsUp, XCircle, Smile,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow, format } from "date-fns";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const visConfig = {
  public: { icon: Globe, label: "Public", className: "visibility-public" },
  private: { icon: Lock, label: "Private", className: "visibility-private" },
  protected: { icon: Shield, label: "Protected", className: "visibility-protected" },
};

const quickEmojis = ['👍', '❤️', '🎉', '🚀', '👏', '😊', '🔥', '💯'];

const MemoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [replyText, setReplyText] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const {
    getMemoById, getCommentsByMemoId, togglePin, toggleArchive, deleteMemo,
    hideMemo, addComment, addReaction, updateMemo, markOpened,
    acknowledgeMemo, unacknowledgeMemo, approveMemo, unapproveMemo,
  } = useMemos();

  const memo = getMemoById(id || "");

  useEffect(() => {
    if (memo && memo.status !== 'draft') {
      const isRecipient = memo.recipientIds.includes(currentUser.id);
      if (isRecipient) {
        const status = memo.recipientStatuses.find(s => s.userId === currentUser.id);
        if (status && !status.opened) {
          markOpened(memo.id, currentUser.id);
        }
      }
    }
  }, [memo?.id]);

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
  const isAdmin = currentUser.role === 'admin';
  const isDraft = memo.status === 'draft';
  const myStatus = memo.recipientStatuses.find(s => s.userId === currentUser.id);
  const isRecipient = memo.recipientIds.includes(currentUser.id);

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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={() => navigate("/memos")} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Memos
            </Button>
          </TooltipTrigger>
          <TooltipContent>Return to memos list</TooltipContent>
        </Tooltip>

        {isDraft && isCreator && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <Badge variant="outline" className="text-warning border-warning/30">Draft</Badge>
            <span className="text-sm text-muted-foreground flex-1">This memo hasn't been sent yet.</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={() => navigate(`/compose/${memo.id}`)} className="gap-1.5">
                  <Edit3 className="h-3.5 w-3.5" /> Edit Draft
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open draft in compose editor</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" onClick={handleSendDraft} className="gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Send Now
                </Button>
              </TooltipTrigger>
              <TooltipContent>Send this memo to all recipients</TooltipContent>
            </Tooltip>
          </div>
        )}

        <div className="widget-card space-y-4">
          <div className="flex items-start gap-3">
            {creator ? (
              <UserHoverCard user={creator}>
                <Avatar className="h-10 w-10 cursor-pointer" onClick={() => navigate(`/profile/${creator.id}`)}>
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
                    <span className="font-semibold cursor-pointer hover:underline" onClick={() => navigate(`/profile/${creator.id}`)}>
                      {creator.name}
                    </span>
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
              {isCreator && !isDraft && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit this memo</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className={`h-8 w-8 ${memo.pinned ? 'text-warning' : ''}`}
                    onClick={() => { togglePin(memo.id); toast.success(memo.pinned ? 'Unpinned' : 'Pinned!'); }}>
                    <Pin className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{memo.pinned ? "Unpin memo" : "Pin memo to top"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => { toggleArchive(memo.id); toast.success(memo.archived ? 'Unarchived' : 'Archived!'); }}>
                    <Archive className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{memo.archived ? "Unarchive memo" : "Archive memo"}</TooltipContent>
              </Tooltip>
              {!isCreator && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => { hideMemo(memo.id, currentUser.id); toast.success('Hidden from feed'); navigate('/memos'); }}>
                      <EyeOff className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Hide memo from your feed</TooltipContent>
                </Tooltip>
              )}
              {isCreator && (
                <AlertDialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Delete memo</TooltipContent>
                  </Tooltip>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this memo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This memo will be moved to the Trash. You can restore it later from the Deleted tab.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => { deleteMemo(memo.id); toast.success('Memo moved to trash'); navigate('/memos'); }}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {memo.recipientIds.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">To:</span>
              {memo.recipientIds.map(uid => {
                const user = getUserById(uid);
                return user ? (
                  <UserHoverCard key={uid} user={user}>
                    <Badge variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => navigate(`/profile/${uid}`)}>
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
              <div
                className="text-sm text-muted-foreground mt-2 leading-relaxed prose prose-sm max-w-none [&_a]:text-primary [&_a]:underline [&_a]:cursor-pointer"
                dangerouslySetInnerHTML={{ __html: processMentionsInHtml(memo.body) }}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.tagName === 'A') {
                    const href = target.getAttribute('href');
                    if (href && href.startsWith('/profile/')) {
                      e.preventDefault();
                      navigate(href);
                    }
                  }
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                <MentionText text={memo.body} />
              </p>
            )}
          </div>

          {memo.tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {memo.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
            </div>
          )}

          <AttachmentViewer attachments={memo.attachments} />

          {/* Reactions */}
          <div className="flex items-center gap-2 flex-wrap">
            {memo.reactions.map(r => {
              const isActive = r.users.includes(currentUser.id);
              return (
                <Tooltip key={r.emoji}>
                  <TooltipTrigger asChild>
                    <Button variant={isActive ? "secondary" : "outline"} size="sm" className="gap-1 h-7 text-xs"
                      onClick={() => addReaction(memo.id, r.emoji, currentUser.id)}>
                      {r.emoji} {r.users.length}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isActive ? "Remove reaction" : "Add reaction"}</TooltipContent>
                </Tooltip>
              );
            })}
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <Smile className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Add reaction</TooltipContent>
              </Tooltip>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="flex gap-1">
                  {quickEmojis.map(emoji => (
                    <button key={emoji} className="h-8 w-8 flex items-center justify-center rounded hover:bg-secondary transition-colors text-lg"
                      onClick={() => addReaction(memo.id, emoji, currentUser.id)}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

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

          {/* Acknowledge/Approve actions for recipients */}
          {!isDraft && isRecipient && !isCreator && myStatus && (
            <div className="flex items-center gap-2 pt-3 border-t">
              {myStatus.acknowledged ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="secondary" size="sm" className="gap-1.5 h-8 text-xs"
                      onClick={() => { unacknowledgeMemo(memo.id, currentUser.id); toast.success('Unacknowledged'); }}>
                      <XCircle className="h-3.5 w-3.5" /> Unacknowledge
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Remove your acknowledgment from this memo</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
                      onClick={() => { acknowledgeMemo(memo.id, currentUser.id); toast.success('Acknowledged!'); }}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledge
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Acknowledge that you've read this memo</TooltipContent>
                </Tooltip>
              )}
              {myStatus.approved ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="secondary" size="sm" className="gap-1.5 h-8 text-xs"
                      onClick={() => { unapproveMemo(memo.id, currentUser.id); toast.success('Unapproved'); }}>
                      <XCircle className="h-3.5 w-3.5" /> Unapprove
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Remove your approval from this memo</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"
                      onClick={() => { approveMemo(memo.id, currentUser.id); toast.success('Approved!'); }}>
                      <ThumbsUp className="h-3.5 w-3.5" /> Approve
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Approve this memo's content or request</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        {/* Status Tracker */}
        {!isDraft && (
          <div className="widget-card">
            <h3 className="font-display font-semibold mb-4">Recipient Status</h3>
            <div className="space-y-2.5">
              {memo.recipientStatuses.map((status) => {
                const user = getUserById(status.userId);
                return (
                  <div key={status.userId} className="flex items-center gap-3">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                        {user ? getUserInitials(user.name) : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium min-w-[110px]">{user?.name}</span>
                    <div className="flex gap-1.5 flex-wrap">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={status.opened ? 'status-badge-opened' : 'status-badge opacity-30'}>Opened</span>
                        </TooltipTrigger>
                        <TooltipContent>{status.opened ? `Opened ${status.openedAt ? formatDistanceToNow(new Date(status.openedAt), { addSuffix: true }) : ''}` : 'Not yet opened'}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={status.acknowledged ? 'status-badge-acknowledged' : 'status-badge opacity-30'}>Acknowledged</span>
                        </TooltipTrigger>
                        <TooltipContent>{status.acknowledged ? 'Acknowledged' : 'Not yet acknowledged'}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={status.approved ? 'status-badge-approved' : 'status-badge opacity-30'}>Approved</span>
                        </TooltipTrigger>
                        <TooltipContent>{status.approved ? 'Approved' : 'Not yet approved'}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={status.replied ? 'status-badge-replied' : 'status-badge opacity-30'}>Replied</span>
                        </TooltipTrigger>
                        <TooltipContent>{status.replied ? 'Replied' : 'Not yet replied'}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <MemoEditHistory history={memo.editHistory} />
        <MemoActivityLog activityLog={memo.activityLog || []} />

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
                        <Avatar className="h-7 w-7 shrink-0 cursor-pointer" onClick={() => navigate(`/profile/${author.id}`)}>
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
                            <span className="text-sm font-medium cursor-pointer hover:underline" onClick={() => navigate(`/profile/${author.id}`)}>
                              {author.name}
                            </span>
                          </UserHoverCard>
                        ) : (
                          <span className="text-sm font-medium">Unknown</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm mt-0.5"><MentionText text={comment.body} /></p>
                    </div>
                  </div>
                );
              })}
              <div className="space-y-2 pt-2 border-t">
                <MentionInput value={replyText} onChange={setReplyText} placeholder="Write a comment... (type @ to mention)" rows={2} />
                <div className="flex justify-end">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" onClick={handleReply} disabled={!replyText.trim()}>Reply</Button>
                    </TooltipTrigger>
                    <TooltipContent>Post your comment</TooltipContent>
                  </Tooltip>
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
