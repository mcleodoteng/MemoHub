import { AppLayout } from "@/components/layout/AppLayout";
import { MentionInput } from "@/components/editor/MentionInput";
import { useMessages } from "@/context/MessageContext";
import { useSocket } from "@/context/SocketContext";
import { useMemos } from "@/context/MemoContext";
import { useGroups } from "@/context/GroupContext";
import { useAuth } from "@/context/AuthContext";
import { useUsers } from "@/context/UserContext";
import { getUserInitials } from "@/lib/user-utils";
import { UserHoverCard } from "@/components/user/UserHoverCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Send,
  Users as UsersIcon,
  SmilePlus,
  FileText,
  Share2,
  Search,
  X,
  Star,
  StarOff,
  Hash,
  MessageCircle,
  ArrowLeft,
  ArrowDown,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  Paperclip,
  Image as ImageIcon,
  Check,
  CheckCheck,
} from "lucide-react";
import { Attachment } from "@/types";
import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  type KeyboardEvent,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { useIsMobile } from "@/hooks/use-mobile";
import {
  formatDistanceToNow,
  format,
  isToday,
  isYesterday,
  isSameDay,
} from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest, type ApiEnvelope } from "@/lib/api";
import { toast } from "sonner";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "🚀", "👏", "🔥", "💡"];
const EMPTY_TYPING_USERS: string[] = [];
const FORWARDED_PREFIX = "[FWD] ";
const MESSAGE_BODY_MAX_LENGTH = 10000;

type UploadAttachmentResponse = {
  id: string;
  name?: string;
  filename?: string;
  type?: string;
  mimeType?: string;
  size?: number;
  url: string;
};

