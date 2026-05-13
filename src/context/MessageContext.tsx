import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { Message, Conversation, SharedMemo, Attachment } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { toast } from "sonner";
import { MessageSquare, X, AlertCircle } from "lucide-react";
import { apiRequest, getSafeErrorMessage } from "@/lib/api";

const DELETED_MESSAGE_TEXT = "This message was deleted";
const MESSAGE_BODY_MAX_LENGTH = 10000;

interface MessageContextType {
  conversations: Conversation[];
  messages: Message[];
  sendMessage: (
    conversationId: string,
    body: string,
    sharedMemo?: SharedMemo,
    attachments?: Attachment[],
  ) => void;
  sendSystemMessage: (conversationId: string, body: string) => void;
  addReaction: (messageId: string, emoji: string, userId: string) => void;
  markAsRead: (conversationId: string, userId: string) => void;
  getConversationMessages: (conversationId: string) => Message[];
  refreshConversationMessages: (conversationId: string) => Promise<void>;
  typingUsers: Record<string, string[]>;
  simulateTyping: (conversationId: string, userId: string) => void;
  createConversation: (
    participantIds: string[],
    name?: string,
    groupId?: string,
  ) => Promise<Conversation>;
  editMessage: (messageId: string, body: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  starMessage: (messageId: string, userId: string) => void;
  starredMessages: Message[];
  loadStarredMessages: () => Promise<void>;
  getUnreadCount: (conversationId: string, userId: string) => number;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

function showFriendlyErrorToast(message: string) {
  toast.custom(
    (toastId) => (
      <div className="w-[400px] flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 shadow-lg">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-red-900">
            Action not completed
          </p>
          <p className="mt-0.5 text-xs text-red-800">{message}</p>
        </div>
        <button
          onClick={() => toast.dismiss(toastId)}
          className="shrink-0 rounded p-0.5 text-red-500 hover:text-red-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    ),
    { duration: 5000 },
  );
}

// Collapse [{emoji, userId}] → [{emoji, users[]}]
function aggregateMsgReactions(
  reactions: any[],
): { emoji: string; users: string[] }[] {
  const map: Record<string, Set<string>> = {};
  for (const r of reactions) {
    if (!r.emoji) continue;
    // DB format: { emoji, users: string[] }
    if (Array.isArray(r.users)) {
      if (!map[r.emoji]) map[r.emoji] = new Set();
      for (const uid of r.users) {
        if (uid) map[r.emoji].add(uid);
      }
    } else {
      // Flat format: { emoji, userId } or { emoji, user: { id } }
      const userId = r.userId || r.user?.id;
      if (!userId) continue;
      if (!map[r.emoji]) map[r.emoji] = new Set();
      map[r.emoji].add(userId);
    }
  }
  return Object.entries(map).map(([emoji, users]) => ({
    emoji,
    users: Array.from(users),
  }));
}

function normalizeArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (typeof value === "object") {
    if (Array.isArray((value as any).items)) return (value as any).items;
    if ((value as any).id || (value as any).url || (value as any).filename) {
      return [value];
    }
  }
  return [];
}

function hasMatchingAttachments(left: Attachment[], right: Attachment[]) {
  if (left.length !== right.length) return false;

  return left.every((attachment, index) => {
    const candidate = right[index];
    return (
      attachment.id === candidate?.id ||
      (attachment.name === candidate?.name && attachment.url === candidate?.url)
    );
  });
}

function isSameOptimisticMessage(
  localMessage: Message,
  remoteMessage: Message,
) {
  if (!localMessage.clientOnly || localMessage.isSystem) {
    return false;
  }

  if (localMessage.conversationId !== remoteMessage.conversationId) {
    return false;
  }

  if (localMessage.senderId !== remoteMessage.senderId) {
    return false;
  }

  if ((localMessage.body || "") !== (remoteMessage.body || "")) {
    return false;
  }

  if (
    (localMessage.sharedMemo?.memoId || "") !==
    (remoteMessage.sharedMemo?.memoId || "")
  ) {
    return false;
  }

  if (
    !hasMatchingAttachments(
      localMessage.attachments || [],
      remoteMessage.attachments || [],
    )
  ) {
    return false;
  }

  const localTime = new Date(localMessage.createdAt).getTime();
  const remoteTime = new Date(remoteMessage.createdAt).getTime();
  return Math.abs(localTime - remoteTime) <= 30000;
}

export function MessageProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, isAuthenticated } = useAuth();
  const { socket, joinRoom, leaveRoom, onEvent, offEvent } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const typingTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const loadedConvIds = useRef<Set<string>>(new Set());

