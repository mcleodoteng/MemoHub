import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  Memo,
  Comment,
  MemoVisibility,
  MemoEditEntry,
  Attachment,
  ApprovalStep,
  WorkflowConfig,
} from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { AlertCircle, X } from "lucide-react";

interface MemoContextType {
  memos: Memo[];
  comments: Comment[];
  addMemo: (
    memo: Omit<
      Memo,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "recipientStatuses"
      | "reactions"
      | "editHistory"
      | "hiddenBy"
      | "activityLog"
    >,
  ) => Promise<Memo>;
  updateMemo: (id: string, updates: Partial<Memo>) => void;
  editMemo: (
    id: string,
    updates: {
      title?: string;
      body?: string;
      tags?: string[];
      visibility?: MemoVisibility;
      attachments?: Attachment[];
      recipientIds?: string[];
      referencedMemoIds?: string[];
    },
    editorId: string,
  ) => void;
  deleteMemo: (id: string) => void;
  permanentlyDeleteMemo: (id: string) => void;
  restoreMemo: (id: string) => void;
  togglePin: (id: string) => Promise<void>;
  toggleArchive: (id: string) => Promise<void>;
  toggleStar: (memoId: string, userId: string) => void;
  hideMemo: (memoId: string, userId: string) => void;
  acknowledgeMemo: (memoId: string, userId: string) => void;
  unacknowledgeMemo: (memoId: string, userId: string) => void;
  approveMemo: (memoId: string, userId: string) => void;
  unapproveMemo: (memoId: string, userId: string) => void;
  markOpened: (memoId: string, userId: string) => void;
  addComment: (
    memoId: string,
    body: string,
    authorId: string,
    attachments?: Attachment[],
    parentId?: string,
  ) => void;
  editComment: (commentId: string, newBody: string, userId: string) => void;
  deleteComment: (commentId: string, userId: string) => void;
  toggleCommentPin: (commentId: string, userId: string) => void;
  addCommentReaction: (
    commentId: string,
    emoji: string,
    userId: string,
  ) => void;
  addReaction: (memoId: string, emoji: string, userId: string) => void;
  approveWorkflowStep: (
    memoId: string,
    stepId: string,
    userId: string,
    approved: boolean,
    comment?: string,
  ) => void;
  checkEscalations: () => void;
  checkScheduledMemos: () => void;
  getMemoById: (id: string) => Memo | undefined;
  getCommentsByMemoId: (memoId: string) => Comment[];
}

const MemoContext = createContext<MemoContextType | undefined>(undefined);