const Messages = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { currentUser } = useAuth();
  const { users, getUserById } = useUsers();
  const {
    conversations,
    sendMessage,
    addReaction,
    markAsRead,
    getConversationMessages,
    refreshConversationMessages,
    typingUsers,
    simulateTyping,
    createConversation,
    editMessage,
    deleteMessage,
    starMessage,
    starredMessages,
    getUnreadCount,
  } = useMessages();
  const { onlineUsers } = useSocket();
  const { memos } = useMemos();
  const { groups } = useGroups();

  const [selectedConv, setSelectedConv] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [convSearch, setConvSearch] = useState("");
  const [msgSearch, setMsgSearch] = useState("");
  const [activeSearchMatchIdx, setActiveSearchMatchIdx] = useState(-1);
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [spotlightMessageId, setSpotlightMessageId] = useState<string | null>(
    null,
  );
  const [isForwardDialogOpen, setIsForwardDialogOpen] = useState(false);
  const [forwardUserSearch, setForwardUserSearch] = useState("");
  const [selectedForwardUserIds, setSelectedForwardUserIds] = useState<
    string[]
  >([]);
  const [isForwarding, setIsForwarding] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const [isSavingMessageEdit, setIsSavingMessageEdit] = useState(false);
  const [tab, setTab] = useState<"direct" | "channels" | "starred">("direct");
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>(
    [],
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<Attachment | null>(null);
  const [readersModalIds, setReadersModalIds] = useState<string[] | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<{
    id: string;
    preview: string;
  } | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  const activeConv = conversations.find((c) => c.id === selectedConv);
  const requestedConversationId = searchParams.get("conversationId");
  const requestedMessageId = searchParams.get("messageId");
  const convMessages = useMemo(
    () => getConversationMessages(selectedConv),
    [getConversationMessages, selectedConv],
  );
  const convTyping = useMemo(
    () => typingUsers[selectedConv] ?? EMPTY_TYPING_USERS,
    [typingUsers, selectedConv],
  );
  const activeDirectRecipientId =
    activeConv?.type === "direct"
      ? activeConv.participantIds.find((id) => id !== currentUser.id) || null
      : null;
  const isActiveDirectRecipientOnline =
    activeDirectRecipientId !== null &&
    onlineUsers.has(activeDirectRecipientId);

  const getConversationUnread = (conversation: (typeof conversations)[0]) => {
    const exactUnread = getUnreadCount(conversation.id, currentUser.id);
    if (exactUnread > 0) return exactUnread;

    const lastMessage = conversation.lastMessage;
    if (!lastMessage) return 0;

    const isFromMe = lastMessage.senderId === currentUser.id;
    const isRead = (lastMessage.readBy || []).includes(currentUser.id);
    return !isFromMe && !isRead ? 1 : 0;
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (!selectedConv) return;
    scrollToBottom("auto");
    setShowScrollToBottom(false);
  }, [selectedConv]);

  useEffect(() => {
    if (!selectedConv) return;

    // Socket events carry realtime updates; this interval is a light fallback.
    void refreshConversationMessages(selectedConv);

    const interval = window.setInterval(() => {
      void refreshConversationMessages(selectedConv);
    }, 15000);

    return () => {
      window.clearInterval(interval);
    };
  }, [selectedConv, refreshConversationMessages]);

  useEffect(() => {
    if (!requestedConversationId) return;
    const exists = conversations.some((c) => c.id === requestedConversationId);
    if (!exists) return;

    const applySearchTarget = async () => {
      setSelectedConv(requestedConversationId);
      if (isMobile) {
        setMobileShowChat(true);
      }

      if (requestedMessageId) {
        await refreshConversationMessages(requestedConversationId);
        setSpotlightMessageId(requestedMessageId);
      }

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("conversationId");
      nextParams.delete("messageId");
      setSearchParams(nextParams, { replace: true });
    };

    void applySearchTarget();
  }, [
    requestedConversationId,
    requestedMessageId,
    conversations,
    isMobile,
    refreshConversationMessages,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!spotlightMessageId || !selectedConv) return;

    const messageElement = messageRefs.current[spotlightMessageId];
    if (!messageElement) {
      toast.info("Could not locate the starred message in loaded history");
      setSpotlightMessageId(null);
      return;
    }

    messageElement.scrollIntoView({ behavior: "smooth", block: "center" });

    const timeout = window.setTimeout(() => {
      setSpotlightMessageId(null);
    }, 2800);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [spotlightMessageId, selectedConv, convMessages.length]);

  useEffect(() => {
    if (!selectedConv) return;
    scrollToBottom("smooth");
  }, [convMessages.length, convTyping.length, selectedConv]);

  useEffect(() => {
    if (selectedConv) markAsRead(selectedConv, currentUser.id);
  }, [selectedConv, convMessages.length, currentUser.id, markAsRead]);

  useEffect(() => {
    if (!editingMessageId) return;
    const textarea = editTextareaRef.current;
    if (!textarea) return;

    // Keep edit mode height in sync with message content so users don't scroll.
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [editingMessageId, editingMessageText]);

  // Auto-mark messages as read when they come into view
  useEffect(() => {
    if (!selectedConv) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = entry.target.getAttribute("data-message-id");
            if (messageId && entry.target === messageRefs.current[messageId]) {
              markAsRead(selectedConv, currentUser.id);
            }
          }
        });
      },
      { threshold: 0.1, rootMargin: "50px" },
    );

    Object.values(messageRefs.current).forEach((el) => {
      if (el) observerRef.current?.observe(el);
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [selectedConv, convMessages.length, currentUser.id, markAsRead]);

  useEffect(() => {
    if (!selectedConv) return;
    if (!conversations.some((c) => c.id === selectedConv)) {
      setSelectedConv("");
      setMobileShowChat(false);
    }
  }, [conversations, selectedConv, isMobile]);

  const handleMessageScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollToBottom(distanceFromBottom > 120);
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const normalizedQuery = query.trim().toLowerCase();
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "ig");
    const parts = text.split(regex);

    return parts.map((part, idx) =>
      part.toLowerCase() === normalizedQuery ? (
        <mark
          key={`${part}-${idx}`}
          className="rounded px-0.5 bg-yellow-300/70 text-black"
        >
          {part}
        </mark>
      ) : (
        <span key={`${part}-${idx}`}>{part}</span>
      ),
    );
  };

  const getConvName = useCallback(
    (conv: (typeof conversations)[0]) => {
      if (conv.name) return conv.name;
      if (conv.groupId) {
        const grp = groups.find((g) => g.id === conv.groupId);
        if (grp) return grp.name;
      }
      const other = conv.participantIds.find((id) => id !== currentUser.id);
      return other ? getUserById(other)?.name || "Unknown" : "Unknown";
    },
    [currentUser.id, getUserById, groups],
  );

  const getConvInitials = (conv: (typeof conversations)[0]) => {
    if (conv.type === "group") return conv.name?.[0] || "G";
    const other = conv.participantIds.find((id) => id !== currentUser.id);
    const user = other ? getUserById(other) : null;
    return user ? getUserInitials(user.name) : "?";
  };

  const getOtherUserStatus = (conv: (typeof conversations)[0]) => {
    if (conv.type !== "direct") return null;
    const other = conv.participantIds.find((id) => id !== currentUser.id);
    if (!other) return null;
    if (onlineUsers.has(other)) return "online";
    return getUserById(other)?.status || "offline";
  };

  // Split conversations
  const directConvs = conversations.filter((c) => c.type === "direct");
  const channelConvs = conversations.filter((c) => c.type === "group");

  // Sort by latest, then filter
  const sortedDirect = useMemo(() => {
    let filtered = directConvs;
    if (convSearch.trim()) {
      const q = convSearch.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          getConvName(c).toLowerCase().includes(q) ||
          c.lastMessage?.body.toLowerCase().includes(q),
      );
    }
    return filtered.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [directConvs, convSearch, getConvName]);

  const sortedChannels = useMemo(() => {
    let filtered = channelConvs;
    if (convSearch.trim()) {
      const q = convSearch.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          getConvName(c).toLowerCase().includes(q) ||
          c.lastMessage?.body.toLowerCase().includes(q),
      );
    }
    return filtered.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [channelConvs, convSearch, getConvName]);

  const matchedMessageIds = useMemo(() => {
    if (!msgSearch.trim()) return [];
    const q = msgSearch.toLowerCase();
    return convMessages
      .filter((msg) => {
        const body = (msg.body || "").toLowerCase();
        const sharedMemoTitle = (msg.sharedMemo?.title || "").toLowerCase();
        return body.includes(q) || sharedMemoTitle.includes(q);
      })
      .map((msg) => msg.id);
  }, [convMessages, msgSearch]);

  useEffect(() => {
    if (!msgSearch.trim() || matchedMessageIds.length === 0) {
      setActiveSearchMatchIdx(-1);
      return;
    }

    setActiveSearchMatchIdx(0);
  }, [msgSearch, matchedMessageIds.length]);

  useEffect(() => {
    if (activeSearchMatchIdx < 0) return;
    const matchId = matchedMessageIds[activeSearchMatchIdx];
    if (!matchId) return;

    const el = messageRefs.current[matchId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeSearchMatchIdx, matchedMessageIds]);

  const goToNextSearchMatch = () => {
    if (matchedMessageIds.length === 0) return;
    setActiveSearchMatchIdx((prev) => (prev + 1) % matchedMessageIds.length);
  };

  const goToPrevSearchMatch = () => {
    if (matchedMessageIds.length === 0) return;
    setActiveSearchMatchIdx(
      (prev) =>
        (prev - 1 + matchedMessageIds.length) % matchedMessageIds.length,
    );
  };

  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessageIds((prev) =>
      prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId],
    );
  };

  const selectedMessages = useMemo(() => {
    if (selectedMessageIds.length === 0) return [];
    const selected = convMessages.filter((message) =>
      selectedMessageIds.includes(message.id),
    );

    return selected.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [convMessages, selectedMessageIds]);

  const forwardCandidates = useMemo(() => {
    const q = forwardUserSearch.trim().toLowerCase();

    return users
      .filter((user) => user.id !== currentUser.id)
      .filter(
        (user) =>
          !q ||
          user.name.toLowerCase().includes(q) ||
          user.email.toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, currentUser.id, forwardUserSearch]);

  const toggleForwardRecipient = (userId: string) => {
    setSelectedForwardUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleForwardMessages = async () => {
    if (!currentUser || selectedMessages.length === 0) return;
    if (selectedForwardUserIds.length === 0) {
      toast.error("Select at least one recipient");
      return;
    }

    setIsForwarding(true);
    try {
      for (const recipientId of selectedForwardUserIds) {
        const conversation = await createConversation([
          currentUser.id,
          recipientId,
        ]);

        for (const message of selectedMessages) {
          const baseBody = message.body?.trim() || "";
          const forwardedBody = `${FORWARDED_PREFIX}${baseBody}`.trim();

          sendMessage(
            conversation.id,
            forwardedBody,
            message.sharedMemo,
            message.attachments.length > 0 ? message.attachments : undefined,
          );
        }
      }

      toast.success(
        `Forwarded ${selectedMessages.length} message${selectedMessages.length > 1 ? "s" : ""}`,
      );
      setIsForwardDialogOpen(false);
      setSelectedForwardUserIds([]);
      setForwardUserSearch("");
      setIsSelectionMode(false);
      setSelectedMessageIds([]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to forward messages";
      toast.error(message);
    } finally {
      setIsForwarding(false);
    }
  };

  const startEditMessage = (messageId: string, currentBody: string) => {
    setEditingMessageId(messageId);
    setEditingMessageText(currentBody);
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingMessageText("");
  };

  const saveEditMessage = async () => {
    if (!editingMessageId) return;

    const nextBody = editingMessageText.trim();
    if (!nextBody) {
      toast.error("Message body cannot be empty");
      return;
    }
    if (nextBody.length > MESSAGE_BODY_MAX_LENGTH) {
      toast.error(
        `Message is too long. Please keep it under ${MESSAGE_BODY_MAX_LENGTH} characters.`,
      );
      return;
    }

    setIsSavingMessageEdit(true);
    try {
      await editMessage(editingMessageId, nextBody);
      setEditingMessageId(null);
      setEditingMessageText("");
      toast.success("Message updated");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update message";
      toast.error(message);
    } finally {
      setIsSavingMessageEdit(false);
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    const targetMessage = convMessages.find(
      (message) => message.id === messageId,
    );
    setMessageToDelete({
      id: messageId,
      preview: targetMessage?.body?.trim() || "This message",
    });
  };

  const confirmDeleteMessage = async () => {
    if (!messageToDelete) return;

    try {
      await deleteMessage(messageToDelete.id);
      if (editingMessageId === messageToDelete.id) {
        setEditingMessageId(null);
        setEditingMessageText("");
      }
      setMessageToDelete(null);
      toast.success("Message deleted");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete message";
      toast.error(message);
    }
  };

  const closeActiveConversation = () => {
    setSelectedConv("");
    setMobileShowChat(false);
    setShowMsgSearch(false);
    setMsgSearch("");
    setIsSelectionMode(false);
    setSelectedMessageIds([]);
    cancelEditMessage();
  };

  const hasDirectRecipientRepliedAfter = (messageCreatedAt: string) => {
    if (
      !activeConv ||
      activeConv.type !== "direct" ||
      !activeDirectRecipientId
    ) {
      return false;
    }

    const sentAt = new Date(messageCreatedAt).getTime();
    return convMessages.some((message) => {
      if (message.senderId !== activeDirectRecipientId) return false;
      const repliedAt = new Date(message.createdAt).getTime();
      return Number.isFinite(repliedAt) && repliedAt > sentAt;
    });
  };

  const directCount = directConvs.length;
  const channelCount = channelConvs.length;
  const starredCount = starredMessages.length;
  const directUnreadCount = directConvs.reduce(
    (total, conversation) => total + getConversationUnread(conversation),
    0,
  );
  const channelUnreadCount = channelConvs.reduce(
    (total, conversation) => total + getConversationUnread(conversation),
    0,
  );

  const handleSend = () => {
    if (!selectedConv) return;
    if (!newMessage.trim() && pendingAttachments.length === 0) return;
    if (newMessage.trim().length > MESSAGE_BODY_MAX_LENGTH) {
      toast.error(
        `Message is too long. Please keep it under ${MESSAGE_BODY_MAX_LENGTH} characters.`,
      );
      return;
    }
    sendMessage(
      selectedConv,
      newMessage,
      undefined,
      pendingAttachments.length > 0 ? pendingAttachments : undefined,
    );
    setNewMessage("");
    setPendingAttachments([]);
  };

  const handleComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;
    if (e.shiftKey) return;
    if (e.nativeEvent.isComposing) return;

    e.preventDefault();

    if (isUploadingAttachments) return;
    handleSend();
  };

  const uploadAttachments = async (files: FileList | File[]) => {
    const items = Array.from(files);
    if (items.length === 0) return;

    setIsUploadingAttachments(true);
    try {
      const formData = new FormData();
      items.forEach((file) => formData.append("files", file));

      const res = await apiRequest<
        ApiEnvelope<{ attachments: UploadAttachmentResponse[] }>
      >("/upload/files", {
        method: "POST",
        body: formData,
      });

      const uploadedAttachments: Attachment[] = (
        res.data.attachments || []
      ).map((att) => ({
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

      setPendingAttachments((prev) => [...prev, ...uploadedAttachments]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload files";
      toast.error(message);
    } finally {
      setIsUploadingAttachments(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    await uploadAttachments(files);
  };

  const removePendingAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const processDroppedFiles = async (files: FileList | File[]) => {
    await uploadAttachments(files);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files?.length > 0) {
      void processDroppedFiles(e.dataTransfer.files);
    }
  };

  const handleShareMemo = (memoId: string, memoTitle: string) => {
    sendMessage(selectedConv, `📋 Shared memo: ${memoTitle}`, {
      memoId,
      title: memoTitle,
    });
    setShareOpen(false);
  };

  const getSenderMessageStatus = (msg: (typeof convMessages)[number]) => {
    if (!activeConv) return null;
    if (msg.senderId !== currentUser.id || msg.isSystem) return null;

    if (activeConv.type === "direct") {
      if (!activeDirectRecipientId) return null;

      const isReadByRecipient = (msg.readBy || []).includes(
        activeDirectRecipientId,
      );
      const repliedAfter = hasDirectRecipientRepliedAfter(msg.createdAt);

      if (isReadByRecipient || repliedAfter) {
        return {
          kind: "read" as const,
          label: "read",
          readerIds: [activeDirectRecipientId],
          showReaderDetails: false,
        };
      }

      if (isActiveDirectRecipientOnline) {
        return {
          kind: "online" as const,
          label: "delivered",
          readerIds: [] as string[],
          showReaderDetails: false,
        };
      }

      return {
        kind: "sent" as const,
        label: "sent",
        readerIds: [] as string[],
        showReaderDetails: false,
      };
    }

    const recipients = activeConv.participantIds.filter(
      (participantId) => participantId !== currentUser.id,
    );
    if (recipients.length === 0) return null;

    const readBy = msg.readBy || [];
    const hasBeenRead = recipients.some((participantId) =>
      readBy.includes(participantId),
    );

    if (hasBeenRead) {
      const readRecipientIds = recipients.filter((participantId) =>
        readBy.includes(participantId),
      );
      const readCount = readRecipientIds.length;
      return {
        kind: "read" as const,
        label: `read by ${readCount} ${readCount === 1 ? "person" : "people"}`,
        readerIds: readRecipientIds,
        showReaderDetails: true,
      };
    }

    const hasOnlineRecipient = recipients.some((participantId) =>
      onlineUsers.has(participantId),
    );

    if (hasOnlineRecipient) {
      return {
        kind: "online" as const,
        label: "delivered",
        readerIds: [] as string[],
        showReaderDetails: false,
      };
    }

    return {
      kind: "sent" as const,
      label: "sent",
      readerIds: [] as string[],
      showReaderDetails: false,
    };
  };

  const getConversationLastMessageStatus = (
    conv: (typeof conversations)[0],
  ) => {
    const lastMessage = conv.lastMessage;
    if (!lastMessage || lastMessage.isSystem) return null;
    if (lastMessage.senderId !== currentUser.id) return null;

    if (conv.type === "direct") {
      const recipientId = conv.participantIds.find(
        (id) => id !== currentUser.id,
      );
      if (!recipientId) return null;

      const isReadByRecipient = (lastMessage.readBy || []).includes(
        recipientId,
      );
      if (isReadByRecipient) {
        return { kind: "read" as const };
      }

      if (onlineUsers.has(recipientId)) {
        return { kind: "delivered" as const };
      }

      return { kind: "sent" as const };
    }

    const recipients = conv.participantIds.filter(
      (participantId) => participantId !== currentUser.id,
    );
    if (recipients.length === 0) return null;

    const readCount = recipients.filter((participantId) =>
      (lastMessage.readBy || []).includes(participantId),
    ).length;

    if (readCount > 0) {
      return { kind: "read" as const };
    }

    const hasOnlineRecipient = recipients.some((participantId) =>
      onlineUsers.has(participantId),
    );

    if (hasOnlineRecipient) {
      return { kind: "delivered" as const };
    }

    return { kind: "sent" as const };
  };

  const renderConvItem = (conv: (typeof conversations)[0]) => {
    const unread = getConversationUnread(conv);
    const typing = typingUsers[conv.id] || [];
    const otherStatus = getOtherUserStatus(conv);
    const lastStatus = getConversationLastMessageStatus(conv);

    return (
      <div
        key={conv.id}
        className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
          selectedConv === conv.id ? "bg-secondary" : "hover:bg-secondary/50"
        }`}
        onClick={() => {
          setSelectedConv(conv.id);
          if (isMobile) setMobileShowChat(true);
        }}
      >
        <div className="relative">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback
              className={`text-xs font-semibold ${conv.type === "group" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}
            >
              {conv.type === "group" ? (
                <Hash className="h-4 w-4" />
              ) : (
                getConvInitials(conv)
              )}
            </AvatarFallback>
          </Avatar>
          {otherStatus === "online" && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success border-2 border-card" />
          )}
          {otherStatus === "away" && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-warning border-2 border-card" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span
              className={`text-sm truncate ${unread > 0 ? "font-semibold" : "font-medium"}`}
            >
              {getConvName(conv)}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {conv.lastMessage && format(new Date(conv.updatedAt), "MMM d")}
            </span>
          </div>
          {typing.length > 0 ? (
            <p className="text-xs text-primary italic flex items-center gap-1">
              <span className="flex gap-0.5">
                <span className="w-1 h-1 bg-primary rounded-full animate-bounce" />
                <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:300ms]" />
              </span>
              typing...
            </p>
          ) : (
            <p
              className={`text-xs truncate ${unread > 0 ? "text-foreground" : "text-muted-foreground"}`}
            >
              {conv.lastMessage?.body}
            </p>
          )}
        </div>
        {lastStatus && unread === 0 && (
          <div className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-white/20 shrink-0">
            {lastStatus.kind === "sent" ? (
              <Check className="h-3 w-3 text-white" />
            ) : (
              <CheckCheck className="h-3 w-3 text-white" />
            )}
          </div>
        )}
        {unread > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shrink-0">
            {unread}
          </span>
        )}
      </div>
    );
  };

  const activeList =
    tab === "direct" ? sortedDirect : tab === "channels" ? sortedChannels : [];

  return (
    <AppLayout title="Messages">
      <div className="max-w-7xl mx-auto">
        <div className="flex h-[calc(100vh-8rem)] rounded-xl border bg-card overflow-hidden">
          {/* Conversation List */}
          <div
            className={`${isMobile ? "w-full" : "w-80"} border-r flex flex-col shrink-0 ${isMobile && mobileShowChat ? "hidden" : ""}`}
          >
            <div className="p-3 border-b space-y-2">
              <Tabs
                value={tab}
                onValueChange={(v) =>
                  setTab(v as "direct" | "channels" | "starred")
                }
                className="w-full"
              >
                <TabsList className="w-full h-8">
                  <TabsTrigger value="direct" className="flex-1 text-xs gap-1">
                    <MessageCircle className="h-3 w-3" /> Direct
                    <Badge variant="secondary" className="text-[9px] px-1 py-0">
                      {directCount}
                    </Badge>
                    {directUnreadCount > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="channels"
                    className="flex-1 text-xs gap-1"
                  >
                    <Hash className="h-3 w-3" /> Channels
                    <Badge variant="secondary" className="text-[9px] px-1 py-0">
                      {channelCount}
                    </Badge>
                    {channelUnreadCount > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="starred" className="flex-1 text-xs gap-1">
                    <Star className="h-3 w-3" /> Starred
                    <Badge variant="secondary" className="text-[9px] px-1 py-0">
                      {starredCount}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {tab !== "starred" && (
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder={`Search ${tab === "direct" ? "messages" : "channels"}...`}
                    value={convSearch}
                    onChange={(e) => setConvSearch(e.target.value)}
                    className="h-8 text-sm bg-secondary border-none pl-8"
                  />
                  {convSearch && (
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setConvSearch("")}
                      aria-label="Clear conversation search"
                      title="Clear conversation search"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-auto scrollbar-thin">
              {tab === "starred" ? (
                starredMessages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    No starred messages
                  </p>
                ) : (
                  starredMessages.map((msg) => {
                    const sender = getUserById(msg.senderId);
                    return (
                      <div
                        key={msg.id}
                        className="flex items-start gap-2 p-3 cursor-pointer hover:bg-secondary/50 transition-colors border-b border-border/50"
                        onClick={() => {
                          setSelectedConv(msg.conversationId);
                          setSpotlightMessageId(msg.id);
                          if (isMobile) setMobileShowChat(true);
                        }}
                      >
                        <Star className="h-3.5 w-3.5 text-warning shrink-0 mt-1" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium">
                            {sender?.name || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {msg.body}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(msg.createdAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )
              ) : activeList.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No {tab === "direct" ? "conversations" : "channels"} found
                </p>
              ) : (
                activeList.map(renderConvItem)
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div
            className={`flex-1 flex flex-col ${isMobile && !mobileShowChat ? "hidden" : ""} relative`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Drag overlay */}
            {isDragging && (
              <div className="absolute inset-0 z-50 bg-primary/5 border-2 border-dashed border-primary rounded-xl flex items-center justify-center backdrop-blur-sm">
                <div className="text-center space-y-2">
                  <Paperclip className="h-8 w-8 text-primary mx-auto" />
                  <p className="text-sm font-medium text-primary">
                    Drop files here to attach
                  </p>
                </div>
              </div>
            )}
            {activeConv ? (
              <>
                <div className="p-3 border-b flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={closeActiveConversation}
                    aria-label="Close conversation"
                    title="Close conversation"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                      {activeConv.type === "group" ? (
                        <Hash className="h-4 w-4" />
                      ) : (
                        getConvInitials(activeConv)
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">
                      {getConvName(activeConv)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activeConv.participantIds.length} participants
                    </p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setShowMsgSearch(!showMsgSearch)}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Search messages in this conversation
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isSelectionMode ? "secondary" : "ghost"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setIsSelectionMode((prev) => !prev);
                          setSelectedMessageIds([]);
                        }}
                        aria-label="Select messages"
                        title="Select messages"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Select messages to forward</TooltipContent>
                  </Tooltip>
                  {isSelectionMode && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={selectedMessageIds.length === 0}
                      onClick={() => setIsForwardDialogOpen(true)}
                    >
                      <Share2 className="h-3.5 w-3.5 mr-1" />
                      Forward ({selectedMessageIds.length})
                    </Button>
                  )}
                </div>

                {showMsgSearch && (
                  <div className="px-3 py-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search messages..."
                        value={msgSearch}
                        onChange={(e) => setMsgSearch(e.target.value)}
                        className="h-8 text-sm pl-8"
                        autoFocus
                      />
                      {msgSearch && (
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2"
                          onClick={() => setMsgSearch("")}
                          aria-label="Clear message search"
                          title="Clear message search"
                        >
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                    {msgSearch && (
                      <div className="mt-1 flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground">
                          {matchedMessageIds.length} match
                          {matchedMessageIds.length !== 1 ? "es" : ""}
                          {matchedMessageIds.length > 0 &&
                            activeSearchMatchIdx >= 0 &&
                            ` (${activeSearchMatchIdx + 1}/${matchedMessageIds.length})`}
                        </p>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            disabled={matchedMessageIds.length === 0}
                            onClick={goToPrevSearchMatch}
                            aria-label="Previous match"
                            title="Previous match"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            disabled={matchedMessageIds.length === 0}
                            onClick={goToNextSearchMatch}
                            aria-label="Next match"
                            title="Next match"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div
                  ref={messagesContainerRef}
                  onScroll={handleMessageScroll}
                  className="flex-1 overflow-auto p-4 space-y-1 scrollbar-thin"
                >
                  {convMessages.map((msg, idx) => {
                    const prevMsg = idx > 0 ? convMessages[idx - 1] : null;
                    const msgDate = new Date(msg.createdAt);
                    const showDateSep =
                      !prevMsg ||
                      !isSameDay(new Date(prevMsg.createdAt), msgDate);
                    const dateSepLabel = isToday(msgDate)
                      ? "Today"
                      : isYesterday(msgDate)
                        ? "Yesterday"
                        : format(msgDate, "EEEE, MMMM d");

                    const isMatched = matchedMessageIds.includes(msg.id);
                    const isActiveMatch =
                      activeSearchMatchIdx >= 0 &&
                      matchedMessageIds[activeSearchMatchIdx] === msg.id;
                    const isSpotlighted = spotlightMessageId === msg.id;
                    const isSelectedForForward = selectedMessageIds.includes(
                      msg.id,
                    );
                    const rawBody = msg.body || "";
                    const isForwardedMessage =
                      rawBody.startsWith(FORWARDED_PREFIX);
                    const isDeletedMessage = Boolean(msg.isDeleted);
                    const displayBody = isForwardedMessage
                      ? rawBody.slice(FORWARDED_PREFIX.length).trimStart()
                      : rawBody;
                    const estimatedEditRows = Math.max(
                      4,
                      Math.ceil(Math.max(displayBody.length, 1) / 38),
                    );

                    if (msg.isSystem) {
                      return (
                        <div key={msg.id}>
                          {showDateSep && (
                            <div className="flex items-center gap-3 my-4">
                              <div className="flex-1 h-px bg-border" />
                              <span className="text-[11px] font-medium text-muted-foreground bg-card px-3 py-1 rounded-full border shadow-sm">
                                {dateSepLabel}
                              </span>
                              <div className="flex-1 h-px bg-border" />
                            </div>
                          )}
                          <div className="flex justify-center my-2">
                            <span
                              className={`text-[11px] text-muted-foreground bg-secondary px-3 py-1 rounded-full ${isActiveMatch ? "ring-2 ring-primary" : ""}`}
                            >
                              {highlightText(msg.body, msgSearch)}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    const sender = getUserById(msg.senderId);
                    const isMe = msg.senderId === currentUser.id;
                    const isStarred = msg.starredBy?.includes(currentUser.id);
                    return (
                      <div key={msg.id}>
                        {showDateSep && (
                          <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[11px] font-medium text-muted-foreground bg-card px-3 py-1 rounded-full border shadow-sm">
                              {dateSepLabel}
                            </span>
                            <div className="flex-1 h-px bg-border" />
                          </div>
                        )}
                        <div
                          className={`flex gap-2 py-1 ${isMe ? "flex-row-reverse" : ""} group rounded-lg transition-all duration-300 ${isActiveMatch ? "bg-primary/10 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]" : isMatched ? "bg-secondary/50" : ""} ${isSpotlighted ? "bg-gradient-to-r from-primary/18 via-primary/10 to-transparent shadow-[0_10px_30px_-16px_rgba(59,130,246,0.55)]" : ""} ${isSelectedForForward ? "bg-gradient-to-r from-cyan-400/12 via-emerald-300/10 to-transparent shadow-[0_12px_28px_-18px_rgba(16,185,129,0.75)]" : ""}`}
                          data-message-id={msg.id}
                          ref={(el) => {
                            if (el) messageRefs.current[msg.id] = el;
                          }}
                        >
                          {isSelectionMode && (
                            <button
                              type="button"
                              className={`mt-1 h-5 w-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 ${isSelectedForForward ? "bg-gradient-to-br from-cyan-500 to-emerald-400 text-white shadow-md shadow-emerald-500/25 scale-105" : "bg-background/70 text-muted-foreground border border-border/60 hover:bg-secondary"}`}
                              onClick={() => toggleMessageSelection(msg.id)}
                              aria-label={
                                isSelectedForForward
                                  ? "Deselect message"
                                  : "Select message"
                              }
                              title={
                                isSelectedForForward
                                  ? "Deselect message"
                                  : "Select message"
                              }
                            >
                              {isSelectedForForward && (
                                <Check className="h-3 w-3" />
                              )}
                            </button>
                          )}
                          {sender ? (
                            <UserHoverCard user={sender}>
                              <Avatar
                                className="h-7 w-7 shrink-0 cursor-pointer"
                                onClick={() =>
                                  navigate(`/profile/${sender.id}`)
                                }
                              >
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                                  {getUserInitials(sender.name)}
                                </AvatarFallback>
                              </Avatar>
                            </UserHoverCard>
                          ) : (
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                                ?
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div className="max-w-[70%] space-y-1">
                            <div
                              className={`rounded-xl px-3 py-2 text-sm relative ${
                                isMe
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary"
                              }`}
                            >
                              {isStarred && (
                                <Star className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 text-warning fill-warning" />
                              )}
                              {!isMe && sender && (
                                <p
                                  className="text-xs font-semibold mb-0.5 opacity-70 cursor-pointer hover:underline"
                                  onClick={() =>
                                    navigate(`/profile/${sender.id}`)
                                  }
                                >
                                  {sender.name}
                                </p>
                              )}
                              {msg.sharedMemo && !isDeletedMessage ? (
                                <div
                                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${isMe ? "bg-primary-foreground/10" : "bg-background"}`}
                                  onClick={() =>
                                    navigate(`/memos/${msg.sharedMemo!.memoId}`)
                                  }
                                >
                                  <FileText className="h-4 w-4 shrink-0" />
                                  <span className="text-xs font-medium">
                                    {highlightText(
                                      msg.sharedMemo.title,
                                      msgSearch,
                                    )}
                                  </span>
                                </div>
                              ) : (
                                <>
                                  {isForwardedMessage && (
                                    <p
                                      className={`mb-1 text-[10px] uppercase tracking-wide font-semibold ${isMe ? "text-white/85" : "text-blue-600"}`}
                                    >
                                      forwarded
                                    </p>
                                  )}
                                  {editingMessageId === msg.id ? (
                                    <div className="space-y-2 min-h-[96px]">
                                      <textarea
                                        ref={
                                          editingMessageId === msg.id
                                            ? editTextareaRef
                                            : null
                                        }
                                        value={editingMessageText}
                                        onChange={(e) =>
                                          setEditingMessageText(e.target.value)
                                        }
                                        onInput={(e) => {
                                          const target = e.currentTarget;
                                          target.style.height = "auto";
                                          target.style.height = `${target.scrollHeight}px`;
                                        }}
                                        rows={estimatedEditRows}
                                        maxLength={MESSAGE_BODY_MAX_LENGTH}
                                        className={`w-full min-h-[96px] rounded-md border px-3 py-2 text-sm resize-none overflow-hidden ${isMe ? "bg-primary-foreground/20 border-primary-foreground/30 text-primary-foreground placeholder:text-primary-foreground/70" : "bg-background border-border"}`}
                                        placeholder="Edit message"
                                        autoFocus
                                      />
                                      <p
                                        className={`text-[10px] ${isMe ? "text-primary-foreground/75" : "text-muted-foreground"}`}
                                      >
                                        {editingMessageText.length}/
                                        {MESSAGE_BODY_MAX_LENGTH}
                                      </p>
                                      <div className="flex items-center gap-2 justify-end">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          className={`h-7 px-2 ${isMe ? "text-primary-foreground hover:bg-primary-foreground/20" : ""}`}
                                          onClick={cancelEditMessage}
                                          disabled={isSavingMessageEdit}
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          className="h-7 px-2"
                                          onClick={() => {
                                            void saveEditMessage();
                                          }}
                                          disabled={isSavingMessageEdit}
                                        >
                                          Save
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    displayBody && (
                                      <p
                                        className={
                                          isDeletedMessage
                                            ? "italic opacity-75"
                                            : undefined
                                        }
                                      >
                                        {highlightText(displayBody, msgSearch)}
                                      </p>
                                    )
                                  )}
                                  {!isDeletedMessage &&
                                    msg.attachments.length > 0 && (
                                      <div className="mt-2 space-y-1.5">
                                        {msg.attachments
                                          .filter((a) =>
                                            a.type.startsWith("image/"),
                                          )
                                          .map((att) => (
                                            <img
                                              key={att.id}
                                              src={att.url}
                                              alt={att.name}
                                              className="max-w-[220px] max-h-[180px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity border border-border/20"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setLightboxImage(att);
                                              }}
                                            />
                                          ))}
                                        {msg.attachments
                                          .filter(
                                            (a) => !a.type.startsWith("image/"),
                                          )
                                          .map((att) => (
                                            <div
                                              key={att.id}
                                              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer hover:opacity-80 transition-opacity ${isMe ? "bg-primary-foreground/15" : "bg-background border border-border/50"}`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                window.open(att.url, "_blank");
                                              }}
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
                                </>
                              )}
                              <div
                                className={`text-[10px] mt-1 flex items-center gap-2 ${isMe ? "text-primary-foreground/70 justify-end" : "text-muted-foreground"}`}
                              >
                                <span>{format(msgDate, "h:mm a")}</span>
                                {msg.isEdited && !isDeletedMessage && (
                                  <span
                                    className={
                                      isMe
                                        ? "text-primary-foreground/80 italic"
                                        : "italic"
                                    }
                                  >
                                    edited
                                  </span>
                                )}
                                {isMe &&
                                  (() => {
                                    if (isDeletedMessage) return null;
                                    const status = getSenderMessageStatus(msg);
                                    if (!status) return null;

                                    if (status.kind === "read") {
                                      const readerNames = (
                                        status.readerIds || []
                                      )
                                        .map(
                                          (readerId) =>
                                            getUserById(readerId)?.name,
                                        )
                                        .filter(Boolean) as string[];

                                      if (status.showReaderDetails) {
                                        return (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <button
                                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/20 font-semibold text-white hover:bg-white/30 transition-colors"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setReadersModalIds(
                                                    status.readerIds || [],
                                                  );
                                                }}
                                              >
                                                <CheckCheck className="h-3.5 w-3.5 text-white" />
                                                {status.label}
                                              </button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              {readerNames.length > 0
                                                ? readerNames.join(", ")
                                                : "No readers yet"}
                                            </TooltipContent>
                                          </Tooltip>
                                        );
                                      }

                                      return (
                                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/20 font-semibold text-white">
                                          <CheckCheck className="h-3.5 w-3.5 text-white" />
                                          <span>{status.label}</span>
                                        </div>
                                      );
                                    }

                                    if (status.kind === "online") {
                                      return (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/20">
                                              <CheckCheck className="h-4 w-4 text-white animate-pulse" />
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Delivered
                                          </TooltipContent>
                                        </Tooltip>
                                      );
                                    }

                                    return (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/20">
                                            <Check className="h-4 w-4 text-white" />
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>Sent</TooltipContent>
                                      </Tooltip>
                                    );
                                  })()}
                              </div>
                            </div>

                            {!isDeletedMessage && msg.reactions.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {msg.reactions.map((r) => {
                                  const isActive = r.users.includes(
                                    currentUser.id,
                                  );
                                  return (
                                    <button
                                      key={r.emoji}
                                      className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                                        isActive
                                          ? "bg-primary/10 border-primary/30"
                                          : "bg-secondary border-transparent hover:border-border"
                                      }`}
                                      onClick={() =>
                                        addReaction(
                                          msg.id,
                                          r.emoji,
                                          currentUser.id,
                                        )
                                      }
                                    >
                                      {r.emoji} {r.users.length}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            <div
                              className={`opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 ${isMe ? "justify-end" : ""}`}
                            >
                              {isMe &&
                                !msg.isSystem &&
                                !msg.sharedMemo &&
                                !isDeletedMessage && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        className="text-xs p-0.5 rounded hover:bg-secondary transition-colors"
                                        onClick={() =>
                                          startEditMessage(msg.id, displayBody)
                                        }
                                        aria-label="Edit message"
                                        title="Edit message"
                                      >
                                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Edit message
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              {isMe && !msg.isSystem && !isDeletedMessage && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className="text-xs p-0.5 rounded hover:bg-secondary transition-colors"
                                      onClick={() => {
                                        void handleDeleteMessage(msg.id);
                                      }}
                                      aria-label="Delete message"
                                      title="Delete message"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Delete message
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {!isDeletedMessage && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className="text-xs p-0.5 rounded hover:bg-secondary transition-colors"
                                      onClick={() =>
                                        starMessage(msg.id, currentUser.id)
                                      }
                                      aria-label={
                                        isStarred
                                          ? "Unstar this message"
                                          : "Star this message"
                                      }
                                      title={
                                        isStarred
                                          ? "Unstar this message"
                                          : "Star this message"
                                      }
                                    >
                                      {isStarred ? (
                                        <StarOff className="h-3.5 w-3.5 text-warning" />
                                      ) : (
                                        <Star className="h-3.5 w-3.5 text-muted-foreground" />
                                      )}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {isStarred
                                      ? "Unstar this message"
                                      : "Star this message for quick access"}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {!isDeletedMessage &&
                                QUICK_EMOJIS.slice(0, 4).map((emoji) => (
                                  <button
                                    key={emoji}
                                    className="text-xs p-0.5 rounded hover:bg-secondary transition-colors"
                                    onClick={() =>
                                      addReaction(msg.id, emoji, currentUser.id)
                                    }
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              {!isDeletedMessage && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      className="text-xs p-0.5 rounded hover:bg-secondary transition-colors"
                                      aria-label="More reactions"
                                      title="More reactions"
                                    >
                                      <SmilePlus className="h-3.5 w-3.5 text-muted-foreground" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-2">
                                    <div className="flex gap-1 flex-wrap max-w-[180px]">
                                      {QUICK_EMOJIS.map((emoji) => (
                                        <button
                                          key={emoji}
                                          className="text-lg p-1 rounded hover:bg-secondary"
                                          onClick={() =>
                                            addReaction(
                                              msg.id,
                                              emoji,
                                              currentUser.id,
                                            )
                                          }
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {convTyping.length > 0 && (
                    <div className="flex gap-2 items-center">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                          {getUserById(convTyping[0])
                            ? getUserInitials(getUserById(convTyping[0])!.name)
                            : "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-secondary rounded-xl px-3 py-2 flex items-center gap-1">
                        <span className="flex gap-0.5">
                          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
                          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {showScrollToBottom && (
                  <Button
                    type="button"
                    size="icon"
                    className="absolute bottom-24 right-4 rounded-full shadow-lg"
                    onClick={() => scrollToBottom("smooth")}
                    aria-label="Scroll to latest message"
                    title="Scroll to latest message"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                )}

                {/* Pending attachments preview */}
                {pendingAttachments.length > 0 && (
                  <div className="px-3 pt-2 border-t flex gap-2 flex-wrap">
                    {pendingAttachments.map((att) => (
                      <div key={att.id} className="relative group/att">
                        {att.type.startsWith("image/") ? (
                          <img
                            src={att.url}
                            alt={att.name}
                            className="h-16 w-16 rounded-lg object-cover border"
                          />
                        ) : (
                          <div className="h-16 px-3 rounded-lg border bg-secondary flex items-center gap-2">
                            <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs truncate max-w-[100px]">
                              {att.name}
                            </span>
                          </div>
                        )}
                        <button
                          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/att:opacity-100 transition-opacity"
                          onClick={() => removePendingAttachment(att.id)}
                          aria-label={`Remove attachment ${att.name}`}
                          title={`Remove attachment ${att.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  className={`p-3 ${pendingAttachments.length === 0 ? "border-t" : ""} flex gap-2`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    aria-label="Attach files"
                    title="Attach files"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Attach files</TooltipContent>
                  </Tooltip>
                  <Popover open={shareOpen} onOpenChange={setShareOpen}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        Share a memo in this conversation
                      </TooltipContent>
                    </Tooltip>
                    <PopoverContent className="w-72 p-2" align="start">
                      <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
                        Share a memo
                      </p>
                      <div className="space-y-1 max-h-48 overflow-auto scrollbar-thin">
                        {memos
                          .filter((m) => m.status !== "deleted")
                          .slice(0, 10)
                          .map((m) => (
                            <button
                              key={m.id}
                              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-secondary text-sm flex items-center gap-2 transition-colors"
                              onClick={() => handleShareMemo(m.id, m.title)}
                            >
                              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate">{m.title}</span>
                            </button>
                          ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <MentionInput
                    value={newMessage}
                    onChange={(value) => {
                      setNewMessage(value);
                      if (selectedConv) {
                        simulateTyping(selectedConv, currentUser.id);
                      }
                    }}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Type a message... (@ to mention)"
                    className="flex basis-0 w-full min-w-0 sm:min-w-[420px] lg:min-w-[710px]"
                    rows={2}
                    maxLength={MESSAGE_BODY_MAX_LENGTH}
                  />
                  <span className="self-end text-[10px] text-muted-foreground tabular-nums">
                    {newMessage.length}/{MESSAGE_BODY_MAX_LENGTH}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        onClick={handleSend}
                        disabled={
                          (!newMessage.trim() &&
                            pendingAttachments.length === 0) ||
                          isUploadingAttachments
                        }
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Send message</TooltipContent>
                  </Tooltip>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a conversation
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isForwardDialogOpen} onOpenChange={setIsForwardDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Forward Messages</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {selectedMessages.length} selected message
              {selectedMessages.length !== 1 ? "s" : ""}
            </p>
            <Input
              value={forwardUserSearch}
              onChange={(e) => setForwardUserSearch(e.target.value)}
              placeholder="Search users by name or email"
            />
            <div className="max-h-64 overflow-auto border rounded-md">
              {forwardCandidates.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3">
                  No users found
                </p>
              ) : (
                forwardCandidates.map((user) => {
                  const selected = selectedForwardUserIds.includes(user.id);
                  return (
                    <button
                      key={user.id}
                      type="button"
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-secondary ${selected ? "bg-secondary" : ""}`}
                      onClick={() => toggleForwardRecipient(user.id)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {user.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                      {selected && (
                        <CheckCheck className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsForwardDialogOpen(false)}
                disabled={isForwarding}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleForwardMessages}
                disabled={isForwarding || selectedForwardUserIds.length === 0}
              >
                {isForwarding ? "Forwarding..." : "Forward"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Lightbox */}
      <Dialog
        open={!!lightboxImage}
        onOpenChange={() => setLightboxImage(null)}
      >
        <DialogContent className="max-w-2xl p-2">
          <DialogHeader className="px-4 pt-2">
            <DialogTitle className="text-sm truncate">
              {lightboxImage?.name}
            </DialogTitle>
          </DialogHeader>
          {lightboxImage && (
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name}
              className="w-full max-h-[75vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!readersModalIds}
        onOpenChange={(open) => {
          if (!open) setReadersModalIds(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Read by</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-72 overflow-auto">
            {(readersModalIds || []).map((readerId) => {
              const reader = getUserById(readerId);
              return (
                <div
                  key={readerId}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <button
                    className="text-sm text-left hover:underline"
                    onClick={() => {
                      navigate(`/profile/${readerId}`);
                      setReadersModalIds(null);
                    }}
                  >
                    {reader?.name || "Unknown user"}
                  </button>
                  {onlineUsers.has(readerId) && (
                    <span className="text-xs text-success">online</span>
                  )}
                </div>
              );
            })}
            {(readersModalIds || []).length === 0 && (
              <p className="text-sm text-muted-foreground">No readers yet</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(messageToDelete)}
        onOpenChange={(open) => {
          if (!open) setMessageToDelete(null);
        }}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              {messageToDelete
                ? `This will remove "${messageToDelete.preview.slice(0, 120)}" for everyone in the conversation.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteMessage}
            >
              Delete message
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Messages;
