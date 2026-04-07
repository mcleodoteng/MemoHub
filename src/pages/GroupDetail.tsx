import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useGroups } from "@/context/GroupContext";
import { useMemos } from "@/context/MemoContext";
import { useMessages } from "@/context/MessageContext";
import { useReminders } from "@/context/ReminderContext";
import { useAuth } from "@/context/AuthContext";
import { useUsers } from "@/context/UserContext";
import { useRoles } from "@/context/RoleContext";
import { useOnlineStatuses } from "@/hooks/useOnlineStatus";
import { apiRequest } from "@/lib/api";
import { getUserInitials } from "@/lib/user-utils";
import { UserHoverCard } from "@/components/user/UserHoverCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MemoCard } from "@/components/memo/MemoCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import {
  ArrowLeft,
  Users,
  Send,
  UserPlus,
  UserMinus,
  ShieldCheck,
  FileText,
  MessageSquare,
  Settings,
  PenSquare,
  Lock,
  CheckCircle,
  XCircle,
  FolderOpen,
  Download,
  Eye,
  Bell,
  Clock,
  Paperclip,
  X,
} from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { Attachment } from "@/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const GroupDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getGroupById,
    addMember,
    removeMember,
    addAdmin,
    removeAdmin,
    deleteGroup,
    inviteUser,
    acceptInvite,
    declineInvite,
    cancelInvite,
    getInviteStatus,
    addFile,
  } = useGroups();
  const { memos, addMemo } = useMemos();
  const {
    conversations,
    sendMessage,
    getConversationMessages,
    getUnreadCount,
    createConversation,
    typingUsers,
    markAsRead,
    addReaction,
  } = useMessages();
  const { addReminder } = useReminders();
  const { getUserStatus } = useOnlineStatuses();
  const { currentUser } = useAuth();
  const { users, getUserById } = useUsers();
  const { hasPermission } = useRoles();

  if (!currentUser) {
    return null;
  }

  const group = getGroupById(id || "");
  const [memoDialogOpen, setMemoDialogOpen] = useState(false);
  const [memoTitle, setMemoTitle] = useState("");
  const [memoBody, setMemoBody] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [pendingInviteDecision, setPendingInviteDecision] = useState<
    "accept" | "decline" | null
  >(null);
  const [isSubmittingInviteDecision, setIsSubmittingInviteDecision] =
    useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>(
    [],
  );
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "feed" | "chat" | "files" | "members"
  >("feed");
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDue, setReminderDue] = useState("");
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(
    null,
  );
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    actionLabel?: string;
    onConfirm: () => void;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  const isMember = group ? group.memberIds.includes(currentUser.id) : false;
  const isAdmin = group ? group.adminIds.includes(currentUser.id) : false;
  const canCreateMemo = hasPermission("canCreateMemo");
  const canManageGroups = hasPermission("canManageGroups");
  const canDeleteGroups = hasPermission("canDeleteGroups");
  const canManageMembers = isAdmin || (canManageGroups && isMember);
  const canDeleteThisGroup = canDeleteGroups && (isAdmin || canManageMembers);
  const invite = group ? getInviteStatus(group.id, currentUser.id) : undefined;
  const hasPendingInvite = invite?.status === "pending";

  const otherUsers = users.filter((u) => u.id !== currentUser.id);
  const groupMemos = group
    ? memos.filter((m) => m.groupId === group.id && m.status !== "draft")
    : [];
  const groupConv = group
    ? conversations.find((c) => c.groupId === group.id) ||
      conversations.find((c) => c.type === "group" && c.name === group.name)
    : undefined;
  const convMessages = groupConv ? getConversationMessages(groupConv.id) : [];
  const groupUnreadCount = groupConv
    ? getUnreadCount(groupConv.id, currentUser.id)
    : 0;

  useEffect(() => {
    if (groupConv && isMember && activeTab === "chat") {
      markAsRead(groupConv.id, currentUser.id);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [
    groupConv?.id,
    convMessages.length,
    isMember,
    activeTab,
    currentUser.id,
    markAsRead,
  ]);

  // No group found
  if (!group) {
    return (
      <AppLayout title="Not Found">
        <div className="flex flex-col items-center justify-center py-20">
          <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">Group not found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate("/groups")}
          >
            Back to Groups
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Has pending invite - locked view
  if (hasPendingInvite && !isMember) {
    return (
      <AppLayout title="">
        <div className="max-w-lg mx-auto mt-16">
          <div className="rounded-2xl border bg-card p-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
              <Lock className="h-8 w-8 text-warning" />
            </div>
            <h2 className="font-display text-xl font-bold">{group.name}</h2>
            <p className="text-sm text-muted-foreground">{group.description}</p>
            <p className="text-sm">You have been invited to join this group.</p>
            <div className="flex items-center justify-center gap-3">
              <Button
                className="gap-2"
                onClick={() => {
                  setPendingInviteDecision("accept");
                }}
              >
                <CheckCircle className="h-4 w-4" /> Accept Invitation
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setPendingInviteDecision("decline");
                }}
              >
                <XCircle className="h-4 w-4" /> Decline
              </Button>
            </div>
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                {group.memberIds.length} members · {group.type}
              </p>
            </div>
          </div>
        </div>
        <AlertDialog
          open={pendingInviteDecision !== null}
          onOpenChange={(open) => {
            if (!open && !isSubmittingInviteDecision) {
              setPendingInviteDecision(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingInviteDecision === "accept"
                  ? `Accept invitation to ${group.name}?`
                  : `Decline invitation to ${group.name}?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingInviteDecision === "accept"
                  ? `You will be added to ${group.name}, see the full chat history, and the group will be notified that you joined.`
                  : `You are about to decline the invitation to ${group.name}. The group will be notified and your pending invitation will be removed.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmittingInviteDecision}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isSubmittingInviteDecision}
                onClick={async (event) => {
                  event.preventDefault();

                  try {
                    setIsSubmittingInviteDecision(true);

                    if (pendingInviteDecision === "accept") {
                      await acceptInvite(group.id, currentUser.id);
                      toast.success(`You joined ${group.name}`);
                      navigate(`/groups/${group.id}`);
                    } else if (pendingInviteDecision === "decline") {
                      await declineInvite(group.id, currentUser.id);
                      toast.info(`Invitation to ${group.name} declined`);
                      navigate("/groups");
                    }

                    setPendingInviteDecision(null);
                  } catch (error) {
                    const message =
                      error instanceof Error
                        ? error.message
                        : `Failed to ${pendingInviteDecision} invitation`;
                    toast.error(message);
                  } finally {
                    setIsSubmittingInviteDecision(false);
                  }
                }}
              >
                {isSubmittingInviteDecision
                  ? "Please wait..."
                  : pendingInviteDecision === "accept"
                    ? "Yes, accept"
                    : "Yes, decline"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AppLayout>
    );
  }

  // Not a member and no invite
  if (!isMember) {
    return (
      <AppLayout title="Access Denied">
        <div className="flex flex-col items-center justify-center py-20">
          <Lock className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">
            You are not a member of this group
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate("/groups")}
          >
            Back to Groups
          </Button>
        </div>
      </AppLayout>
    );
  }

  const handleSendGroupMemo = async () => {
    if (!canCreateMemo) {
      toast.error("You do not have permission to send memos");
      return;
    }
    if (!memoTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    const recipientIds = group.memberIds.filter(
      (mid) => mid !== currentUser.id,
    );
    try {
      await addMemo({
        title: memoTitle,
        body: memoBody,
        creatorId: currentUser.id,
        visibility: "private",
        status: "sent",
        recipientIds,
        tags: [],
        attachments: [],
        pinned: false,
        archived: false,
        referencedMemoIds: [],
        groupId: group.id,
      });
      toast.success(`Memo sent to ${group.name}!`);
      setMemoDialogOpen(false);
      setMemoTitle("");
      setMemoBody("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send memo";
      toast.error(message);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && pendingAttachments.length === 0) return;
    try {
      if (groupConv) {
        await sendMessage(
          groupConv.id,
          newMessage,
          undefined,
          pendingAttachments.length > 0 ? pendingAttachments : undefined,
        );
      } else {
        const conv = await createConversation(
          group.memberIds,
          group.name,
          group.id,
        );
        await sendMessage(
          conv.id,
          newMessage,
          undefined,
          pendingAttachments.length > 0 ? pendingAttachments : undefined,
        );
      }
      setNewMessage("");
      setPendingAttachments([]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send message";
      toast.error(message);
    }
  };

  const uploadChatAttachments = async (files: FileList | File[]) => {
    const items = Array.from(files);
    if (items.length === 0) return;

    setIsUploadingAttachments(true);
    try {
      const formData = new FormData();
      items.forEach((file) => formData.append("files", file));

      const res = await apiRequest<{ attachments: any[] }>("/upload/files", {
        method: "POST",
        body: formData,
      });

      const uploaded = (res.data.attachments || []).map((att: any) => ({
        id: att.id,
        name: att.name || att.filename,
        type: att.type || att.mimeType || "file",
        size: att.size || 0,
        url: att.url,
        thumbnailUrl:
          (att.type || "").startsWith("image/") ||
          (att.mimeType || "").startsWith("image/")
            ? att.url
            : undefined,
      }));

      setPendingAttachments((prev) => [...prev, ...uploaded]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload attachments";
      toast.error(message);
    } finally {
      setIsUploadingAttachments(false);
      if (chatFileInputRef.current) {
        chatFileInputRef.current.value = "";
      }
    }
  };

  const handleChatFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files) return;
    await uploadChatAttachments(files);
  };

  const removePendingAttachment = (attachmentId: string) => {
    setPendingAttachments((prev) =>
      prev.filter((att) => att.id !== attachmentId),
    );
  };

  const handleInviteUser = async (uid: string) => {
    if (!canManageMembers) {
      toast.error("You do not have permission to invite members");
      return;
    }
    try {
      await inviteUser(group.id, uid);
      toast.success("Invitation sent!");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send invitation";
      toast.error(message);
    }
  };

  const handleCancelInvite = async (invitedUserId: string) => {
    try {
      const invitedUser = getUserById(invitedUserId);
      await cancelInvite(group.id, invitedUserId);
      if (groupConv) {
        sendSystemMessage(
          groupConv.id,
          `Invitation for ${invitedUser?.name || "the selected user"} was canceled`,
        );
      }
      toast.success("Invitation canceled");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to cancel invitation";
      toast.error(message);
    }
  };

  const handleCreateReminder = async () => {
    if (!reminderTitle.trim() || !reminderDue) {
      toast.error("Title and date required");
      return;
    }

    try {
      await addReminder({
        title: reminderTitle,
        dueAt: new Date(reminderDue).toISOString(),
        groupId: group.id,
      });
      toast.success("Group reminder created!");
      setReminderDialogOpen(false);
      setReminderTitle("");
      setReminderDue("");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to create group reminder";
      toast.error(message);
    }
  };

  // Collect all files from group memos and chat
  const allGroupFiles = Array.from(
    new Map(
      [
        ...group.files,
        ...groupMemos.flatMap((m) =>
          m.attachments.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            size: a.size,
            url: a.url,
            uploadedBy: m.creatorId,
            uploadedAt: m.createdAt,
            source: "memo" as const,
          })),
        ),
        ...convMessages.flatMap((msg) =>
          (msg.attachments || []).map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            size: a.size,
            url: a.url,
            uploadedBy: msg.senderId,
            uploadedAt: msg.createdAt,
            source: "chat" as const,
          })),
        ),
      ].map((file) => [file.id, file]),
    ).values(),
  );

  const nonMemberUsers = otherUsers.filter(
    (u) =>
      !group.memberIds.includes(u.id) &&
      !group.pendingInvites.some(
        (i) => i.userId === u.id && i.status === "pending",
      ),
  );

  return (
    <AppLayout title="">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => navigate("/groups")}
            >
              <ArrowLeft className="h-4 w-4" />{" "}
              <span className="hidden sm:inline">Groups</span>
            </Button>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <h1 className="font-display text-lg font-bold truncate">
                {group.name}
              </h1>
              <Badge
                variant="secondary"
                className="text-[10px] shrink-0 hidden sm:inline-flex"
              >
                {group.type}
              </Badge>
              <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                {group.memberIds.length} members
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setReminderDialogOpen(true)}
            >
              <Bell className="h-3.5 w-3.5" />{" "}
              <span className="hidden sm:inline">Reminder</span>
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setMemoDialogOpen(true)}
              disabled={!canCreateMemo}
            >
              <PenSquare className="h-3.5 w-3.5" />{" "}
              <span className="hidden sm:inline">Send Memo</span>
            </Button>
            {canDeleteThisGroup && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setConfirmDialog({
                    title: `Delete ${group.name}?`,
                    description:
                      "This group and its membership setup will be removed. This action cannot be undone.",
                    actionLabel: "Delete",
                    onConfirm: () => {
                      deleteGroup(group.id);
                      toast.success("Group deleted");
                      navigate("/groups");
                    },
                  });
                }}
              >
                Delete
              </Button>
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{group.description}</p>

        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as "feed" | "chat" | "files" | "members")
          }
          className="w-full"
        >
          <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
            <TabsList className="inline-flex w-auto min-w-max">
              <TabsTrigger value="feed" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />{" "}
                <span className="hidden sm:inline">Feed</span> (
                {groupMemos.length})
              </TabsTrigger>
              <TabsTrigger value="chat" className="gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />{" "}
                <span className="hidden sm:inline">Chat</span>
                {groupUnreadCount > 0 && (
                  <span className="ml-1 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                    {groupUnreadCount > 99 ? "99+" : groupUnreadCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="files" className="gap-1.5">
                <FolderOpen className="h-3.5 w-3.5" />{" "}
                <span className="hidden sm:inline">Files</span> (
                {allGroupFiles.length})
              </TabsTrigger>
              <TabsTrigger value="members" className="gap-1.5">
                <Users className="h-3.5 w-3.5" />{" "}
                <span className="hidden sm:inline">Members</span> (
                {group.memberIds.length})
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Feed Tab */}
          <TabsContent value="feed" className="mt-4">
            {groupMemos.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">
                  No memos in this group yet
                </p>
                <Button
                  size="sm"
                  className="mt-3 gap-1.5"
                  onClick={() => setMemoDialogOpen(true)}
                  disabled={!canCreateMemo}
                >
                  <PenSquare className="h-3.5 w-3.5" /> Send First Memo
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {groupMemos.map((m) => (
                  <MemoCard key={m.id} memo={m} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="mt-4">
            <div className="flex flex-col h-[calc(100vh-20rem)] rounded-xl border bg-card overflow-hidden">
              <div className="flex-1 overflow-auto p-4 space-y-3 scrollbar-thin">
                {convMessages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm py-12">
                    Start the conversation!
                  </div>
                ) : (
                  convMessages.map((msg) => {
                    // System messages
                    if (msg.isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center">
                          <span className="text-[11px] text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                            {msg.body}
                          </span>
                        </div>
                      );
                    }
                    const sender = getUserById(msg.senderId);
                    const isMe = msg.senderId === currentUser.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}
                      >
                        {sender && (
                          <UserHoverCard user={sender}>
                            <Avatar
                              className="h-7 w-7 shrink-0 cursor-pointer"
                              onClick={() => navigate(`/profile/${sender.id}`)}
                            >
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                                {getUserInitials(sender.name)}
                              </AvatarFallback>
                            </Avatar>
                          </UserHoverCard>
                        )}
                        <div className="max-w-[70%]">
                          <div
                            className={`rounded-xl px-3 py-2 text-sm ${
                              isMe
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary"
                            }`}
                          >
                            {!isMe && sender && (
                              <p className="text-xs font-semibold mb-0.5 opacity-70">
                                {sender.name}
                              </p>
                            )}
                            {msg.body && <p>{msg.body}</p>}
                            {msg.attachments.length > 0 && (
                              <div className="mt-2 space-y-1.5">
                                {msg.attachments
                                  .filter((att) =>
                                    att.type.startsWith("image/"),
                                  )
                                  .map((att) => (
                                    <img
                                      key={att.id}
                                      src={att.url}
                                      alt={att.name}
                                      className="max-w-[220px] max-h-[180px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity border border-border/20"
                                      onClick={() => setPreviewAttachment(att)}
                                    />
                                  ))}
                                {msg.attachments
                                  .filter(
                                    (att) => !att.type.startsWith("image/"),
                                  )
                                  .map((att) => (
                                    <div
                                      key={att.id}
                                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer hover:opacity-80 transition-opacity ${
                                        isMe
                                          ? "bg-primary-foreground/15"
                                          : "bg-background border border-border/50"
                                      }`}
                                      onClick={() =>
                                        window.open(att.url, "_blank")
                                      }
                                    >
                                      <FileText className="h-4 w-4 shrink-0" />
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium">
                                          {att.name}
                                        </p>
                                        <p className="opacity-60">
                                          {att.size < 1024 * 1024
                                            ? `${(att.size / 1024).toFixed(0)} KB`
                                            : `${(att.size / (1024 * 1024)).toFixed(1)} MB`}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}
                            <p
                              className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}
                            >
                              {formatDistanceToNow(new Date(msg.createdAt), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 border-t flex gap-2">
                <input
                  ref={chatFileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleChatFileSelect}
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => chatFileInputRef.current?.click()}
                  disabled={isUploadingAttachments}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                />
                <Button
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={
                    (!newMessage.trim() && pendingAttachments.length === 0) ||
                    isUploadingAttachments
                  }
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {pendingAttachments.length > 0 && (
                <div className="px-3 pb-3 flex flex-wrap gap-1.5 border-t">
                  {pendingAttachments.map((attachment) => (
                    <span
                      key={attachment.id}
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs"
                    >
                      {attachment.name}
                      <button
                        type="button"
                        onClick={() => removePendingAttachment(attachment.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="mt-4">
            <div className="widget-card">
              {allGroupFiles.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">
                    No files shared yet
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allGroupFiles.map((f) => {
                    const uploader = getUserById(f.uploadedBy);
                    const isImage = f.type.startsWith("image/");
                    return (
                      <div
                        key={f.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors"
                      >
                        {isImage ? (
                          <img
                            src={f.url}
                            alt={f.name}
                            className="h-10 w-10 rounded object-cover shrink-0 cursor-pointer"
                            onClick={() =>
                              setPreviewAttachment({
                                id: f.id,
                                name: f.name,
                                type: f.type,
                                size: f.size,
                                url: f.url,
                              })
                            }
                          />
                        ) : (
                          <div className="p-2 rounded-lg bg-primary/10">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {f.name}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>{uploader?.name || "Unknown"}</span>
                            <span>·</span>
                            <span>{(f.size / 1024).toFixed(0)} KB</span>
                            <span>·</span>
                            <span>{f.source}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                              setPreviewAttachment({
                                id: f.id,
                                name: f.name,
                                type: f.type,
                                size: f.size,
                                url: f.url,
                              })
                            }
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              const link = document.createElement("a");
                              link.href = f.url;
                              link.download = f.name;
                              link.click();
                            }}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="mt-4">
            <div className="widget-card space-y-4">
              {canManageMembers && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-semibold text-sm">
                      Manage Members
                    </h3>
                    {nonMemberUsers.length > 0 && (
                      <Select onValueChange={(uid) => handleInviteUser(uid)}>
                        <SelectTrigger className="w-44 h-8 text-xs">
                          <div className="flex items-center gap-1">
                            <UserPlus className="h-3 w-3" /> Invite Member
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {nonMemberUsers.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Pending invites */}
                  {group.pendingInvites.filter((i) => i.status === "pending")
                    .length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        Pending Invitations
                      </p>
                      {group.pendingInvites
                        .filter((i) => i.status === "pending")
                        .map((inv) => {
                          const user = getUserById(inv.userId);
                          if (!user) return null;
                          return (
                            <div
                              key={inv.userId}
                              className="flex items-center gap-3 p-2 rounded-lg bg-warning/5 border border-warning/20"
                            >
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="text-[10px] bg-warning/10 text-warning font-semibold">
                                  {getUserInitials(user.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <span className="text-sm font-medium">
                                  {user.name}
                                </span>
                                <p className="text-[11px] text-muted-foreground">
                                  Pending since{" "}
                                  {formatDistanceToNow(
                                    new Date(inv.invitedAt),
                                    { addSuffix: true },
                                  )}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className="text-[10px] text-warning border-warning/30"
                              >
                                Pending
                              </Badge>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleCancelInvite(inv.userId)}
                                title="Cancel invitation"
                                aria-label="Cancel invitation"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {group.memberIds.map((uid) => {
                  const user = getUserById(uid);
                  if (!user) return null;
                  const isGroupAdmin = group.adminIds.includes(uid);
                  const userStatus = getUserStatus(uid);
                  return (
                    <div
                      key={uid}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                    >
                      <UserHoverCard user={user}>
                        <div className="relative">
                          <Avatar
                            className="h-8 w-8 cursor-pointer"
                            onClick={() => navigate(`/profile/${uid}`)}
                          >
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                              {getUserInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
                              userStatus === "online"
                                ? "bg-success"
                                : userStatus === "away"
                                  ? "bg-warning"
                                  : "bg-muted-foreground/40"
                            }`}
                          />
                        </div>
                      </UserHoverCard>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-medium cursor-pointer hover:underline"
                            onClick={() => navigate(`/profile/${uid}`)}
                          >
                            {user.name}
                          </span>
                          {isGroupAdmin && (
                            <Badge variant="secondary" className="text-[10px]">
                              <ShieldCheck className="h-3 w-3 mr-0.5" /> Admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {user.department}
                        </p>
                      </div>
                      {canManageMembers && uid !== currentUser.id && (
                        <div className="flex gap-1">
                          {!isGroupAdmin ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                addAdmin(group.id, uid);
                                toast.success("Admin added");
                              }}
                            >
                              Make Admin
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setConfirmDialog({
                                  title: `Remove admin access from ${user.name}?`,
                                  description:
                                    "This user will no longer be a group admin.",
                                  actionLabel: "Remove Admin",
                                  onConfirm: () => {
                                    removeAdmin(group.id, uid);
                                    toast.success("Admin removed");
                                  },
                                });
                              }}
                            >
                              Remove Admin
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setConfirmDialog({
                                title: `Remove ${user.name} from ${group.name}?`,
                                description:
                                  "This user will be removed from the group members list.",
                                actionLabel: "Remove",
                                onConfirm: () => {
                                  removeMember(group.id, uid);
                                  toast.success("Member removed");
                                },
                              });
                            }}
                          >
                            <UserMinus className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Send Group Memo Dialog */}
      <Dialog open={memoDialogOpen} onOpenChange={setMemoDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              Send Memo to {group.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title</label>
              <Input
                placeholder="Memo title"
                value={memoTitle}
                onChange={(e) => setMemoTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Content
              </label>
              <RichTextEditor
                content={memoBody}
                onChange={setMemoBody}
                placeholder="Write your memo..."
                minHeight="150px"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemoDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendGroupMemo} className="gap-2">
              <Send className="h-4 w-4" /> Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Reminder Dialog */}
      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              Group Reminder for {group.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Title *</label>
              <Input
                placeholder="Reminder title"
                value={reminderTitle}
                onChange={(e) => setReminderTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Due Date & Time *
              </label>
              <Input
                type="datetime-local"
                value={reminderDue}
                onChange={(e) => setReminderDue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReminderDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateReminder} className="gap-1.5">
              <Bell className="h-3.5 w-3.5" /> Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(previewAttachment)}
        onOpenChange={(open) => {
          if (!open) setPreviewAttachment(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display truncate">
              {previewAttachment?.name}
            </DialogTitle>
          </DialogHeader>
          {previewAttachment?.type.startsWith("image/") && (
            <img
              src={previewAttachment.url}
              alt={previewAttachment.name}
              className="w-full max-h-[70vh] object-contain rounded-lg"
            />
          )}
          {previewAttachment?.type === "application/pdf" && (
            <iframe
              src={previewAttachment.url}
              className="w-full h-[70vh] rounded-lg"
              title={previewAttachment.name}
            />
          )}
          {previewAttachment &&
            !previewAttachment.type.startsWith("image/") &&
            previewAttachment.type !== "application/pdf" && (
              <div className="py-6 text-center space-y-3">
                <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Preview not available for this file type.
                </p>
                <Button
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = previewAttachment.url;
                    link.download = previewAttachment.name;
                    link.click();
                  }}
                >
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>
              </div>
            )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(confirmDialog)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                confirmDialog?.onConfirm();
                setConfirmDialog(null);
              }}
            >
              {confirmDialog?.actionLabel || "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default GroupDetail;