export function MemoProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, isAuthenticated } = useAuth();
  const { socket, joinRoom, leaveRoom, onEvent, offEvent } = useSocket();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);

  const showFriendlyErrorToast = useCallback((message: string) => {
    toast.custom((toastId) => (
      <div className="w-[400px] rounded-xl border border-red-200 bg-red-50 p-4 text-red-950 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-700 flex-shrink-0">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-red-900">
              Action not completed
            </p>
            <p className="mt-1 text-xs leading-relaxed text-red-800">
              {message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => toast.dismiss(toastId)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-red-600 hover:bg-red-100 hover:text-red-900"
            aria-label="Close error notification"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    ));
  }, []);

  const getSafeReactionErrorMessage = useCallback(
    (error: unknown, fallback: string) => {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("already reacted") && message.includes("comment")) {
        return "You have already reacted to this comment. Remove your previous reaction before adding a new one.";
      }
      if (message.includes("already reacted")) {
        return "You have already reacted to this memo. Remove your previous reaction before adding a new one.";
      }
      if (message.includes("not found")) {
        return "This item could not be found. Please refresh and try again.";
      }
      if (message.includes("unauthorized") || message.includes("forbidden")) {
        return "You do not have permission to do this action.";
      }
      return fallback;
    },
    [],
  );

  const sortedMemos = useMemo(
    () =>
      [...memos].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [memos],
  );

  const mergeActivityLogs = useCallback(
    (...logs: Array<import("@/types").MemoActivityEntry[]>) => {
      const all = logs.flat().filter(Boolean);
      const unique = new Map<string, import("@/types").MemoActivityEntry>();

      for (const entry of all) {
        const key = `${entry.userId}:${entry.action}:${entry.timestamp}:${entry.detail || ""}`;
        if (!unique.has(key)) {
          unique.set(key, entry);
        }
      }

      return Array.from(unique.values()).sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    },
    [],
  );

  const buildBackendActivityLog = useCallback(
    (memo: any): import("@/types").MemoActivityEntry[] => {
      const recipientEntries = (memo.recipients || []).flatMap(
        (recipient: any) => {
          const entries: import("@/types").MemoActivityEntry[] = [];
          if (recipient.openedAt) {
            entries.push({
              id: `backend-opened-${memo.id}-${recipient.id}-${recipient.openedAt}`,
              userId: recipient.id,
              action: "opened",
              timestamp: new Date(recipient.openedAt).toISOString(),
            });
          }
          if (recipient.acknowledgedAt) {
            entries.push({
              id: `backend-ack-${memo.id}-${recipient.id}-${recipient.acknowledgedAt}`,
              userId: recipient.id,
              action: "acknowledged",
              timestamp: new Date(recipient.acknowledgedAt).toISOString(),
            });
          }
          if (recipient.approvedAt) {
            entries.push({
              id: `backend-approve-${memo.id}-${recipient.id}-${recipient.approvedAt}`,
              userId: recipient.id,
              action: "approved",
              timestamp: new Date(recipient.approvedAt).toISOString(),
            });
          }
          return entries;
        },
      );

      const reactionEntries = (memo.reactions || [])
        .filter((reaction: any) => reaction?.userId)
        .map((reaction: any) => ({
          id: `backend-reaction-${memo.id}-${reaction.userId}-${reaction.emoji}-${reaction.createdAt || memo.updatedAt}`,
          userId: reaction.userId,
          action: "reacted" as const,
          timestamp: new Date(
            reaction.createdAt || memo.updatedAt,
          ).toISOString(),
          detail: reaction.emoji,
        }));

      return mergeActivityLogs(recipientEntries, reactionEntries);
    },
    [mergeActivityLogs],
  );

  const aggregateReactions = useCallback((reactions: any[] = []) => {
    const reactionMap = new Map<string, string[]>();

    for (const reaction of reactions) {
      if (!reaction?.emoji || !reaction?.userId) continue;
      const users = reactionMap.get(reaction.emoji) || [];
      if (!users.includes(reaction.userId)) {
        users.push(reaction.userId);
      }
      reactionMap.set(reaction.emoji, users);
    }

    return Array.from(reactionMap.entries()).map(([emoji, users]) => ({
      emoji,
      users,
    }));
  }, []);

  const mapAttachment = useCallback((attachment: any): Attachment => {
    const resolveAttachmentUrl = (value?: string) => {
      if (!value) return "";
      if (value.startsWith("blob:") || value.startsWith("data:")) {
        return value;
      }
      if (/^https?:\/\//i.test(value)) {
        try {
          const parsed = new URL(value);
          if (parsed.pathname.startsWith("/uploads/")) {
            return `${parsed.pathname}${parsed.search}${parsed.hash}`;
          }
        } catch {
          return value;
        }
        return value;
      }
      if (value.startsWith("/")) {
        return value;
      }
      if (value.startsWith("uploads/")) {
        return `/${value}`;
      }
      return `/uploads/${value}`;
    };

    const type =
      attachment.type || attachment.mimetype || "application/octet-stream";
    const resolvedUrl = resolveAttachmentUrl(
      attachment.url || attachment.filename || attachment.id,
    );
    const resolvedThumbnailUrl = resolveAttachmentUrl(attachment.thumbnailUrl);

    return {
      id: attachment.id,
      name: attachment.name || attachment.filename || "file",
      type,
      size: attachment.size || 0,
      url: resolvedUrl,
      thumbnailUrl:
        resolvedThumbnailUrl ||
        (type.startsWith("image/") ? resolvedUrl : undefined),
    };
  }, []);

  const mapBackendMemo = useCallback(
    (memo: any): Memo => {
      const recipientIds = (memo.recipients || []).map(
        (recipient: any) => recipient.id,
      );

      return {
        id: memo.id,
        slug: memo.slug ?? undefined,
        title: memo.title,
        body: memo.body,
        creatorId: memo.creator?.id || currentUser?.id || "unknown",
        visibility:
          memo.visibility === "department"
            ? "protected"
            : (memo.visibility as MemoVisibility),
        status: memo.archived
          ? "archived"
          : memo.status === "deleted"
            ? "deleted"
            : memo.status === "sent"
              ? "sent"
              : memo.status === "draft"
                ? "draft"
                : "sent",
        recipientIds,
        recipientStatuses: (memo.recipients || []).map((recipient: any) => ({
          userId: recipient.id,
          opened: !!recipient.opened,
          openedAt: recipient.openedAt
            ? new Date(recipient.openedAt).toISOString()
            : undefined,
          acknowledged: !!recipient.acknowledged,
          acknowledgedAt: recipient.acknowledgedAt
            ? new Date(recipient.acknowledgedAt).toISOString()
            : undefined,
          approved: !!recipient.approved,
          approvedAt: recipient.approvedAt
            ? new Date(recipient.approvedAt).toISOString()
            : undefined,
          replied: !!recipient.replied,
          repliedAt: recipient.repliedAt
            ? new Date(recipient.repliedAt).toISOString()
            : undefined,
        })),
        groupId: memo.groupId,
        tags: (memo.tags || []).map((tag: any) => tag.name).filter(Boolean),
        attachments: (memo.attachments || []).map(mapAttachment),
        reactions: aggregateReactions(memo.reactions || []),
        pinned: !!memo.pinned,
        archived: !!memo.archived,
        referencedMemoIds: memo.referencedMemoIds || [],
        editHistory: [],
        activityLog: buildBackendActivityLog(memo),
        hiddenBy: memo.hiddenBy || [],
        starredBy: memo.starredBy || [],
        workflow:
          memo.workflow && typeof memo.workflow === "object"
            ? (memo.workflow as WorkflowConfig)
            : undefined,
        previousStatus: memo.previousStatus ?? undefined,
        createdAt: new Date(memo.createdAt).toISOString(),
        updatedAt: new Date(memo.updatedAt).toISOString(),
      };
    },
    [
      aggregateReactions,
      buildBackendActivityLog,
      currentUser?.id,
      mapAttachment,
    ],
  );

  const mapBackendComment = useCallback(
    (comment: any): Comment => ({
      id: comment.id,
      memoId: comment.memoId,
      authorId: comment.author?.id || comment.authorId,
      body: comment.body,
      parentId: comment.parentId,
      pinned: !!comment.pinned,
      pinnedBy: comment.pinnedBy,
      attachments: (comment.attachments || []).map(mapAttachment),
      reactions: aggregateReactions(
        comment.commentReactions || comment.reactions || [],
      ),
      referencedMemoIds: comment.referencedMemoIds || [],
      createdAt: new Date(comment.createdAt).toISOString(),
      updatedAt: new Date(comment.updatedAt).toISOString(),
    }),
    [aggregateReactions, mapAttachment],
  );

  const loadLiveMemos = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const memoResponse = await apiRequest<{ memos: any[] }>("/memos");
      const mappedMemos = (memoResponse.data.memos || []).map(mapBackendMemo);
      setMemos((prev) =>
        mappedMemos.map((memo) => {
          const existing = prev.find((item) => item.id === memo.id);
          return {
            ...memo,
            activityLog: mergeActivityLogs(
              existing?.activityLog || [],
              memo.activityLog || [],
            ),
          };
        }),
      );

      const commentResults = await Promise.all(
        mappedMemos.map(async (memo) => {
          try {
            const response = await apiRequest<{ comments: any[] }>(
              `/memos/${memo.id}/comments`,
            );
            return response.data.comments || [];
          } catch {
            return [];
          }
        }),
      );

      const rawComments = commentResults.flat();
      const mappedComments = rawComments.map(mapBackendComment);
      setComments(mappedComments);

      const rawCommentById = new Map<string, any>(
        rawComments.map((comment) => [comment.id, comment]),
      );

      const commentActivityByMemo = new Map<
        string,
        import("@/types").MemoActivityEntry[]
      >();
      const commentReactionActivityByMemo = new Map<
        string,
        import("@/types").MemoActivityEntry[]
      >();

      for (const comment of rawComments) {
        const reactionEntries = (
          comment.commentReactions ||
          comment.reactions ||
          []
        )
          .filter((reaction: any) => reaction?.userId && reaction?.emoji)
          .map((reaction: any) => ({
            id: `backend-comment-reaction-${comment.id}-${reaction.userId}-${reaction.emoji}-${reaction.createdAt || comment.updatedAt || comment.createdAt}`,
            userId: reaction.userId,
            action: "reacted" as const,
            timestamp: new Date(
              reaction.createdAt || comment.updatedAt || comment.createdAt,
            ).toISOString(),
            detail: `with ${reaction.emoji} on a comment`,
          }));

        if (reactionEntries.length > 0) {
          const existing =
            commentReactionActivityByMemo.get(comment.memoId) || [];
          commentReactionActivityByMemo.set(comment.memoId, [
            ...existing,
            ...reactionEntries,
          ]);
        }
      }

      for (const comment of mappedComments) {
        const rawComment = rawCommentById.get(comment.id);
        const parentComment = comment.parentId
          ? rawCommentById.get(comment.parentId)
          : undefined;
        const parentAuthorName = parentComment?.author?.name;

        const entries = commentActivityByMemo.get(comment.memoId) || [];
        entries.push({
          id: `backend-comment-${comment.id}`,
          userId: comment.authorId,
          action: comment.parentId ? "replied" : "commented",
          timestamp: comment.createdAt,
          detail: comment.parentId
            ? `to ${parentAuthorName || "a comment"}`
            : undefined,
        });

        if (
          new Date(comment.updatedAt).getTime() >
          new Date(comment.createdAt).getTime()
        ) {
          entries.push({
            id: `backend-comment-edited-${comment.id}`,
            userId: comment.authorId,
            action: "edited_comment",
            timestamp: comment.updatedAt,
            detail: comment.parentId
              ? `updated a reply${parentAuthorName ? ` to ${parentAuthorName}` : ""}`
              : "updated a comment",
          });
        }

        commentActivityByMemo.set(comment.memoId, entries);
      }

      setMemos((prev) =>
        prev.map((memo) => ({
          ...memo,
          activityLog: mergeActivityLogs(
            memo.activityLog || [],
            commentActivityByMemo.get(memo.id) || [],
            commentReactionActivityByMemo.get(memo.id) || [],
          ),
        })),
      );
    } catch (error) {
      console.error("Failed to load live memos:", error);
    }
  }, [isAuthenticated, mapBackendComment, mapBackendMemo, mergeActivityLogs]);

  useEffect(() => {
    void loadLiveMemos();
  }, [loadLiveMemos]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = window.setInterval(() => {
      void loadLiveMemos();
    }, 15000);

    const handleFocus = () => {
      void loadLiveMemos();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void loadLiveMemos();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, loadLiveMemos]);

  useEffect(() => {
    if (!socket || !currentUser) return;

    const joinedMemoRooms = memos.map((memo) => `memo_${memo.id}`);
    joinedMemoRooms.forEach((roomId) => joinRoom(roomId));

    const refreshLiveData = () => {
      void loadLiveMemos();
    };

    onEvent("comment_created", refreshLiveData);
    onEvent("memo_reaction_added", refreshLiveData);
    onEvent("memo_reaction_removed", refreshLiveData);
    onEvent("memo_status_updated", refreshLiveData);
    onEvent("memo_opened_by_user", refreshLiveData);
    onEvent("memo_acknowledged_by_user", refreshLiveData);
    onEvent("memo_pin_toggled", refreshLiveData);
    onEvent("memo_workflow_approved", refreshLiveData);
    onEvent("memo_created", refreshLiveData);
    onEvent("memo_updated", refreshLiveData);
    onEvent("memo_deleted", refreshLiveData);

    const handleReconnect = () => {
      void loadLiveMemos();
    };
    socket.on("connect", handleReconnect);

    return () => {
      joinedMemoRooms.forEach((roomId) => leaveRoom(roomId));
      offEvent("comment_created", refreshLiveData);
      offEvent("memo_reaction_added", refreshLiveData);
      offEvent("memo_reaction_removed", refreshLiveData);
      offEvent("memo_status_updated", refreshLiveData);
      offEvent("memo_opened_by_user", refreshLiveData);
      offEvent("memo_acknowledged_by_user", refreshLiveData);
      offEvent("memo_pin_toggled", refreshLiveData);
      offEvent("memo_workflow_approved", refreshLiveData);
      offEvent("memo_created", refreshLiveData);
      offEvent("memo_updated", refreshLiveData);
      offEvent("memo_deleted", refreshLiveData);
      socket.off("connect", handleReconnect);
    };
  }, [
    socket,
    currentUser?.id,
    memos,
    joinRoom,
    leaveRoom,
    onEvent,
    offEvent,
    loadLiveMemos,
  ]);

  const getMemoById = useCallback(
    (id: string) => memos.find((m) => m.id === id || m.slug === id),
    [memos],
  );
  const getCommentsByMemoId = useCallback(
    (memoId: string) => comments.filter((c) => c.memoId === memoId),
    [comments],
  );

  const addMemo = useCallback(
    (
      memoData: Omit<
        Memo,
        | "id"
        | "createdAt"
        | "updatedAt"
        | "recipientStatuses"
        | "reactions"
        | "editHistory"
        | "hiddenBy"
        | "activityLog"
      >,
    ) => {
      const now = new Date().toISOString();
      const newMemo: Memo = {
        ...memoData,
        id: `m${Date.now()}`,
        reactions: [],
        editHistory: [],
        activityLog: [],
        hiddenBy: [],
        recipientStatuses: memoData.recipientIds.map((userId) => ({
          userId,
          opened: false,
          acknowledged: false,
          approved: false,
          replied: false,
        })),
        createdAt: now,
        updatedAt: now,
      };
      setMemos((prev) => [newMemo, ...prev]);

      const uniqueValues = (values: string[] = []) =>
        Array.from(
          new Set(
            values
              .map((value) => value?.trim())
              .filter((value): value is string => Boolean(value)),
          ),
        );

      const recipientIds = uniqueValues(memoData.recipientIds || []);
      const tagIds = uniqueValues(memoData.tags || []);
      const referencedMemoIds = uniqueValues(memoData.referencedMemoIds || []);

      const createPayload = {
        title: memoData.title,
        body: memoData.body ?? "",
        groupId: memoData.groupId,
        visibility: memoData.visibility,
        recipientIds,
        tagIds,
        referencedMemoIds,
        workflow: memoData.workflow,
        status: memoData.status,
      };

      return apiRequest<{ memo: any }>("/memos", {
        method: "POST",
        body: JSON.stringify(createPayload),
      })
        .then((response) => {
          const savedMemo = mapBackendMemo(response.data.memo);
          setMemos((prev) =>
            prev.map((memo) => (memo.id === newMemo.id ? savedMemo : memo)),
          );
          return savedMemo;
        })
        .catch((error) => {
          if (
            memoData.status === "draft" &&
            error instanceof Error &&
            error.message === "Failed to create memo"
          ) {
            return apiRequest<{ memo: any }>("/memos", {
              method: "POST",
              body: JSON.stringify({ ...createPayload, body: " " }),
            })
              .then((response) => {
                const savedMemo = mapBackendMemo(response.data.memo);
                setMemos((prev) =>
                  prev.map((memo) =>
                    memo.id === newMemo.id ? savedMemo : memo,
                  ),
                );
                return savedMemo;
              })
              .catch((retryError) => {
                setMemos((prev) =>
                  prev.filter((memo) => memo.id !== newMemo.id),
                );
                throw retryError;
              });
          }

          setMemos((prev) => prev.filter((memo) => memo.id !== newMemo.id));
          throw error;
        });
    },
    [mapBackendMemo],
  );

  const updateMemo = useCallback(
    (id: string, updates: Partial<Memo>) => {
      setMemos((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, ...updates, updatedAt: new Date().toISOString() }
            : m,
        ),
      );
      const backendUpdates: Record<string, any> = {};
      if (updates.status !== undefined) backendUpdates.status = updates.status;
      if (updates.title !== undefined) backendUpdates.title = updates.title;
      if (updates.body !== undefined) backendUpdates.body = updates.body;
      if (updates.visibility !== undefined)
        backendUpdates.visibility = updates.visibility;
      if (updates.pinned !== undefined) backendUpdates.pinned = updates.pinned;
      if (updates.archived !== undefined)
        backendUpdates.archived = updates.archived;
      if (updates.tags !== undefined) backendUpdates.tagIds = updates.tags;
      if (updates.recipientIds !== undefined)
        backendUpdates.recipientIds = updates.recipientIds;
      if (updates.referencedMemoIds !== undefined)
        backendUpdates.referencedMemoIds = updates.referencedMemoIds;
      if (updates.workflow !== undefined)
        backendUpdates.workflow = updates.workflow;
      if (Object.keys(backendUpdates).length > 0) {
        void apiRequest(`/memos/${id}`, {
          method: "PUT",
          body: JSON.stringify(backendUpdates),
        })
          .then(() => loadLiveMemos())
          .catch((err) => console.error("Failed to update memo:", err));
      }
    },
    [loadLiveMemos],
  );

  const editMemo = useCallback(
    (
      id: string,
      updates: {
        title?: string;
        body?: string;
        tags?: string[];
        visibility?: MemoVisibility;
        attachments?: Attachment[];
        recipientIds?: string[];
        referencedMemoIds?: string[];
      },
      editorId: string,
    ) => {
      setMemos((prev) =>
        prev.map((m) => {
          if (m.id !== id || m.creatorId !== editorId) return m;
          const now = new Date().toISOString();
          const changes: MemoEditEntry["changes"] = [];
          if (updates.title !== undefined && updates.title !== m.title) {
            changes.push({
              field: "title",
              oldValue: m.title,
              newValue: updates.title,
            });
          }
          if (updates.body !== undefined && updates.body !== m.body) {
            changes.push({
              field: "body",
              oldValue: m.body,
              newValue: updates.body,
            });
          }
          if (
            updates.tags !== undefined &&
            JSON.stringify(updates.tags) !== JSON.stringify(m.tags)
          ) {
            changes.push({
              field: "tags",
              oldValue: m.tags.join(", "),
              newValue: updates.tags.join(", "),
            });
          }
          if (
            updates.visibility !== undefined &&
            updates.visibility !== m.visibility
          ) {
            changes.push({
              field: "visibility",
              oldValue: m.visibility,
              newValue: updates.visibility,
            });
          }
          if (updates.attachments !== undefined) {
            changes.push({
              field: "attachments",
              oldValue: `${m.attachments.length} files`,
              newValue: `${updates.attachments.length} files`,
            });
          }
          if (
            updates.recipientIds !== undefined &&
            JSON.stringify(updates.recipientIds) !==
              JSON.stringify(m.recipientIds)
          ) {
            changes.push({
              field: "recipients",
              oldValue: `${m.recipientIds.length} recipients`,
              newValue: `${updates.recipientIds.length} recipients`,
            });
          }
          if (changes.length === 0) return m;
          const entry: MemoEditEntry = {
            id: `eh${Date.now()}`,
            editedAt: now,
            editedBy: editorId,
            changes,
          };
          return {
            ...m,
            ...(updates.title !== undefined && { title: updates.title }),
            ...(updates.body !== undefined && { body: updates.body }),
            ...(updates.tags !== undefined && { tags: updates.tags }),
            ...(updates.visibility !== undefined && {
              visibility: updates.visibility,
            }),
            ...(updates.attachments !== undefined && {
              attachments: updates.attachments,
            }),
            ...(updates.recipientIds !== undefined && {
              recipientIds: updates.recipientIds,
              recipientStatuses: updates.recipientIds.map((uid) => {
                const existing = m.recipientStatuses.find(
                  (s) => s.userId === uid,
                );
                return (
                  existing || {
                    userId: uid,
                    opened: false,
                    acknowledged: false,
                    approved: false,
                    replied: false,
                  }
                );
              }),
            }),
            ...(updates.referencedMemoIds !== undefined && {
              referencedMemoIds: updates.referencedMemoIds,
            }),
            editHistory: [...m.editHistory, entry],
            updatedAt: now,
          };
        }),
      );
      const saveEdits = async () => {
        let attachmentIds = (updates.attachments || [])
          .map((attachment) => attachment.id)
          .filter(
            (attachmentId): attachmentId is string =>
              Boolean(attachmentId) && !attachmentId.startsWith("att-"),
          );

        const localFiles = (updates.attachments || []).filter(
          (attachment) =>
            (attachment.id?.startsWith("att-") ?? false) &&
            attachment.url?.startsWith("blob:"),
        );

        if (localFiles.length > 0) {
          const formData = new FormData();

          for (const fileAttachment of localFiles) {
            const response = await fetch(fileAttachment.url);
            const blob = await response.blob();
            const file = new File(
              [blob],
              fileAttachment.name || `attachment-${Date.now()}`,
              {
                type:
                  fileAttachment.type ||
                  blob.type ||
                  "application/octet-stream",
              },
            );
            formData.append("files", file);
          }

          const uploadResponse = await apiRequest<{ attachments: any[] }>(
            "/upload/files",
            {
              method: "POST",
              body: formData,
            },
          );

          const uploadedIds = (uploadResponse.data.attachments || [])
            .map((attachment: any) => attachment?.id)
            .filter((attachmentId: any): attachmentId is string =>
              Boolean(attachmentId),
            );

          attachmentIds = Array.from(
            new Set([...attachmentIds, ...uploadedIds]),
          );
        }

        await apiRequest(`/memos/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            ...(updates.title !== undefined && { title: updates.title }),
            ...(updates.body !== undefined && { body: updates.body }),
            ...(updates.tags !== undefined && { tagIds: updates.tags }),
            ...(updates.visibility !== undefined && {
              visibility: updates.visibility,
            }),
            ...(updates.attachments !== undefined && {
              attachmentIds,
            }),
            ...(updates.recipientIds !== undefined && {
              recipientIds: updates.recipientIds,
            }),
            ...(updates.referencedMemoIds !== undefined && {
              referencedMemoIds: updates.referencedMemoIds,
            }),
          }),
        });
      };

      void saveEdits()
        .then(() => loadLiveMemos())
        .catch((err) => {
          console.error("Failed to save memo edits:", err);
          loadLiveMemos();
        });
    },
    [loadLiveMemos],
  );

  const deleteMemo = useCallback(
    (id: string) => {
      if (!currentUser) return;
      const memoToDelete = memos.find((m) => m.id === id);
      toast.success(
        memoToDelete?.status === "draft"
          ? "Draft deleted"
          : "Memo moved to trash",
      );
      setMemos((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          if (m.creatorId !== currentUser.id) return m;
          return {
            ...m,
            status: "deleted" as const,
            deletedBy: currentUser.id,
            deletedAt: new Date().toISOString(),
          };
        }),
      );
      void apiRequest(`/memos/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "deleted" }),
      })
        .then(() => loadLiveMemos())
        .catch((err) => console.error("Failed to soft-delete memo:", err));
    },
    [currentUser, memos, loadLiveMemos],
  );

  const permanentlyDeleteMemo = useCallback(
    (id: string) => {
      if (!currentUser) return;
      setMemos((prev) => prev.filter((m) => m.id !== id));
      toast.success("Memo permanently deleted");
      void apiRequest(`/memos/${id}`, { method: "DELETE" })
        .then(() => loadLiveMemos())
        .catch((err) =>
          console.error("Failed to permanently delete memo:", err),
        );
    },
    [currentUser, loadLiveMemos],
  );

  const restoreMemo = useCallback(
    (id: string) => {
      if (!currentUser) return;
      const memo = memos.find((m) => m.id === id);
      if (!memo) return;
      const targetStatus = (memo.previousStatus as any) ?? "sent";
      setMemos((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          const { deletedBy, deletedAt, previousStatus, ...rest } = m as any;
          return { ...rest, status: targetStatus };
        }),
      );
      toast.success("Memo restored!");
      void apiRequest(`/memos/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: targetStatus }),
      })
        .then(() => loadLiveMemos())
        .catch((err) => console.error("Failed to restore memo:", err));
    },
    [currentUser, memos, loadLiveMemos],
  );

  const togglePin = useCallback(
    async (id: string) => {
      const memo = memos.find((m) => m.id === id);
      if (!memo) return;

      const nextPinned = !memo.pinned;
      setMemos((prev) =>
        prev.map((m) => (m.id === id ? { ...m, pinned: nextPinned } : m)),
      );

      try {
        await apiRequest(
          `/memos/${id}/actions/${memo.pinned ? "unpin" : "pin"}`,
          {
            method: "POST",
          },
        );
        await loadLiveMemos();
        toast.success(memo.pinned ? "Unpinned" : "Pinned!");
      } catch (error) {
        setMemos((prev) =>
          prev.map((m) => (m.id === id ? { ...m, pinned: memo.pinned } : m)),
        );
        toast.error("Failed to update pin status");
        throw error;
      }
    },
    [loadLiveMemos, memos],
  );

  const toggleArchive = useCallback(
    async (id: string) => {
      const memo = memos.find((m) => m.id === id);
      if (!memo) return;

      const nextArchived = !memo.archived;
      setMemos((prev) =>
        prev.map((m) => (m.id === id ? { ...m, archived: nextArchived } : m)),
      );

      try {
        await apiRequest(
          `/memos/${id}/actions/${memo.archived ? "unarchive" : "archive"}`,
          { method: "POST" },
        );
        await loadLiveMemos();
        toast.success(memo.archived ? "Unarchived" : "Archived!");
      } catch (error) {
        setMemos((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, archived: memo.archived } : m,
          ),
        );
        toast.error("Failed to update archive status");
        throw error;
      }
    },
    [loadLiveMemos, memos],
  );

  const toggleStar = useCallback(
    (memoId: string, userId: string) => {
      setMemos((prev) =>
        prev.map((m) => {
          if (m.id !== memoId) return m;
          const starred = m.starredBy || [];
          if (starred.includes(userId)) {
            return { ...m, starredBy: starred.filter((id) => id !== userId) };
          }
          return { ...m, starredBy: [...starred, userId] };
        }),
      );
      const memo = memos.find((m) => m.id === memoId);
      const action = memo?.starredBy?.includes(userId) ? "unstar" : "star";
      toast.success(action === "unstar" ? "Unstarred" : "Starred!");
      void apiRequest(`/memos/${memoId}/actions/${action}`, { method: "POST" })
        .then(() => loadLiveMemos())
        .catch((error) =>
          console.error("Failed to toggle star on backend:", error),
        );
    },
    [loadLiveMemos, memos],
  );

  const hideMemo = useCallback((memoId: string, userId: string) => {
    setMemos((prev) =>
      prev.map((m) => {
        if (m.id !== memoId) return m;
        const hidden = m.hiddenBy || [];
        if (hidden.includes(userId)) {
          return { ...m, hiddenBy: hidden.filter((id) => id !== userId) };
        }
        return { ...m, hiddenBy: [...hidden, userId] };
      }),
    );
    toast.success("Memo hidden from feed");
  }, []);

  const markOpened = useCallback(
    (memoId: string, userId: string) => {
      void apiRequest(`/memos/${memoId}/actions/read`, { method: "POST" })
        .then(() => loadLiveMemos())
        .catch((error) =>
          console.error("Failed to mark memo as opened on backend:", error),
        );
    },
    [loadLiveMemos],
  );

  const acknowledgeMemo = useCallback(
    (memoId: string, userId: string) => {
      setMemos((prev) =>
        prev.map((m) => {
          if (m.id !== memoId) return m;
          const now = new Date().toISOString();
          return {
            ...m,
            recipientStatuses: m.recipientStatuses.map((s) =>
              s.userId === userId
                ? {
                    ...s,
                    opened: true,
                    openedAt: s.openedAt || now,
                    acknowledged: true,
                    acknowledgedAt: now,
                  }
                : s,
            ),
          };
        }),
      );
      toast.success("Acknowledged!");
      void apiRequest(`/memos/${memoId}/actions/acknowledge`, {
        method: "POST",
      })
        .then(() => loadLiveMemos())
        .catch((error) =>
          console.error("Failed to acknowledge memo on backend:", error),
        );
    },
    [loadLiveMemos],
  );

  const unacknowledgeMemo = useCallback(
    (memoId: string, userId: string) => {
      setMemos((prev) =>
        prev.map((m) => {
          if (m.id !== memoId) return m;
          return {
            ...m,
            recipientStatuses: m.recipientStatuses.map((s) =>
              s.userId === userId
                ? { ...s, acknowledged: false, acknowledgedAt: undefined }
                : s,
            ),
          };
        }),
      );
      toast.success("Unacknowledged");
      void apiRequest(`/memos/${memoId}/actions/unacknowledge`, {
        method: "POST",
      })
        .then(() => {
          const now = new Date().toISOString();
          setMemos((prev) =>
            prev.map((m) => {
              if (m.id !== memoId) return m;
              return {
                ...m,
                activityLog: [
                  {
                    id: `local-unack-${memoId}-${userId}-${now}`,
                    userId,
                    action: "unacknowledged",
                    timestamp: now,
                  },
                  ...m.activityLog,
                ],
              };
            }),
          );
          loadLiveMemos();
        })
        .catch((error) => {
          console.error("Failed to unacknowledge memo on backend:", error);
          loadLiveMemos();
        });
    },
    [loadLiveMemos],
  );

  const approveMemo = useCallback(
    (memoId: string, userId: string) => {
      setMemos((prev) =>
        prev.map((m) => {
          if (m.id !== memoId) return m;
          const now = new Date().toISOString();
          return {
            ...m,
            recipientStatuses: m.recipientStatuses.map((s) =>
              s.userId === userId
                ? {
                    ...s,
                    opened: true,
                    openedAt: s.openedAt || now,
                    acknowledged: true,
                    acknowledgedAt: s.acknowledgedAt || now,
                    approved: true,
                    approvedAt: now,
                  }
                : s,
            ),
          };
        }),
      );
      toast.success("Approved!");
      void apiRequest(`/memos/${memoId}/actions/approve`, { method: "POST" })
        .then(() => loadLiveMemos())
        .catch((error) =>
          console.error("Failed to approve memo on backend:", error),
        );
    },
    [loadLiveMemos],
  );

  const unapproveMemo = useCallback(
    (memoId: string, userId: string) => {
      setMemos((prev) =>
        prev.map((m) => {
          if (m.id !== memoId) return m;
          return {
            ...m,
            recipientStatuses: m.recipientStatuses.map((s) =>
              s.userId === userId
                ? { ...s, approved: false, approvedAt: undefined }
                : s,
            ),
          };
        }),
      );
      toast.success("Unapproved");
      void apiRequest(`/memos/${memoId}/actions/unapprove`, {
        method: "POST",
      })
        .then(() => {
          const now = new Date().toISOString();
          setMemos((prev) =>
            prev.map((m) => {
              if (m.id !== memoId) return m;
              return {
                ...m,
                activityLog: [
                  {
                    id: `local-unapprove-${memoId}-${userId}-${now}`,
                    userId,
                    action: "unapproved",
                    timestamp: now,
                  },
                  ...m.activityLog,
                ],
              };
            }),
          );
          loadLiveMemos();
        })
        .catch((error) => {
          console.error("Failed to unapprove memo on backend:", error);
          loadLiveMemos();
        });
    },
    [loadLiveMemos],
  );

  const addComment = useCallback(
    (
      memoId: string,
      body: string,
      authorId: string,
      attachments: Attachment[] = [],
      parentId?: string,
    ) => {
      const now = new Date().toISOString();
      const newComment: Comment = {
        id: `c${Date.now()}`,
        memoId,
        authorId,
        body,
        parentId,
        attachments,
        reactions: [],
        referencedMemoIds: [],
        createdAt: now,
        updatedAt: now,
      };
      setComments((prev) => [...prev, newComment]);
      setMemos((prev) =>
        prev.map((m) => {
          if (m.id !== memoId) return m;
          return {
            ...m,
            recipientStatuses: m.recipientStatuses.map((s) =>
              s.userId === authorId
                ? {
                    ...s,
                    replied: true,
                    repliedAt: now,
                    opened: true,
                    openedAt: s.openedAt || now,
                  }
                : s,
            ),
          };
        }),
      );

      const uploadAndCreate = async () => {
        let attachmentIds = attachments
          .map((attachment) => attachment.id)
          .filter((id): id is string => Boolean(id) && !id.startsWith("att-"));

        const localFiles = attachments.filter(
          (attachment) =>
            (attachment.id?.startsWith("att-") ?? false) &&
            attachment.url?.startsWith("blob:"),
        );

        if (localFiles.length > 0) {
          const formData = new FormData();
          for (const fileAttachment of localFiles) {
            const response = await fetch(fileAttachment.url);
            const blob = await response.blob();
            const file = new File(
              [blob],
              fileAttachment.name || `attachment-${Date.now()}`,
              {
                type:
                  fileAttachment.type ||
                  blob.type ||
                  "application/octet-stream",
              },
            );
            formData.append("files", file);
          }

          const uploadResponse = await apiRequest<{ attachments: any[] }>(
            "/upload/files",
            {
              method: "POST",
              body: formData,
            },
          );

          const uploadedIds = (uploadResponse.data.attachments || [])
            .map((attachment: any) => attachment?.id)
            .filter((id: any): id is string => Boolean(id));

          attachmentIds = Array.from(
            new Set([...attachmentIds, ...uploadedIds]),
          );
        }

        await apiRequest(`/memos/${memoId}/comments`, {
          method: "POST",
          body: JSON.stringify({
            body,
            parentId,
            attachmentIds,
          }),
        });
      };

      void uploadAndCreate()
        .then(() => loadLiveMemos())
        .catch((error) => {
          console.error("Failed to create comment on backend:", error);
          loadLiveMemos();
        });
    },
    [loadLiveMemos],
  );

  const editComment = useCallback(
    (commentId: string, newBody: string, userId: string) => {
      const targetComment = comments.find(
        (comment) => comment.id === commentId,
      );
      if (!targetComment || targetComment.authorId !== userId) return;

      const now = new Date().toISOString();

      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== commentId || c.authorId !== userId) return c;
          return { ...c, body: newBody, updatedAt: new Date().toISOString() };
        }),
      );

      setMemos((prev) =>
        prev.map((memo) => {
          if (memo.id !== targetComment.memoId) return memo;
          return {
            ...memo,
            activityLog: [
              {
                id: `local-comment-edited-${commentId}-${now}`,
                userId,
                action: "edited_comment",
                timestamp: now,
                detail: targetComment.parentId
                  ? "updated a reply"
                  : "updated a comment",
              },
              ...memo.activityLog,
            ],
          };
        }),
      );

      void apiRequest(`/comments/${commentId}`, {
        method: "PUT",
        body: JSON.stringify({ body: newBody }),
      })
        .then(() => loadLiveMemos())
        .catch((error) => {
          console.error("Failed to update comment on backend:", error);
          loadLiveMemos();
        });
    },
    [comments, loadLiveMemos],
  );

  const deleteComment = useCallback(
    (commentId: string, userId: string) => {
      const targetComment = comments.find(
        (comment) => comment.id === commentId,
      );
      if (!targetComment || targetComment.authorId !== userId) return;

      const now = new Date().toISOString();

      setMemos((prev) =>
        prev.map((memo) => {
          if (memo.id !== targetComment.memoId) return memo;
          return {
            ...memo,
            activityLog: [
              {
                id: `local-comment-deleted-${commentId}-${now}`,
                userId,
                action: "deleted_comment",
                timestamp: now,
                detail: targetComment.parentId
                  ? "deleted a reply"
                  : "deleted a comment",
              },
              ...memo.activityLog,
            ],
          };
        }),
      );

      setComments((prev) => {
        const removableIds = new Set<string>([commentId]);
        let changed = true;

        while (changed) {
          changed = false;
          for (const comment of prev) {
            if (
              comment.parentId &&
              removableIds.has(comment.parentId) &&
              !removableIds.has(comment.id)
            ) {
              removableIds.add(comment.id);
              changed = true;
            }
          }
        }

        return prev.filter((comment) => !removableIds.has(comment.id));
      });

      void apiRequest(`/comments/${commentId}`, { method: "DELETE" })
        .then(() => loadLiveMemos())
        .catch((error) => {
          console.error("Failed to delete comment on backend:", error);
          loadLiveMemos();
        });
    },
    [comments, loadLiveMemos],
  );

  const toggleCommentPin = useCallback((commentId: string, userId: string) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        return {
          ...c,
          pinned: !c.pinned,
          pinnedBy: c.pinned ? undefined : userId,
        };
      }),
    );
  }, []);

  const addCommentReaction = useCallback(
    (commentId: string, emoji: string, userId: string) => {
      const targetComment = comments.find(
        (comment) => comment.id === commentId,
      );
      if (!targetComment) return;

      const existingReaction = targetComment.reactions.find(
        (reaction) => reaction.emoji === emoji,
      );
      const existingReactionByUser = targetComment.reactions.find((reaction) =>
        reaction.users.includes(userId),
      );

      if (existingReactionByUser && existingReactionByUser.emoji !== emoji) {
        showFriendlyErrorToast(
          "You have already reacted to this comment. Remove your previous reaction before adding a new one.",
        );
        return;
      }

      const hasUserReaction = !!existingReaction?.users.includes(userId);

      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== commentId) return c;
          const existing = c.reactions.find((r) => r.emoji === emoji);
          if (existing) {
            if (existing.users.includes(userId)) {
              const updated = c.reactions
                .map((r) =>
                  r.emoji === emoji
                    ? { ...r, users: r.users.filter((u) => u !== userId) }
                    : r,
                )
                .filter((r) => r.users.length > 0);
              return { ...c, reactions: updated };
            }
            return {
              ...c,
              reactions: c.reactions.map((r) =>
                r.emoji === emoji ? { ...r, users: [...r.users, userId] } : r,
              ),
            };
          }
          return {
            ...c,
            reactions: [...c.reactions, { emoji, users: [userId] }],
          };
        }),
      );

      const requestPromise = hasUserReaction
        ? apiRequest(
            `/comments/${commentId}/reactions/${encodeURIComponent(emoji)}`,
            {
              method: "DELETE",
            },
          )
        : apiRequest(`/comments/${commentId}/reactions`, {
            method: "POST",
            body: JSON.stringify({ emoji }),
          });

      void requestPromise
        .then(() => loadLiveMemos())
        .catch((error) => {
          console.error("Failed to update comment reaction on backend:", error);
          showFriendlyErrorToast(
            getSafeReactionErrorMessage(
              error,
              "We could not update your comment reaction. Please try again.",
            ),
          );
          loadLiveMemos();
        });
    },
    [
      comments,
      loadLiveMemos,
      showFriendlyErrorToast,
      getSafeReactionErrorMessage,
    ],
  );

  const addReaction = useCallback(
    (memoId: string, emoji: string, userId: string) => {
      const targetMemo = memos.find((memo) => memo.id === memoId);
      if (!targetMemo) {
        showFriendlyErrorToast("This memo is no longer available.");
        return;
      }

      const existingReactionByUser = targetMemo.reactions.find((reaction) =>
        reaction.users.includes(userId),
      );

      if (existingReactionByUser && existingReactionByUser.emoji !== emoji) {
        showFriendlyErrorToast(
          "You have already reacted to this memo. Remove your previous reaction before adding a new one.",
        );
        return;
      }

      const hasUserReaction =
        !!existingReactionByUser && existingReactionByUser.emoji === emoji;

      setMemos((prev) =>
        prev.map((m) => {
          if (m.id !== memoId) return m;
          const existing = m.reactions.find((r) => r.emoji === emoji);
          if (existing) {
            if (existing.users.includes(userId)) {
              const updatedReactions = m.reactions
                .map((r) =>
                  r.emoji === emoji
                    ? { ...r, users: r.users.filter((u) => u !== userId) }
                    : r,
                )
                .filter((r) => r.users.length > 0);
              return { ...m, reactions: updatedReactions };
            }
            return {
              ...m,
              reactions: m.reactions.map((r) =>
                r.emoji === emoji ? { ...r, users: [...r.users, userId] } : r,
              ),
            };
          }
          return {
            ...m,
            reactions: [...m.reactions, { emoji, users: [userId] }],
          };
        }),
      );

      const requestPromise = hasUserReaction
        ? apiRequest(
            `/memos/${memoId}/reactions/${encodeURIComponent(emoji)}`,
            {
              method: "DELETE",
            },
          )
        : apiRequest(`/memos/${memoId}/reactions`, {
            method: "POST",
            body: JSON.stringify({ emoji }),
          });

      void requestPromise
        .then(() => loadLiveMemos())
        .catch((error) => {
          console.error("Failed to add reaction on backend:", error);
          showFriendlyErrorToast(
            getSafeReactionErrorMessage(
              error,
              "We could not update your memo reaction. Please try again.",
            ),
          );
          loadLiveMemos();
        });
    },
    [memos, loadLiveMemos, showFriendlyErrorToast, getSafeReactionErrorMessage],
  );

  // ===== WORKFLOW AUTOMATION =====

  const approveWorkflowStep = useCallback(
    (
      memoId: string,
      stepId: string,
      userId: string,
      approved: boolean,
      comment?: string,
    ) => {
      setMemos((prev) =>
        prev.map((m) => {
          if (m.id !== memoId || !m.workflow?.enabled) return m;
          const step = m.workflow.approvalChain.find((s) => s.id === stepId);
          if (!step || step.approverId !== userId || step.status !== "pending")
            return m;

          // Check that all prior steps are approved
          const priorSteps = m.workflow.approvalChain.filter(
            (s) => s.order < step.order,
          );
          if (priorSteps.some((s) => s.status !== "approved")) return m;

          const now = new Date().toISOString();
          const updatedChain = m.workflow.approvalChain.map((s) =>
            s.id === stepId
              ? {
                  ...s,
                  status: approved
                    ? ("approved" as const)
                    : ("rejected" as const),
                  decidedAt: now,
                  comment,
                }
              : s,
          );

          const activityEntry = {
            id: `al${Date.now()}`,
            userId,
            action: approved ? ("approved" as const) : ("unapproved" as const),
            timestamp: now,
            detail: `Workflow step ${step.order}: ${approved ? "Approved" : "Rejected"}${comment ? ` — "${comment}"` : ""}`,
          };

          return {
            ...m,
            workflow: { ...m.workflow, approvalChain: updatedChain },
            activityLog: [activityEntry, ...m.activityLog],
            updatedAt: now,
          };
        }),
      );

      void apiRequest(`/memos/${memoId}/workflow/approve`, {
        method: "POST",
        body: JSON.stringify({
          stepId,
          approved,
          comment,
        }),
      })
        .then(() => loadLiveMemos())
        .catch((error) => {
          console.error("Failed to approve workflow step on backend:", error);
          loadLiveMemos();
        });
    },
    [loadLiveMemos],
  );

  const checkEscalations = useCallback(() => {
    const now = new Date();
    const escalationUpdates: Array<{
      memoId: string;
      workflow: WorkflowConfig;
    }> = [];

    setMemos((prev) =>
      prev.map((m) => {
        if (m.status !== "sent") return m;
        if (!m.workflow?.enabled || !m.workflow.escalation?.enabled) return m;
        if (m.workflow.escalation.escalatedAt) return m; // already escalated

        const currentStep = m.workflow.approvalChain.find(
          (s) => s.status === "pending",
        );
        if (!currentStep) return m;

        // Check if the memo was sent long enough ago
        const sentAt = new Date(m.createdAt);
        const hoursSinceSent =
          (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60);

        if (hoursSinceSent >= m.workflow.escalation.hoursUntilEscalation) {
          const escalationTime = now.toISOString();
          const nextWorkflow: WorkflowConfig = {
            ...m.workflow,
            escalation: {
              ...m.workflow.escalation,
              escalatedAt: escalationTime,
              escalatedStepId: currentStep.id,
            },
          };

          escalationUpdates.push({ memoId: m.id, workflow: nextWorkflow });

          return {
            ...m,
            workflow: nextWorkflow,
            activityLog: [
              ...m.activityLog,
              {
                id: `al${Date.now()}`,
                userId: "system",
                action: "opened" as const,
                timestamp: escalationTime,
                detail: `Auto-escalation triggered: Step ${currentStep.order} pending for ${m.workflow.escalation.hoursUntilEscalation}h`,
              },
            ],
            updatedAt: escalationTime,
          };
        }
        return m;
      }),
    );

    if (escalationUpdates.length > 0) {
      void Promise.all(
        escalationUpdates.map((update) =>
          apiRequest(`/memos/${update.memoId}`, {
            method: "PUT",
            body: JSON.stringify({ workflow: update.workflow }),
          }),
        ),
      )
        .then(() => loadLiveMemos())
        .catch((error) => {
          console.error("Failed to persist workflow escalations:", error);
          loadLiveMemos();
        });
    }
  }, [loadLiveMemos]);

  const checkScheduledMemos = useCallback(() => {
    const now = new Date();
    const scheduledUpdates: Array<{
      memoId: string;
      workflow: WorkflowConfig;
    }> = [];

    setMemos((prev) =>
      prev.map((m) => {
        if (m.status !== "draft" || !m.workflow?.scheduledSendAt) return m;
        if (m.workflow.sentBySchedule) return m;
        const scheduleTime = new Date(m.workflow.scheduledSendAt);
        if (now >= scheduleTime) {
          const sendTime = now.toISOString();
          const nextWorkflow: WorkflowConfig = {
            ...m.workflow,
            sentBySchedule: true,
          };
          scheduledUpdates.push({ memoId: m.id, workflow: nextWorkflow });

          return {
            ...m,
            status: "sent" as const,
            workflow: nextWorkflow,
            recipientStatuses: m.recipientIds.map((uid) => ({
              userId: uid,
              opened: false,
              acknowledged: false,
              approved: false,
              replied: false,
            })),
            activityLog: [
              ...m.activityLog,
              {
                id: `al${Date.now()}`,
                userId: "system",
                action: "opened" as const,
                timestamp: sendTime,
                detail: "Scheduled delivery — memo sent automatically",
              },
            ],
            updatedAt: sendTime,
          };
        }
        return m;
      }),
    );

    if (scheduledUpdates.length > 0) {
      void Promise.all(
        scheduledUpdates.map((update) =>
          apiRequest(`/memos/${update.memoId}`, {
            method: "PUT",
            body: JSON.stringify({
              status: "sent",
              workflow: update.workflow,
            }),
          }),
        ),
      )
        .then(() => loadLiveMemos())
        .catch((error) => {
          console.error("Failed to persist scheduled memo delivery:", error);
          loadLiveMemos();
        });
    }
  }, [loadLiveMemos]);

  // Run escalation and scheduling checks periodically
  React.useEffect(() => {
    const interval = setInterval(() => {
      checkEscalations();
      checkScheduledMemos();
    }, 30000); // every 30 seconds
    // Run once immediately
    checkEscalations();
    checkScheduledMemos();
    return () => clearInterval(interval);
  }, [checkEscalations, checkScheduledMemos]);

  return (
    <MemoContext.Provider
      value={{
        memos: sortedMemos,
        comments,
        addMemo,
        updateMemo,
        editMemo,
        deleteMemo,
        permanentlyDeleteMemo,
        restoreMemo,
        togglePin,
        toggleArchive,
        toggleStar,
        hideMemo,
        acknowledgeMemo,
        unacknowledgeMemo,
        approveMemo,
        unapproveMemo,
        markOpened,
        addComment,
        editComment,
        deleteComment,
        toggleCommentPin,
        addCommentReaction,
        addReaction,
        approveWorkflowStep,
        checkEscalations,
        checkScheduledMemos,
        getMemoById,
        getCommentsByMemoId,
      }}
    >
      {children}
    </MemoContext.Provider>
  );
}

export function useMemos() {
  const context = useContext(MemoContext);
  if (!context) throw new Error("useMemos must be used within MemoProvider");
  return context;
}