  const createClientSystemMessage = useCallback(
    (conversationId: string, body: string): Message => ({
      id: `sys_${conversationId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      conversationId,
      senderId: "system",
      body,
      attachments: [],
      reactions: [],
      readBy: [],
      isSystem: true,
      clientOnly: true,
      createdAt: new Date().toISOString(),
    }),
    [],
  );

  // ── mapping ────────────────────────────────────────────────────────
  const mapMsg = useCallback((m: any): Message => {
    const normalizedAttachments = normalizeArray(m.attachments).map(
      (a: any) => ({
        id: a.id,
        name: a.name || a.filename,
        url: a.url,
        type: a.type || a.mimeType || "file",
        size: a.size,
      }),
    );
    const normalizedReadBy = normalizeArray(m.readBy).map((r: any) =>
      typeof r === "string" ? r : r.userId,
    );
    const normalizedStarredBy = normalizeArray(m.starredBy).map((s: any) =>
      typeof s === "string" ? s : s.userId,
    );

    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId || m.sender?.id,
      body: m.body,
      attachments: normalizedAttachments,
      reactions: aggregateMsgReactions(normalizeArray(m.reactions)),
      sharedMemo: m.sharedMemo?.memoId
        ? { memoId: m.sharedMemo.memoId, title: m.sharedMemo.title || "" }
        : m.sharedMemoId
          ? { memoId: m.sharedMemoId, title: m.sharedMemo?.title || "" }
          : undefined,
      readBy: normalizedReadBy,
      isSystem: m.isSystem || false,
      isEdited: Boolean(m.isEdited),
      editedAt: m.editedAt,
      isDeleted: Boolean(m.isDeleted),
      deletedAt: m.deletedAt,
      clientOnly: Boolean(m.clientOnly),
      starredBy: normalizedStarredBy,
      createdAt: m.createdAt,
    };
  }, []);

  const mapConv = useCallback(
    (c: any): Conversation => {
      const participantIds = Array.isArray(c.participantIds)
        ? c.participantIds
        : (c.participants || []).map((p: any) => p.userId || p.id);

      const latestMessage =
        c.lastMessage ||
        (Array.isArray(c.messages) && c.messages.length > 0
          ? c.messages[0]
          : null);

      const mappedLastMessage = latestMessage
        ? mapMsg({
            ...latestMessage,
            conversationId: latestMessage.conversationId || c.id,
          })
        : undefined;

      return {
        id: c.id,
        type: (c.type || "").toUpperCase() === "GROUP" ? "group" : "direct",
        participantIds,
        name: c.name,
        groupId: c.groupId,
        messageCount: c._count?.messages || 0,
        lastMessage: mappedLastMessage,
        updatedAt:
          c.updatedAt ||
          mappedLastMessage?.createdAt ||
          new Date().toISOString(),
      };
    },
    [mapMsg],
  );

  const loadConversations = useCallback(async () => {
    if (!isAuthenticated || !currentUser?.id) return;
    try {
      const res = await apiRequest<{ conversations: any[] }>("/conversations");
      setConversations((res.data.conversations || []).map(mapConv));
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }, [isAuthenticated, currentUser?.id, mapConv]);

  const loadStarredMessages = useCallback(async () => {
    if (!isAuthenticated || !currentUser?.id) return;
    try {
      const res = await apiRequest<{ messages: any[] }>(
        "/messages/starred?limit=100",
      );
      const mapped = (res.data.messages || []).map(mapMsg);
      setMessages((prev) => {
        const mappedById = new Map(mapped.map((message) => [message.id, message]));

        const next = prev.map((message) =>
          mappedById.get(message.id) ?? message,
        );

        const existing = new Set(next.map((message) => message.id));
        for (const message of mapped) {
          if (!existing.has(message.id)) {
            next.push(message);
          }
        }

        return next;
      });
    } catch (err) {
      console.error("Failed to load starred messages:", err);
    }
  }, [isAuthenticated, currentUser?.id, mapMsg]);

  // ── initial load ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) {
      setConversations([]);
      setMessages([]);
      loadedConvIds.current.clear();
      return;
    }

    void loadConversations();
  }, [isAuthenticated, currentUser?.id, loadConversations]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;

    void loadStarredMessages();
  }, [isAuthenticated, currentUser?.id, loadStarredMessages]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;

    const syncRealtime = () => {
      void loadConversations();
      void loadStarredMessages();
    };

    // Socket events are the primary sync channel; keep polling as a low-rate fallback.
    const interval = window.setInterval(syncRealtime, 60000);
    const handleFocus = () => syncRealtime();
    const handleVisibility = () => {
      if (!document.hidden) syncRealtime();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [
    isAuthenticated,
    currentUser?.id,
    loadConversations,
    loadStarredMessages,
  ]);

  useEffect(() => {
    if (!socket || !currentUser) return;
    const joinedConversationRooms = conversations.map(
      (conversation) => `conversation_${conversation.id}`,
    );
    joinedConversationRooms.forEach((roomId) => joinRoom(roomId));

    return () => {
      joinedConversationRooms.forEach((roomId) => leaveRoom(roomId));
    };
  }, [socket, currentUser?.id, conversations, joinRoom, leaveRoom]);

  // ── Socket.IO real-time messaging ──────────────────────────────────
  useEffect(() => {
    if (!socket || !currentUser) return;

    // Listen for new messages
    const handleNewMessage = (data: {
      message: any;
      conversationId: string;
    }) => {
      const mapped = mapMsg(data.message);
      setMessages((prev) => {
        const existingById = prev.find((message) => message.id === mapped.id);
        if (existingById) {
          return prev.map((message) =>
            message.id === mapped.id
              ? { ...message, ...mapped, clientOnly: false }
              : message,
          );
        }

        const optimisticMatch = prev.find((message) =>
          isSameOptimisticMessage(message, mapped),
        );

        if (!optimisticMatch) {
          return [...prev, mapped];
        }

        return prev.map((message) =>
          message.id === optimisticMatch.id
            ? { ...mapped, clientOnly: false }
            : message,
        );
      });
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === data.conversationId
            ? {
                ...conversation,
                lastMessage: mapped,
                updatedAt: mapped.createdAt,
              }
            : conversation,
        ),
      );

      if (mapped.senderId && mapped.senderId !== currentUser.id) {
        const senderName = data.message?.sender?.name || "New message";
        const messagePreview = mapped.body || "Sent an attachment";

        // OS notification when tab is not focused
        if (
          "Notification" in window &&
          window.Notification.permission === "granted" &&
          document.hidden
        ) {
          try {
            const n = new window.Notification(senderName, {
              body: messagePreview,
              icon: "/favicon.ico",
              tag: "memohub-message",
            });
            setTimeout(() => n.close(), 6000);
          } catch {
            // ignore
          }
        }

        toast.custom(
          (toastId) => (
            <div className="w-[380px] rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-slate-900 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {senderName}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-700">
                    {messagePreview}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toast.dismiss(toastId)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                  aria-label="Close notification"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ),
          { duration: 4500 },
        );
      }
    };

    // Listen for typing indicators
    const handleUserTyping = (data: {
      conversationId: string;
      userId: string;
    }) => {
      if (data.userId === currentUser.id) return;
      setTypingUsers((prev) => ({
        ...prev,
        [data.conversationId]: [
          ...new Set([...(prev[data.conversationId] || []), data.userId]),
        ],
      }));
      const key = `${data.conversationId}:${data.userId}`;
      if (typingTimers.current[key]) clearTimeout(typingTimers.current[key]);
      typingTimers.current[key] = setTimeout(() => {
        setTypingUsers((prev) => ({
          ...prev,
          [data.conversationId]: (prev[data.conversationId] || []).filter(
            (id) => id !== data.userId,
          ),
        }));
      }, 3000);
    };

    const handleUserStoppedTyping = (data: {
      conversationId: string;
      userId: string;
    }) => {
      setTypingUsers((prev) => ({
        ...prev,
        [data.conversationId]: (prev[data.conversationId] || []).filter(
          (id) => id !== data.userId,
        ),
      }));
    };

    // Listen for message read receipts
    const handleMessageRead = (data: {
      messageId: string;
      conversationId: string;
      userId: string;
    }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.conversationId === data.conversationId
            ? {
                ...msg,
                readBy: [...new Set([...(msg.readBy || []), data.userId])],
              }
            : msg,
        ),
      );

      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== data.conversationId) return conversation;
          if (conversation.lastMessage?.id !== data.messageId)
            return conversation;

          return {
            ...conversation,
            lastMessage: {
              ...conversation.lastMessage,
              readBy: [
                ...new Set([
                  ...(conversation.lastMessage.readBy || []),
                  data.userId,
                ]),
              ],
            },
          };
        }),
      );
    };

    const handleReactionAdded = (data: {
      messageId: string;
      conversationId: string;
      emoji: string;
      userId: string;
      userName?: string;
    }) => {
      const emoji = data.emoji;
      const reactionUserId = data.userId;
      if (!emoji || !reactionUserId) return;

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== data.messageId) return msg;
          const existing = msg.reactions.find(
            (reaction) => reaction.emoji === emoji,
          );
          if (existing) {
            if (existing.users.includes(reactionUserId)) return msg;
            return {
              ...msg,
              reactions: msg.reactions.map((reaction) =>
                reaction.emoji === emoji
                  ? { ...reaction, users: [...reaction.users, reactionUserId] }
                  : reaction,
              ),
            };
          }
          return {
            ...msg,
            reactions: [...msg.reactions, { emoji, users: [reactionUserId] }],
          };
        }),
      );

      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== data.conversationId) return conversation;
          if (conversation.lastMessage?.id !== data.messageId)
            return conversation;

          const existing = conversation.lastMessage.reactions.find(
            (reaction) => reaction.emoji === emoji,
          );

          return {
            ...conversation,
            lastMessage: {
              ...conversation.lastMessage,
              reactions: existing
                ? conversation.lastMessage.reactions.map((reaction) =>
                    reaction.emoji === emoji
                      ? reaction.users.includes(reactionUserId)
                        ? reaction
                        : {
                            ...reaction,
                            users: [...reaction.users, reactionUserId],
                          }
                      : reaction,
                  )
                : [
                    ...conversation.lastMessage.reactions,
                    { emoji, users: [reactionUserId] },
                  ],
            },
          };
        }),
      );
    };

    const handleReactionRemoved = (data: {
      messageId: string;
      userId: string;
      emoji: string;
    }) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== data.messageId) return msg;
          const nextReactions = msg.reactions
            .map((reaction) =>
              reaction.emoji === data.emoji
                ? {
                    ...reaction,
                    users: reaction.users.filter((id) => id !== data.userId),
                  }
                : reaction,
            )
            .filter((reaction) => reaction.users.length > 0);
          return { ...msg, reactions: nextReactions };
        }),
      );

      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.lastMessage?.id !== data.messageId)
            return conversation;
          const nextReactions = conversation.lastMessage.reactions
            .map((reaction) =>
              reaction.emoji === data.emoji
                ? {
                    ...reaction,
                    users: reaction.users.filter((id) => id !== data.userId),
                  }
                : reaction,
            )
            .filter((reaction) => reaction.users.length > 0);

          return {
            ...conversation,
            lastMessage: {
              ...conversation.lastMessage,
              reactions: nextReactions,
            },
          };
        }),
      );
    };

    const handleMessageStarred = (data: {
      messageId: string;
      starredBy: Array<string | { userId: string }>;
    }) => {
      const starredBy = (data.starredBy || []).map((item) =>
        typeof item === "string" ? item : item.userId,
      );
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId ? { ...msg, starredBy } : msg,
        ),
      );
    };

    const handleMessageUpdated = (data: {
      message: any;
      conversationId: string;
    }) => {
      const mapped = mapMsg(data.message);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === mapped.id
            ? {
                ...msg,
                ...mapped,
              }
            : msg,
        ),
      );

      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== data.conversationId) return conversation;
          if (conversation.lastMessage?.id !== mapped.id) return conversation;
          return {
            ...conversation,
            lastMessage: {
              ...conversation.lastMessage,
              ...mapped,
            },
          };
        }),
      );
    };

    const handleMessageDeleted = (data: {
      messageId: string;
      conversationId: string;
      deletedAt?: string;
      message?: any;
    }) => {
      const deletedAt = data.deletedAt || new Date().toISOString();
      const mappedDeleted = data.message ? mapMsg(data.message) : null;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? {
                ...msg,
                ...(mappedDeleted || {}),
                body: DELETED_MESSAGE_TEXT,
                attachments: [],
                reactions: [],
                sharedMemo: undefined,
                isDeleted: true,
                deletedAt,
              }
            : msg,
        ),
      );

      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== data.conversationId) return conversation;
          if (conversation.lastMessage?.id !== data.messageId)
            return conversation;

          return {
            ...conversation,
            lastMessage: {
              ...conversation.lastMessage,
              ...(mappedDeleted || {}),
              body: DELETED_MESSAGE_TEXT,
              attachments: [],
              reactions: [],
              sharedMemo: undefined,
              isDeleted: true,
              deletedAt,
            },
          };
        }),
      );
    };

    onEvent("new_message", handleNewMessage);
    onEvent("user_typing", handleUserTyping);
    onEvent("user_stopped_typing", handleUserStoppedTyping);
    onEvent("message_read", handleMessageRead);
    onEvent("reaction_added", handleReactionAdded);
    onEvent("reaction_removed", handleReactionRemoved);
    onEvent("message_starred", handleMessageStarred);
    onEvent("message_updated", handleMessageUpdated);
    onEvent("message_deleted", handleMessageDeleted);

    return () => {
      offEvent("new_message", handleNewMessage);
      offEvent("user_typing", handleUserTyping);
      offEvent("user_stopped_typing", handleUserStoppedTyping);
      offEvent("message_read", handleMessageRead);
      offEvent("reaction_added", handleReactionAdded);
      offEvent("reaction_removed", handleReactionRemoved);
      offEvent("message_starred", handleMessageStarred);
      offEvent("message_updated", handleMessageUpdated);
      offEvent("message_deleted", handleMessageDeleted);
    };
  }, [
    socket,
    currentUser?.id,
    mapMsg,
    onEvent,
    offEvent,
    currentUser?.id,
    createClientSystemMessage,
  ]);

  // When user is added to a group conversation (e.g. accepting an invite),
  // reload conversations so the new chat room appears immediately
  useEffect(() => {
    if (!socket || !currentUser) return;

    const handleConversationsRefresh = () => {
      void loadConversations();
    };

    onEvent("conversations:refresh", handleConversationsRefresh);

    return () => {
      offEvent("conversations:refresh", handleConversationsRefresh);
    };
  }, [socket, currentUser?.id, loadConversations, onEvent, offEvent]);

  const loadConversationMessages = useCallback(
    async (conversationId: string, force = false) => {
      if (!conversationId || !conversationId.trim()) return;
      if (
        !isAuthenticated ||
        (!force && loadedConvIds.current.has(conversationId))
      )
        return;
      loadedConvIds.current.add(conversationId);
      try {
        const res = await apiRequest<{ messages: any[] }>(
          `/conversations/${conversationId}/messages`,
        );
        const mapped = (res.data.messages || []).map((raw) =>
          mapMsg({
            ...raw,
            conversationId: raw?.conversationId || conversationId,
          }),
        );
        setMessages((prev) => {
          const otherConversationMessages = prev.filter(
            (message) => message.conversationId !== conversationId,
          );
          const currentConversationMessages = prev.filter(
            (message) => message.conversationId === conversationId,
          );
          const mappedIds = new Set(mapped.map((message) => message.id));
          const matchedOptimisticIds = new Set<string>();

          const mergedMapped = mapped.map((message) => {
            const existing = currentConversationMessages.find(
              (candidate) =>
                candidate.id === message.id ||
                isSameOptimisticMessage(candidate, message),
            );

            if (existing?.clientOnly && existing.id !== message.id) {
              matchedOptimisticIds.add(existing.id);
            }

            return existing
              ? {
                  ...existing,
                  ...message,
                  isEdited: message.isEdited || existing.isEdited,
                  editedAt: message.editedAt || existing.editedAt,
                  isDeleted: message.isDeleted || existing.isDeleted,
                  deletedAt: message.deletedAt || existing.deletedAt,
                  clientOnly: existing.clientOnly || message.clientOnly,
                }
              : message;
          });

          const preservedLocalMessages = currentConversationMessages.filter(
            (message) =>
              !mappedIds.has(message.id) &&
              !matchedOptimisticIds.has(message.id) &&
              (message.isDeleted || message.clientOnly),
          );

          return [
            ...otherConversationMessages,
            ...mergedMapped,
            ...preservedLocalMessages,
          ].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        });
      } catch (e) {
        loadedConvIds.current.delete(conversationId);
        console.error("Failed to load messages for conv", conversationId, e);
      }
    },
    [isAuthenticated, mapMsg],
  );

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;

    const refreshLoadedConversations = () => {
      loadedConvIds.current.forEach((conversationId) => {
        void loadConversationMessages(conversationId, true);
      });
    };

    const interval = window.setInterval(refreshLoadedConversations, 45000);
    const handleFocus = () => refreshLoadedConversations();

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [isAuthenticated, currentUser?.id, loadConversationMessages]);

  useEffect(() => {
    if (!socket || !isAuthenticated || !currentUser?.id) return;

    const handleReconnect = () => {
      void loadConversations();
      void loadStarredMessages();
      loadedConvIds.current.forEach((conversationId) => {
        void loadConversationMessages(conversationId, true);
      });
    };

    socket.on("connect", handleReconnect);
    return () => {
      socket.off("connect", handleReconnect);
    };
  }, [
    socket,
    isAuthenticated,
    currentUser?.id,
    loadConversations,
    loadStarredMessages,
    loadConversationMessages,
  ]);

  const getConversationMessages = useCallback(
    (conversationId: string) => {
      if (!conversationId || !conversationId.trim()) {
        return [];
      }
      loadConversationMessages(conversationId);
      return messages.filter((m) => m.conversationId === conversationId);
    },
    [messages, loadConversationMessages],
  );

  const refreshConversationMessages = useCallback(
    async (conversationId: string) => {
      await loadConversationMessages(conversationId, true);
    },
    [loadConversationMessages],
  );

  const getUnreadCount = useCallback(
    (conversationId: string, userId: string) =>
      messages.filter(
        (m) =>
          m.conversationId === conversationId &&
          !m.readBy.includes(userId) &&
          m.senderId !== userId,
      ).length,
    [messages],
  );

  const starredMessages = messages.filter(
    (m) => currentUser && m.starredBy?.includes(currentUser.id),
  );

  const sendMessage = useCallback(
    async (
      conversationId: string,
      body: string,
      sharedMemo?: SharedMemo,
      attachments?: Attachment[],
    ) => {
      if (!currentUser) return;
      const normalizedBody = (body || "").trim();
      const attachmentIds = (attachments || [])
        .map((attachment) => attachment.id)
        .filter(Boolean);
      const sharedMemoId = sharedMemo?.memoId;

      if (!normalizedBody && attachmentIds.length === 0 && !sharedMemoId) {
        return;
      }

      const payload: {
        body?: string;
        sharedMemoId?: string;
        attachmentIds?: string[];
      } = {};

      if (normalizedBody) {
        payload.body = normalizedBody.slice(0, MESSAGE_BODY_MAX_LENGTH);
      }

      if (sharedMemoId) {
        payload.sharedMemoId = sharedMemoId;
      }

      if (attachmentIds.length > 0) {
        payload.attachmentIds = attachmentIds;
      }

      const now = new Date().toISOString();
      const tempId = `msg${Date.now()}`;
      const newMsg: Message = {
        id: tempId,
        conversationId,
        senderId: currentUser.id,
        body: payload.body || "",
        attachments: attachments || [],
        reactions: [],
        sharedMemo,
        readBy: [currentUser.id],
        clientOnly: true,
        createdAt: now,
      };
      // Optimistic update
      setMessages((prev) => [...prev, newMsg]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, lastMessage: newMsg, updatedAt: now }
            : c,
        ),
      );
      // Persist to backend
      try {
        const res = await apiRequest<{ message: any }>(
          `/messages/conversations/${conversationId}`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );
        if (res.data.message) {
          const saved = mapMsg(res.data.message);
          setMessages((prev) => {
            const alreadySaved = prev.some(
              (message) => message.id === saved.id,
            );
            if (alreadySaved) {
              return prev.filter((message) => message.id !== tempId);
            }

            return prev.map((message) =>
              message.id === tempId ? { ...saved, clientOnly: false } : message,
            );
          });
        }
      } catch (e) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        showFriendlyErrorToast(
          getSafeErrorMessage(
            e,
            "Your message could not be sent. Please try again.",
          ),
        );
      }
    },
    [currentUser, mapMsg],
  );

  const sendSystemMessage = useCallback(
    (conversationId: string, body: string) => {
      const now = new Date().toISOString();
      const sysMsg: Message = {
        id: `msg${Date.now()}`,
        conversationId,
        senderId: "system",
        body,
        attachments: [],
        reactions: [],
        readBy: [],
        isSystem: true,
        clientOnly: true,
        createdAt: now,
      };
      setMessages((prev) => [...prev, sysMsg]);
    },
    [],
  );

  const addReaction = useCallback(
    (messageId: string, emoji: string, userId: string) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;
          const existing = msg.reactions.find((r) => r.emoji === emoji);
          let isRemoving = false;
          let updated: Message;
          if (existing) {
            if (existing.users.includes(userId)) {
              isRemoving = true;
              const newReactions = msg.reactions
                .map((r) =>
                  r.emoji === emoji
                    ? { ...r, users: r.users.filter((u) => u !== userId) }
                    : r,
                )
                .filter((r) => r.users.length > 0);
              updated = { ...msg, reactions: newReactions };
            } else {
              updated = {
                ...msg,
                reactions: msg.reactions.map((r) =>
                  r.emoji === emoji ? { ...r, users: [...r.users, userId] } : r,
                ),
              };
            }
          } else {
            updated = {
              ...msg,
              reactions: [...msg.reactions, { emoji, users: [userId] }],
            };
          }
          // Fire-and-forget backend sync
          if (isRemoving) {
            apiRequest(
              `/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
              { method: "DELETE" },
            ).catch(console.error);
          } else {
            apiRequest(`/messages/${messageId}/reactions`, {
              method: "POST",
              body: JSON.stringify({ emoji }),
            }).catch(console.error);
          }
          return updated;
        }),
      );
    },
    [],
  );

  const markAsRead = useCallback(
    (conversationId: string, userId: string) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (
            msg.conversationId !== conversationId ||
            msg.readBy.includes(userId)
          )
            return msg;

          // Persist read state
          apiRequest(`/messages/${msg.id}/read`, { method: "POST" }).catch(
            console.error,
          );

          // Broadcast read receipt in real-time
          if (socket) {
            socket.emit("mark_message_read", {
              messageId: msg.id,
              conversationId,
            });
          }

          return { ...msg, readBy: [...msg.readBy, userId] };
        }),
      );
    },
    [socket],
  );

  const simulateTyping = useCallback(
    (conversationId: string, userId: string) => {
      if (!socket || !currentUser || userId !== currentUser.id) return;
      const key = `${conversationId}_${userId}`;
      if (typingTimers.current[key]) clearTimeout(typingTimers.current[key]);
      socket.emit("typing_start", conversationId);
      typingTimers.current[key] = setTimeout(() => {
        socket.emit("typing_stop", conversationId);
      }, 1200);
    },
    [socket, currentUser?.id],
  );

  const createConversation = useCallback(
    async (
      participantIds: string[],
      name?: string,
      groupId?: string,
    ): Promise<Conversation> => {
      if (!currentUser) throw new Error("Not authenticated");
      const isDirect = participantIds.length === 2 && !groupId;
      if (isDirect) {
        const otherId = participantIds.find((id) => id !== currentUser.id);
        if (otherId) {
          try {
            const res = await apiRequest<{ conversation: any }>(
              `/conversations/direct/${otherId}`,
            );
            const live = mapConv(res.data.conversation);
            setConversations((prev) =>
              prev.some((c) => c.id === live.id) ? prev : [...prev, live],
            );
            return live;
          } catch (e) {
            console.error("Failed to get/create direct conversation:", e);
            throw e;
          }
        }
      } else {
        try {
          const res = await apiRequest<{ conversation: any }>(
            "/conversations",
            {
              method: "POST",
              body: JSON.stringify({
                type: "group",
                name,
                participantIds,
                groupId,
              }),
            },
          );
          const live = mapConv(res.data.conversation);
          setConversations((prev) =>
            prev.some((c) => c.id === live.id) ? prev : [...prev, live],
          );
          return live;
        } catch (e) {
          console.error("Failed to create group conversation:", e);
          throw e;
        }
      }
      throw new Error("Unable to create conversation");
    },
    [currentUser, mapConv],
  );

  const editMessage = useCallback(
    async (messageId: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) {
        throw new Error("Message body cannot be empty");
      }

      const target = messages.find((message) => message.id === messageId);
      if (!target) return;

      const previousBody = target.body;

      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? {
                ...message,
                body: trimmed,
                isEdited: true,
                editedAt: new Date().toISOString(),
              }
            : message,
        ),
      );

      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== target.conversationId) return conversation;
          if (conversation.lastMessage?.id !== messageId) return conversation;
          return {
            ...conversation,
            lastMessage: {
              ...conversation.lastMessage,
              body: trimmed,
              isEdited: true,
              editedAt: new Date().toISOString(),
            },
          };
        }),
      );

      try {
        await apiRequest(`/messages/${messageId}`, {
          method: "PUT",
          body: JSON.stringify({ body: trimmed }),
        });
      } catch (error) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  body: previousBody,
                  isEdited: false,
                  editedAt: undefined,
                }
              : message,
          ),
        );

        setConversations((prev) =>
          prev.map((conversation) => {
            if (conversation.id !== target.conversationId) return conversation;
            if (conversation.lastMessage?.id !== messageId) return conversation;
            return {
              ...conversation,
              lastMessage: {
                ...conversation.lastMessage,
                body: previousBody,
                isEdited: false,
                editedAt: undefined,
              },
            };
          }),
        );

        throw error;
      }
    },
    [messages],
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      const target = messages.find((message) => message.id === messageId);
      if (!target) return;

      const conversationId = target.conversationId;
      const deletedAt = new Date().toISOString();
      const deletedMessage: Message = {
        ...target,
        body: DELETED_MESSAGE_TEXT,
        attachments: [],
        reactions: [],
        sharedMemo: undefined,
        isDeleted: true,
        deletedAt,
      };

      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId ? deletedMessage : message,
        ),
      );
      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== conversationId) return conversation;
          if (conversation.lastMessage?.id !== messageId) return conversation;
          return {
            ...conversation,
            lastMessage: deletedMessage,
          };
        }),
      );

      try {
        await apiRequest(`/messages/${messageId}`, {
          method: "DELETE",
        });
      } catch (error) {
        // Re-sync from backend for correctness if deletion fails.
        await Promise.allSettled([loadConversations(), loadStarredMessages()]);
        throw error;
      }
    },
    [messages, loadConversations, loadStarredMessages],
  );

  const starMessage = useCallback(
    (messageId: string, userId: string) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;
          const starred = msg.starredBy || [];
          if (starred.includes(userId)) {
            apiRequest(`/messages/${messageId}/star`, {
              method: "DELETE",
            }).catch(console.error);
            return { ...msg, starredBy: starred.filter((id) => id !== userId) };
          }
          apiRequest(`/messages/${messageId}/star`, { method: "POST" }).catch(
            console.error,
          );
          return { ...msg, starredBy: [...starred, userId] };
        }),
      );
    },
    [messages],
  );

  return (
    <MessageContext.Provider
      value={{
        conversations,
        messages,
        sendMessage,
        sendSystemMessage,
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
        loadStarredMessages,
        getUnreadCount,
      }}
    >
      {children}
    </MessageContext.Provider>
  );
}

export function useMessages() {
  const context = useContext(MessageContext);
  if (!context)
    throw new Error("useMessages must be used within MessageProvider");
  return context;
}
