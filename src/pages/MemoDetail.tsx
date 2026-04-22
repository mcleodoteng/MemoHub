import { useParams, useNavigate, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMemos } from "@/context/MemoContext";
import { useGroups } from "@/context/GroupContext";
import { useSocket } from "@/context/SocketContext";
import { useUsers } from "@/context/UserContext";
import { useAuth } from "@/context/AuthContext";
import { useOnlineStatuses } from "@/hooks/useOnlineStatus";
import { getUserInitials } from "@/lib/user-utils";
import { UserHoverCard } from "@/components/user/UserHoverCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MemoEditDialog } from "@/components/memo/MemoEditDialog";
import { MemoEditHistory } from "@/components/memo/MemoEditHistory";
import { MemoActivityLog } from "@/components/memo/MemoActivityLog";
import { MentionInput } from "@/components/editor/MentionInput";
import { MentionText, MentionHtml } from "@/components/shared/MentionText";
import {
  AttachmentViewer,
  AttachmentUploader,
} from "@/components/attachment/AttachmentManager";
import { WorkflowStatus } from "@/components/memo/WorkflowStatus";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Globe,
  Lock,
  Shield,
  Pin,
  Archive,
  Trash2,
  EyeOff,
  ArrowLeft,
  FileText,
  Edit3,
  Send,
  CheckCircle2,
  ThumbsUp,
  XCircle,
  Smile,
  Star,
  MoreHorizontal,
  Pencil,
  X,
  Check,
  Reply,
  Paperclip,
  ArrowUpDown,
  Clock,
  ArrowUp,
  ArrowDown,
  Heart,
  Search,
  Users,
  Printer,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDistanceToNow, format } from "date-fns";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useNotifications } from "@/context/NotificationContext";
import { useRoles } from "@/context/RoleContext";
import { Attachment } from "@/types";
import { memoPath } from "@/lib/memo-url";
import { printMemo } from "@/lib/reports-print";

const visConfig = {
  public: { icon: Globe, label: "Public", className: "visibility-public" },
  private: { icon: Lock, label: "Private", className: "visibility-private" },
  protected: {
    icon: Shield,
    label: "Protected",
    className: "visibility-protected",
  },
};

const quickEmojis = ["👍", "❤️", "🎉", "🚀", "👏", "😊", "🔥", "💯"];
const MAX_REPLY_INDENT_DEPTH = 3;
const COMMENT_BODY_MAX_LENGTH = 10000;

const MemoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { hasPermission } = useRoles();
  const { getGroupById } = useGroups();
  const { socket, joinRoom, leaveRoom, onEvent, offEvent } = useSocket();
  const { getUserById } = useUsers();
  const { getUserStatus } = useOnlineStatuses();
  const [replyText, setReplyText] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(
    null,
  );
  const [threadReplyText, setThreadReplyText] = useState("");
  const [commentAttachments, setCommentAttachments] = useState<Attachment[]>(
    [],
  );
  const [threadAttachments, setThreadAttachments] = useState<Attachment[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const memoTypingTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const localTypingStopTimer = useRef<NodeJS.Timeout | null>(null);
  const [commentSort, setCommentSort] = useState<
    "newest" | "oldest" | "reactions"
  >("oldest");
  const [commentSearch, setCommentSearch] = useState("");
  const {
    getMemoById,
    getCommentsByMemoId,
    togglePin,
    toggleArchive,
    deleteMemo,
    hideMemo,
    addComment,
    addReaction,
    updateMemo,
    markOpened,
    acknowledgeMemo,
    unacknowledgeMemo,
    approveMemo,
    unapproveMemo,
    toggleStar,
    editComment,
    deleteComment,
    addCommentReaction,
    toggleCommentPin,
    approveWorkflowStep,
  } = useMemos();
  const { notifyMentions } = useNotifications();

  const memo = getMemoById(id || "");

  useEffect(() => {
    if (!memo || !id || !memo.slug) return;
    if (id !== memo.slug) {
      navigate(memoPath(memo), { replace: true });
    }
  }, [id, memo?.id, memo?.slug, navigate]);

  useEffect(() => {
    if (memo && memo.status !== "draft") {
      const isRecipient = memo.recipientIds.includes(currentUser.id);
      if (isRecipient) {
        const status = memo.recipientStatuses.find(
          (s) => s.userId === currentUser.id,
        );
        if (status && !status.opened) {
          markOpened(memo.id, currentUser.id);
        }
      }
    }
  }, [memo?.id]);

  // Real-time typing indicator
  useEffect(() => {
    if (!socket || !memo || memo.status === "draft") return;

    joinRoom(`memo_${memo.id}`);

    const handleMemoTyping = (data: { memoId: string; userId: string }) => {
      if (data.memoId !== memo.id || data.userId === currentUser.id) return;
      setTypingUsers((prev) => [...new Set([...prev, data.userId])]);

      const timerKey = `${data.memoId}:${data.userId}`;
      if (memoTypingTimers.current[timerKey])
        clearTimeout(memoTypingTimers.current[timerKey]);
      memoTypingTimers.current[timerKey] = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((id) => id !== data.userId));
      }, 3000);
    };

    const handleMemoStoppedTyping = (data: {
      memoId: string;
      userId: string;
    }) => {
      if (data.memoId !== memo.id) return;
      setTypingUsers((prev) => prev.filter((id) => id !== data.userId));
    };

    onEvent("memo_user_typing", handleMemoTyping);
    onEvent("memo_user_stopped_typing", handleMemoStoppedTyping);

    return () => {
      leaveRoom(`memo_${memo.id}`);
      offEvent("memo_user_typing");
      offEvent("memo_user_stopped_typing");
      Object.values(memoTypingTimers.current).forEach((timer) =>
        clearTimeout(timer),
      );
      memoTypingTimers.current = {};
      setTypingUsers([]);
    };
  }, [
    socket,
    memo?.id,
    memo?.status,
    currentUser.id,
    joinRoom,
    leaveRoom,
    onEvent,
    offEvent,
  ]);

  const emitMemoTyping = useCallback(() => {
    if (!socket || !memo || memo.status === "draft") return;
    socket.emit("memo_typing_start", { memoId: memo.id });
    if (localTypingStopTimer.current)
      clearTimeout(localTypingStopTimer.current);
    localTypingStopTimer.current = setTimeout(() => {
      socket.emit("memo_typing_stop", { memoId: memo.id });
    }, 1200);
  }, [socket, memo?.id, memo?.status]);

  if (!memo) {
    return (
      <AppLayout title="Memo Not Found">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">Memo not found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate("/memos")}
          >
            Back to Memos
          </Button>
        </div>
      </AppLayout>
    );
  }

  const creator = getUserById(memo.creatorId);
  const sourceGroup = memo.groupId ? getGroupById(memo.groupId) : undefined;
  const vis = visConfig[memo.visibility];
  const VisIcon = vis.icon;
  const memoComments = getCommentsByMemoId(memo.id);
  const searchLower = commentSearch.toLowerCase().trim();
  const commentsByParentId = memoComments.reduce<Record<string, string[]>>(
    (acc, comment) => {
      const key = comment.parentId || "root";
      acc[key] = acc[key] || [];
      acc[key].push(comment.id);
      return acc;
    },
    {},
  );

  const commentsById = memoComments.reduce<
    Record<string, import("@/types").Comment>
  >((acc, comment) => {
    acc[comment.id] = comment;
    return acc;
  }, {});

  const matchesSearch = (c: import("@/types").Comment) => {
    if (!searchLower) return true;
    const author = getUserById(c.authorId);
    return (
      c.body.toLowerCase().includes(searchLower) ||
      (author?.name.toLowerCase().includes(searchLower) ?? false)
    );
  };

  const hasMatchingDescendant = (commentId: string): boolean => {
    const childIds = commentsByParentId[commentId] || [];
    for (const childId of childIds) {
      const child = commentsById[childId];
      if (!child) continue;
      if (matchesSearch(child) || hasMatchingDescendant(child.id)) {
        return true;
      }
    }
    return false;
  };

  const visibleTopLevelComments = memoComments.filter((comment) => {
    if (comment.parentId) return false;
    if (!searchLower) return true;
    return matchesSearch(comment) || hasMatchingDescendant(comment.id);
  });

  const pinnedComments = visibleTopLevelComments.filter(
    (c) => c.pinned && !c.parentId,
  );
  const unpinnedTopLevel = visibleTopLevelComments.filter(
    (c) => !c.pinned && !c.parentId,
  );
  const sortedUnpinned = [...unpinnedTopLevel].sort((a, b) => {
    if (commentSort === "newest")
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (commentSort === "reactions") {
      const aCount = a.reactions.reduce((sum, r) => sum + r.users.length, 0);
      const bCount = b.reactions.reduce((sum, r) => sum + r.users.length, 0);
      return bCount - aCount;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  const topLevelComments = [...pinnedComments, ...sortedUnpinned];

  const visibleCommentIds = new Set<string>();
  const addVisibleBranch = (commentId: string) => {
    visibleCommentIds.add(commentId);
    const childIds = commentsByParentId[commentId] || [];
    childIds.forEach((childId) => {
      const child = commentsById[childId];
      if (!child) return;
      if (
        !searchLower ||
        matchesSearch(child) ||
        hasMatchingDescendant(child.id)
      ) {
        addVisibleBranch(child.id);
      }
    });
  };

  topLevelComments.forEach((comment) => addVisibleBranch(comment.id));
  const renderedComments = memoComments.filter((comment) =>
    visibleCommentIds.has(comment.id),
  );
  const isCreator = memo.creatorId === currentUser.id;
  const isAdmin = currentUser.role === "admin";
  const isDraft = memo.status === "draft";
  const canPinMemo = isCreator || hasPermission("canPinMemos");
  const canArchiveMemo = isCreator || hasPermission("canArchiveMemos");
  const myStatus = memo.recipientStatuses.find(
    (s) => s.userId === currentUser.id,
  );
  const isRecipient = memo.recipientIds.includes(currentUser.id);

  const handleReply = () => {
    if (!replyText.trim() && commentAttachments.length === 0) return;
    if (replyText.trim().length > COMMENT_BODY_MAX_LENGTH) {
      toast.error(
        `Comment is too long. Please keep it under ${COMMENT_BODY_MAX_LENGTH} characters.`,
      );
      return;
    }
    addComment(memo.id, replyText, currentUser.id, commentAttachments);
    socket?.emit("memo_typing_stop", { memoId: memo.id });
    notifyMentions(replyText, memo.title, memoPath(memo), currentUser.id);
    setReplyText("");
    setCommentAttachments([]);
    toast.success("Comment added!");
  };

  const handleThreadReply = (parentId: string) => {
    if (!threadReplyText.trim() && threadAttachments.length === 0) return;
    if (threadReplyText.trim().length > COMMENT_BODY_MAX_LENGTH) {
      toast.error(
        `Comment is too long. Please keep it under ${COMMENT_BODY_MAX_LENGTH} characters.`,
      );
      return;
    }
    addComment(
      memo.id,
      threadReplyText,
      currentUser.id,
      threadAttachments,
      parentId,
    );
    socket?.emit("memo_typing_stop", { memoId: memo.id });
    notifyMentions(threadReplyText, memo.title, memoPath(memo), currentUser.id);
    setThreadReplyText("");
    setThreadAttachments([]);
    setReplyingToCommentId(null);
    toast.success("Reply added!");
  };

  const handleSendDraft = () => {
    updateMemo(memo.id, { status: "sent" });
    toast.success("Memo sent!");
  };

  return (
    <AppLayout title="">
      <div className="max-w-3xl mx-auto space-y-6">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/memos")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Memos
            </Button>
          </TooltipTrigger>
          <TooltipContent>Return to memos list</TooltipContent>
        </Tooltip>

        {isDraft && isCreator && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <Badge variant="outline" className="text-warning border-warning/30">
              Draft
            </Badge>
            <span className="text-sm text-muted-foreground flex-1">
              This memo hasn't been sent yet.
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/compose/${memo.id}`)}
                  className="gap-1.5"
                >
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
                <Avatar
                  className="h-10 w-10 cursor-pointer"
                  onClick={() => navigate(`/profile/${creator.id}`)}
                >
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {getUserInitials(creator.name)}
                  </AvatarFallback>
                </Avatar>
              </UserHoverCard>
            ) : (
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  ?
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {creator ? (
                  <UserHoverCard user={creator}>
                    <span
                      className="font-semibold cursor-pointer hover:underline"
                      onClick={() => navigate(`/profile/${creator.id}`)}
                    >
                      {creator.name}
                    </span>
                  </UserHoverCard>
                ) : (
                  <span className="font-semibold">Unknown</span>
                )}
                <span
                  className={`flex items-center gap-1 text-xs ${vis.className}`}
                >
                  <VisIcon className="h-3 w-3" /> {vis.label}
                </span>
                {memo.pinned && <Pin className="h-3 w-3 text-warning" />}
                {memo.archived && (
                  <Badge variant="secondary" className="text-[10px]">
                    Archived
                  </Badge>
                )}
                {isDraft && (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-warning border-warning/30"
                  >
                    Draft
                  </Badge>
                )}
                {sourceGroup && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 gap-1 border-primary/30 text-primary bg-primary/10"
                  >
                    <Users className="h-2.5 w-2.5" />
                    {sourceGroup.name}
                  </Badge>
                )}
                {memo.editHistory.length > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-muted-foreground"
                  >
                    Edited
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(memo.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            <div className="flex gap-1 flex-wrap justify-end shrink-0">
              {(() => {
                const isStarred = (memo.starredBy || []).includes(
                  currentUser.id,
                );
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${isStarred ? "text-yellow-500" : ""}`}
                        onClick={() => {
                          toggleStar(memo.id, currentUser.id);
                        }}
                      >
                        <Star
                          className={`h-4 w-4 ${isStarred ? "fill-yellow-500" : ""}`}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isStarred ? "Unstar memo" : "Star memo"}
                    </TooltipContent>
                  </Tooltip>
                );
              })()}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      printMemo(memo, getUserById, memoComments);
                    }}
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Print memo</TooltipContent>
              </Tooltip>
              {isCreator && !isDraft && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditOpen(true)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit this memo</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${memo.pinned ? "text-warning" : ""}`}
                    onClick={async () => {
                      try {
                        await togglePin(memo.id);
                      } catch {
                        // error handled in context
                      }
                    }}
                    disabled={!canPinMemo}
                  >
                    <Pin className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {canPinMemo
                    ? memo.pinned
                      ? "Unpin memo"
                      : "Pin memo to top"
                    : "Insufficient permissions"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={async () => {
                      try {
                        await toggleArchive(memo.id);
                      } catch {
                        // error handled in context
                      }
                    }}
                    disabled={!canArchiveMemo}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {canArchiveMemo
                    ? memo.archived
                      ? "Unarchive memo"
                      : "Archive memo"
                    : "Insufficient permissions"}
                </TooltipContent>
              </Tooltip>
              {!isCreator && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        hideMemo(memo.id, currentUser.id);
                        navigate("/memos");
                      }}
                    >
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
                        This memo will be moved to the Trash. You can restore it
                        later from the Deleted tab.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => {
                          deleteMemo(memo.id);
                          navigate("/memos");
                        }}
                      >
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
              {memo.recipientIds.map((uid) => {
                const user = getUserById(uid);
                const userStatus = getUserStatus(uid);
                return user ? (
                  <UserHoverCard key={uid} user={user}>
                    <Badge
                      variant="secondary"
                      className="gap-1 text-xs cursor-pointer"
                      onClick={() => navigate(`/profile/${uid}`)}
                    >
                      <Avatar className="h-4 w-4">
                        <AvatarFallback className="text-[7px] bg-primary/10 text-primary">
                          {getUserInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${userStatus === "online" ? "bg-success" : userStatus === "away" ? "bg-warning" : "bg-muted-foreground/40"}`}
                      />
                      {user.name}
                    </Badge>
                  </UserHoverCard>
                ) : null;
              })}
            </div>
          )}

          <div>
            <h2 className="font-display text-xl font-bold">{memo.title}</h2>
            {memo.body.startsWith("<") ? (
              <MentionHtml
                className="text-sm text-muted-foreground mt-2 leading-relaxed prose prose-sm max-w-none [&_a]:text-primary [&_a]:underline [&_a]:cursor-pointer"
                html={memo.body}
              />
            ) : (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                <MentionText text={memo.body} />
              </p>
            )}
          </div>

          {memo.tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {memo.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <AttachmentViewer attachments={memo.attachments} />

          {/* Workflow Status */}
          {memo.workflow?.enabled && (
            <WorkflowStatus
              memo={memo}
              currentUserId={currentUser.id}
              onApprove={(stepId, approved, comment) =>
                approveWorkflowStep(
                  memo.id,
                  stepId,
                  currentUser.id,
                  approved,
                  comment,
                )
              }
            />
          )}

          {/* Reactions */}
          <div className="flex items-center gap-2 flex-wrap">
            {memo.reactions.map((r) => {
              const isActive = r.users.includes(currentUser.id);
              return (
                <Tooltip key={r.emoji}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isActive ? "secondary" : "outline"}
                      size="sm"
                      className="gap-1 h-7 text-xs"
                      onClick={() =>
                        addReaction(memo.id, r.emoji, currentUser.id)
                      }
                    >
                      {r.emoji} {r.users.length}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isActive ? "Remove reaction" : "Add reaction"}
                  </TooltipContent>
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
                  {quickEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      className="h-8 w-8 flex items-center justify-center rounded hover:bg-secondary transition-colors text-lg"
                      onClick={() =>
                        addReaction(memo.id, emoji, currentUser.id)
                      }
                    >
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
              {memo.referencedMemoIds.map((refId) => {
                const ref = getMemoById(refId);
                return (
                  <span
                    key={refId}
                    className="text-primary cursor-pointer hover:underline"
                    onClick={() =>
                      navigate(ref ? memoPath(ref) : `/memos/${refId}`)
                    }
                  >
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
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-1.5 h-8 text-xs"
                      onClick={() => {
                        unacknowledgeMemo(memo.id, currentUser.id);
                      }}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Unacknowledge
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Remove your acknowledgment from this memo
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 text-xs"
                      onClick={() => {
                        acknowledgeMemo(memo.id, currentUser.id);
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledge
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Acknowledge that you've read this memo
                  </TooltipContent>
                </Tooltip>
              )}
              {myStatus.approved ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-1.5 h-8 text-xs"
                      onClick={() => {
                        unapproveMemo(memo.id, currentUser.id);
                      }}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Unapprove
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Remove your approval from this memo
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 text-xs"
                      onClick={() => {
                        approveMemo(memo.id, currentUser.id);
                      }}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" /> Approve
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Approve this memo's content or request
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        {/* Status Tracker */}
        {!isDraft && (
          <div className="widget-card">
            <h3 className="font-display font-semibold mb-4">
              Recipient Status
            </h3>
            <div className="space-y-2.5">
              {memo.recipientStatuses.map((status) => {
                const user = getUserById(status.userId);
                const userStatus = getUserStatus(status.userId);
                return (
                  <div key={status.userId} className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                          {user ? getUserInitials(user.name) : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-card ${userStatus === "online" ? "bg-success" : userStatus === "away" ? "bg-warning" : "bg-muted-foreground/40"}`}
                      />
                    </div>
                    <span className="text-sm font-medium min-w-[110px]">
                      {user?.name}
                    </span>
                    <div className="flex gap-1.5 flex-wrap">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={
                              status.opened
                                ? "status-badge-opened"
                                : "status-badge opacity-30"
                            }
                          >
                            Opened
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {status.opened
                            ? `Opened ${status.openedAt ? formatDistanceToNow(new Date(status.openedAt), { addSuffix: true }) : ""}`
                            : "Not yet opened"}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={
                              status.acknowledged
                                ? "status-badge-acknowledged"
                                : "status-badge opacity-30"
                            }
                          >
                            Acknowledged
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {status.acknowledged
                            ? "Acknowledged"
                            : "Not yet acknowledged"}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={
                              status.approved
                                ? "status-badge-approved"
                                : "status-badge opacity-30"
                            }
                          >
                            Approved
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {status.approved ? "Approved" : "Not yet approved"}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={
                              status.replied
                                ? "status-badge-replied"
                                : "status-badge opacity-30"
                            }
                          >
                            Replied
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {status.replied ? "Replied" : "Not yet replied"}
                        </TooltipContent>
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
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold">
                Comments ({memoComments.length})
              </h3>
              <div className="flex items-center gap-1">
                {memoComments.length > 2 && (
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <input
                      type="text"
                      value={commentSearch}
                      onChange={(e) => setCommentSearch(e.target.value)}
                      placeholder="Search comments..."
                      className="h-7 w-40 pl-7 pr-6 text-xs rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    {commentSearch && (
                      <button
                        onClick={() => setCommentSearch("")}
                        aria-label="Clear comment search"
                        title="Clear search"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2"
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>
                )}
                {memoComments.length > 1 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                      >
                        <ArrowUpDown className="h-3 w-3" />
                        {commentSort === "newest"
                          ? "Newest"
                          : commentSort === "reactions"
                            ? "Most reactions"
                            : "Oldest"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setCommentSort("oldest")}
                      >
                        <ArrowUp className="h-3.5 w-3.5 mr-2" /> Oldest first
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setCommentSort("newest")}
                      >
                        <ArrowDown className="h-3.5 w-3.5 mr-2" /> Newest first
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setCommentSort("reactions")}
                      >
                        <Heart className="h-3.5 w-3.5 mr-2" /> Most reactions
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
            {commentSearch && topLevelComments.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No comments matching "{commentSearch}"
              </p>
            )}
            <div className="space-y-4">
              {topLevelComments.map((comment) => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  allComments={renderedComments}
                  navigate={navigate}
                  currentUser={currentUser}
                  editingCommentId={editingCommentId}
                  editingCommentBody={editingCommentBody}
                  setEditingCommentId={setEditingCommentId}
                  setEditingCommentBody={setEditingCommentBody}
                  replyingToCommentId={replyingToCommentId}
                  setReplyingToCommentId={setReplyingToCommentId}
                  threadReplyText={threadReplyText}
                  setThreadReplyText={setThreadReplyText}
                  threadAttachments={threadAttachments}
                  setThreadAttachments={setThreadAttachments}
                  handleThreadReply={handleThreadReply}
                  editComment={editComment}
                  deleteComment={deleteComment}
                  addCommentReaction={addCommentReaction}
                  toggleCommentPin={toggleCommentPin}
                  isMemoCreator={isCreator}
                  quickEmojis={quickEmojis}
                  emitMemoTyping={emitMemoTyping}
                />
              ))}
              {/* Typing indicator */}
              {typingUsers.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                  <div className="flex gap-0.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                  {typingUsers
                    .map((uid) => getUserById(uid)?.name || "Someone")
                    .join(", ")}{" "}
                  {typingUsers.length === 1 ? "is" : "are"} typing...
                </div>
              )}
              <div className="space-y-2 pt-2 border-t">
                <MentionInput
                  value={replyText}
                  onChange={(value) => {
                    setReplyText(value);
                    emitMemoTyping();
                  }}
                  placeholder="Write a comment... (type @ to mention)"
                  rows={2}
                  maxLength={COMMENT_BODY_MAX_LENGTH}
                />
                <p className="text-[11px] text-muted-foreground text-right tabular-nums">
                  {replyText.length}/{COMMENT_BODY_MAX_LENGTH}
                </p>
                <AttachmentUploader
                  attachments={commentAttachments}
                  onAdd={(atts) =>
                    setCommentAttachments((prev) => [...prev, ...atts])
                  }
                  onRemove={(id) =>
                    setCommentAttachments((prev) =>
                      prev.filter((a) => a.id !== id),
                    )
                  }
                  compact
                />
                <div className="flex justify-end">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        onClick={handleReply}
                        disabled={
                          !replyText.trim() && commentAttachments.length === 0
                        }
                      >
                        Reply
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Post your comment</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isCreator && (
        <MemoEditDialog
          memo={memo}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </AppLayout>
  );
};

/* ── Comment Thread Component ── */
interface CommentThreadProps {
  comment: import("@/types").Comment;
  allComments: import("@/types").Comment[];
  navigate: ReturnType<typeof useNavigate>;
  currentUser: import("@/types").User;
  editingCommentId: string | null;
  editingCommentBody: string;
  setEditingCommentId: (id: string | null) => void;
  setEditingCommentBody: (body: string) => void;
  replyingToCommentId: string | null;
  setReplyingToCommentId: (id: string | null) => void;
  threadReplyText: string;
  setThreadReplyText: (text: string) => void;
  threadAttachments: Attachment[];
  setThreadAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  handleThreadReply: (parentId: string) => void;
  editComment: (commentId: string, body: string, userId: string) => void;
  deleteComment: (commentId: string, userId: string) => void;
  addCommentReaction: (
    commentId: string,
    emoji: string,
    userId: string,
  ) => void;
  toggleCommentPin: (commentId: string, userId: string) => void;
  isMemoCreator: boolean;
  quickEmojis: string[];
  emitMemoTyping: () => void;
}

function CommentThread(props: CommentThreadProps) {
  const { comment, allComments, ...rest } = props;

  return (
    <div className="space-y-2">
      <SingleComment comment={comment} {...rest} />
      <ReplyTree
        parentId={comment.id}
        allComments={allComments}
        depth={1}
        {...rest}
      />
    </div>
  );
}

interface ReplyTreeProps extends Omit<CommentThreadProps, "comment"> {
  parentId: string;
  depth: number;
}

function ReplyTree({ parentId, allComments, depth, ...rest }: ReplyTreeProps) {
  const nestedReplies = allComments
    .filter((reply) => reply.parentId === parentId)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  if (nestedReplies.length === 0) return null;

  const indentationClass =
    depth <= MAX_REPLY_INDENT_DEPTH
      ? "ml-8 pl-3 border-l-2 border-border"
      : "ml-2 pl-2 border-l border-border/70";

  return (
    <div className={`${indentationClass} space-y-2`}>
      {nestedReplies.map((reply) => (
        <div key={reply.id} className="space-y-2">
          <SingleComment comment={reply} {...rest} isReply />
          <ReplyTree
            parentId={reply.id}
            allComments={allComments}
            depth={depth + 1}
            {...rest}
          />
        </div>
      ))}
    </div>
  );
}

/* ── Single Comment Component ── */
interface SingleCommentProps extends Omit<
  CommentThreadProps,
  "comment" | "allComments"
> {
  isReply?: boolean;
}

function SingleComment({
  comment,
  navigate,
  currentUser,
  editingCommentId,
  editingCommentBody,
  setEditingCommentId,
  setEditingCommentBody,
  replyingToCommentId,
  setReplyingToCommentId,
  threadReplyText,
  setThreadReplyText,
  threadAttachments,
  setThreadAttachments,
  handleThreadReply,
  editComment,
  deleteComment,
  addCommentReaction,
  toggleCommentPin,
  isMemoCreator,
  quickEmojis,
  emitMemoTyping,
  isReply,
}: SingleCommentProps) {
  const { getUserById } = useUsers();
  const author = getUserById(comment.authorId);
  const isCommentAuthor = comment.authorId === currentUser.id;
  const isEditing = editingCommentId === comment.id;
  const isReplying = replyingToCommentId === comment.id;
  const wasEdited = comment.createdAt !== comment.updatedAt;
  const canPin = isMemoCreator || isCommentAuthor;
  const [deleteCommentOpen, setDeleteCommentOpen] = useState(false);

  return (
    <div
      className={`flex gap-3 animate-slide-in group ${comment.pinned ? "bg-primary/5 rounded-lg p-2 -m-2" : ""}`}
    >
      {author ? (
        <UserHoverCard user={author}>
          <Avatar
            className={`${isReply ? "h-6 w-6" : "h-7 w-7"} shrink-0 cursor-pointer`}
            onClick={() => navigate(`/profile/${author.id}`)}
          >
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
              {getUserInitials(author.name)}
            </AvatarFallback>
          </Avatar>
        </UserHoverCard>
      ) : (
        <Avatar className={`${isReply ? "h-6 w-6" : "h-7 w-7"} shrink-0`}>
          <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
            ?
          </AvatarFallback>
        </Avatar>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {comment.pinned && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Pin className="h-3 w-3 text-primary shrink-0" />
              </TooltipTrigger>
              <TooltipContent>Pinned comment</TooltipContent>
            </Tooltip>
          )}
          {author ? (
            <UserHoverCard user={author}>
              <span
                className="text-sm font-medium cursor-pointer hover:underline"
                onClick={() => navigate(`/profile/${author.id}`)}
              >
                {author.name}
              </span>
            </UserHoverCard>
          ) : (
            <span className="text-sm font-medium">Unknown</span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.createdAt), {
              addSuffix: true,
            })}
          </span>
          {wasEdited && (
            <span className="text-xs text-muted-foreground italic">
              (edited)
            </span>
          )}
          <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setReplyingToCommentId(isReplying ? null : comment.id);
                    setThreadReplyText("");
                    setThreadAttachments([]);
                  }}
                >
                  <Reply className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reply</TooltipContent>
            </Tooltip>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Smile className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="end">
                <div className="flex gap-1">
                  {quickEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      className="h-7 w-7 flex items-center justify-center rounded hover:bg-secondary transition-colors text-sm"
                      onClick={() =>
                        addCommentReaction(comment.id, emoji, currentUser.id)
                      }
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {(isCommentAuthor || canPin) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canPin && !isReply && (
                    <DropdownMenuItem
                      onClick={() => {
                        toggleCommentPin(comment.id, currentUser.id);
                        toast.success(
                          comment.pinned
                            ? "Comment unpinned"
                            : "Comment pinned",
                        );
                      }}
                    >
                      <Pin className="h-3.5 w-3.5 mr-2" />{" "}
                      {comment.pinned ? "Unpin" : "Pin"}
                    </DropdownMenuItem>
                  )}
                  {isCommentAuthor && (
                    <>
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingCommentId(comment.id);
                          setEditingCommentBody(comment.body);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteCommentOpen(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <AlertDialog
          open={deleteCommentOpen}
          onOpenChange={setDeleteCommentOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
              <AlertDialogDescription>
                This comment will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  deleteComment(comment.id, currentUser.id);
                  toast.success("Comment deleted");
                  setDeleteCommentOpen(false);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {isEditing ? (
          <div className="mt-1 space-y-2">
            <MentionInput
              value={editingCommentBody}
              onChange={setEditingCommentBody}
              placeholder="Edit comment..."
              rows={2}
              maxLength={COMMENT_BODY_MAX_LENGTH}
            />
            <p className="text-[11px] text-muted-foreground text-right tabular-nums">
              {editingCommentBody.length}/{COMMENT_BODY_MAX_LENGTH}
            </p>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => setEditingCommentId(null)}
              >
                <X className="h-3 w-3" /> Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={!editingCommentBody.trim()}
                onClick={() => {
                  if (
                    editingCommentBody.trim().length > COMMENT_BODY_MAX_LENGTH
                  ) {
                    toast.error(
                      `Comment is too long. Please keep it under ${COMMENT_BODY_MAX_LENGTH} characters.`,
                    );
                    return;
                  }
                  editComment(comment.id, editingCommentBody, currentUser.id);
                  setEditingCommentId(null);
                  toast.success("Comment updated");
                }}
              >
                <Check className="h-3 w-3" /> Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            {comment.body.startsWith("<") ? (
              <MentionHtml
                className="text-sm mt-0.5 prose prose-sm max-w-none [&_a]:text-primary [&_a]:underline [&_a]:cursor-pointer"
                html={comment.body}
              />
            ) : (
              <p className="text-sm mt-0.5">
                <MentionText text={comment.body} />
              </p>
            )}
          </>
        )}
        {comment.attachments.length > 0 && (
          <div className="mt-1.5">
            <AttachmentViewer attachments={comment.attachments} />
          </div>
        )}
        {comment.reactions.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {comment.reactions.map((r) => {
              const isActive = r.users.includes(currentUser.id);
              return (
                <Button
                  key={r.emoji}
                  variant={isActive ? "secondary" : "outline"}
                  size="sm"
                  className="gap-0.5 h-6 text-[11px] px-1.5"
                  onClick={() =>
                    addCommentReaction(comment.id, r.emoji, currentUser.id)
                  }
                >
                  {r.emoji} {r.users.length}
                </Button>
              );
            })}
          </div>
        )}
        {isReplying && (
          <div className="mt-2 space-y-2 pl-2 border-l-2 border-primary/30">
            <MentionInput
              value={threadReplyText}
              onChange={(value) => {
                setThreadReplyText(value);
                emitMemoTyping();
              }}
              placeholder={`Reply to ${author?.name || "comment"}...`}
              rows={1}
              maxLength={COMMENT_BODY_MAX_LENGTH}
            />
            <p className="text-[11px] text-muted-foreground text-right tabular-nums">
              {threadReplyText.length}/{COMMENT_BODY_MAX_LENGTH}
            </p>
            <AttachmentUploader
              attachments={threadAttachments}
              onAdd={(atts) =>
                setThreadAttachments((prev) => [...prev, ...atts])
              }
              onRemove={(attId) =>
                setThreadAttachments((prev) =>
                  prev.filter((a) => a.id !== attId),
                )
              }
              compact
            />
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => setReplyingToCommentId(null)}
              >
                <X className="h-3 w-3" /> Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={
                  !threadReplyText.trim() && threadAttachments.length === 0
                }
                onClick={() => handleThreadReply(comment.id)}
              >
                <Reply className="h-3 w-3" /> Reply
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MemoDetail;
