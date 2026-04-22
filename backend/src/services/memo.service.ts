import {
  MemoRepository,
  CreateMemoData,
  UpdateMemoData,
  MemoFilters,
} from "../repositories/memo.repository.js";
import { NotificationService } from "./notification.service.js";
import { LoggingService } from "./logging.service.js";
import { prisma } from "../config/prisma.js";
import { hasPermission } from "../middleware/role-permissions.js";

type WorkflowAutomationStatus = {
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  scheduledProcessedLastRun: number;
  escalationsProcessedLastRun: number;
  totalScheduledProcessed: number;
  totalEscalationsProcessed: number;
};

const workflowAutomationStatus: WorkflowAutomationStatus = {
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
  scheduledProcessedLastRun: 0,
  escalationsProcessedLastRun: 0,
  totalScheduledProcessed: 0,
  totalEscalationsProcessed: 0,
};

export class MemoService {
  private memoRepository: MemoRepository;
  private notificationService: NotificationService;
  private loggingService: LoggingService;

  constructor() {
    this.memoRepository = new MemoRepository();
    this.notificationService = new NotificationService();
    this.loggingService = new LoggingService();
  }

  private slugifyTitle(title: string): string {
    const normalized = (title || "memo")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return normalized.slice(0, 40) || "memo";
  }

  private randomSlugSuffix(length = 6): string {
    const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
    let out = "";
    for (let i = 0; i < length; i += 1) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
  }

  private async generateUniqueMemoSlug(title: string): Promise<string> {
    const base = this.slugifyTitle(title);

    for (let i = 0; i < 8; i += 1) {
      const candidate = `${base}-${this.randomSlugSuffix(6)}`;
      const existing = await prisma.memo.findFirst({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
    }

    return `${base}-${Date.now().toString(36).slice(-6)}`;
  }

  private async resolveTagIds(tagIdentifiers?: string[]) {
    const uniqueIdentifiers = Array.from(
      new Set(
        (tagIdentifiers || [])
          .map((identifier) => identifier?.trim())
          .filter(Boolean),
      ),
    );

    if (!uniqueIdentifiers.length) {
      return [] as string[];
    }

    const tags = await prisma.tag.findMany({
      where: {
        OR: [
          { id: { in: uniqueIdentifiers } },
          { name: { in: uniqueIdentifiers } },
        ],
      },
      select: { id: true, name: true },
    });

    const byId = new Map(tags.map((tag) => [tag.id, tag.id]));
    const byName = new Map(tags.map((tag) => [tag.name, tag.id]));

    const unresolved = uniqueIdentifiers.filter(
      (identifier) => !byId.has(identifier) && !byName.has(identifier),
    );

    if (unresolved.length) {
      const createdTags = await Promise.all(
        unresolved.map((name) =>
          prisma.tag.upsert({
            where: { name },
            update: {},
            create: {
              name,
              category: "general",
              color: "slate",
            },
            select: { id: true, name: true },
          }),
        ),
      );

      createdTags.forEach((tag) => {
        byName.set(tag.name, tag.id);
      });
    }

    return uniqueIdentifiers.map((identifier) => {
      const resolved = byId.get(identifier) || byName.get(identifier);
      if (!resolved) {
        throw new Error("One or more tags not found");
      }
      return resolved;
    });
  }

  async getMemos(
    filters: MemoFilters = {},
    page = 1,
    limit = 20,
    userId?: string,
  ) {
    if (userId) {
      filters.viewerId = userId;
    }

    const result = await this.memoRepository.findAll(filters, page, limit);

    const memos = result.memos.map((memo: any) => ({
      id: memo.id,
      slug: memo.slug ?? undefined,
      title: memo.title,
      body: memo.body,
      groupId: memo.groupId,
      creator: memo.creator,
      visibility: memo.visibility,
      status: memo.status,
      previousStatus: memo.previousStatus ?? null,
      pinned: memo.pinned,
      archived: memo.archived,
      referencedMemoIds: memo.referencedMemoIds,
      recipients: memo.recipients.map((r: any) => ({
        ...r.user,
        opened: r.opened,
        openedAt: r.openedAt,
        acknowledged: r.acknowledged,
        acknowledgedAt: r.acknowledgedAt,
        approved: r.approved,
        approvedAt: r.approvedAt,
        replied: r.replied,
        repliedAt: r.repliedAt,
      })),
      tags: memo.tags.map((mt: any) => mt.tag),
      attachments: memo.attachments,
      comments: memo.comments,
      reactions: memo.reactions,
      starredBy: memo.starredBy || [],
      hiddenBy: memo.hiddenBy || [],
      workflow: memo.workflow ?? undefined,
      stats: {
        commentCount: memo._count.comments,
        reactionCount: memo._count.reactions,
        recipientCount: memo._count.recipients,
      },
      createdAt: memo.createdAt,
      updatedAt: memo.updatedAt,
    }));

    return {
      memos,
      pagination: result.pagination,
    };
  }

  async getMemoById(idOrSlug: string, userId?: string) {
    const memo = await this.memoRepository.findByIdOrSlug(idOrSlug);

    if (!memo) {
      throw new Error("Memo not found");
    }

    if (userId) {
      const isCreator = memo.creatorId === userId;

      if (memo.visibility === "department" || memo.visibility === "protected") {
        if (!isCreator) {
          throw new Error("Access denied");
        }
      } else if (memo.visibility !== "public") {
        const isRecipient = memo.recipients.some((r) => r.userId === userId);
        if (!isRecipient && !isCreator) {
          throw new Error("Access denied");
        }
      }
    }

    return {
      id: memo.id,
      slug: memo.slug ?? undefined,
      title: memo.title,
      body: memo.body,
      groupId: memo.groupId,
      creator: memo.creator,
      visibility: memo.visibility,
      status: memo.status,
      pinned: memo.pinned,
      archived: memo.archived,
      referencedMemoIds: memo.referencedMemoIds,
      recipients: memo.recipients.map((r) => ({
        ...r.user,
        opened: r.opened,
        openedAt: r.openedAt,
        acknowledged: r.acknowledged,
        acknowledgedAt: r.acknowledgedAt,
        approved: r.approved,
        approvedAt: r.approvedAt,
        replied: r.replied,
        repliedAt: r.repliedAt,
      })),
      tags: memo.tags.map((mt) => mt.tag),
      attachments: memo.attachments,
      comments: memo.comments,
      reactions: memo.reactions,
      workflow: memo.workflow ?? undefined,
      stats: {
        commentCount: memo._count.comments,
        reactionCount: memo._count.reactions,
        recipientCount: memo._count.recipients,
      },
      createdAt: memo.createdAt,
      updatedAt: memo.updatedAt,
    };
  }

  async createMemo(data: CreateMemoData, creatorName?: string) {
    const requestedRecipientIds = Array.from(
      new Set(
        (data.recipientIds || []).map((id) => id?.trim()).filter(Boolean),
      ),
    ) as string[];
    const uniqueRecipientIds =
      data.visibility === "department" || data.visibility === "protected"
        ? []
        : requestedRecipientIds;

    const uniqueAttachmentIds = Array.from(
      new Set(
        (data.attachmentIds || []).map((id) => id?.trim()).filter(Boolean),
      ),
    ) as string[];

    const uniqueTagIdentifiers = Array.from(
      new Set((data.tagIds || []).map((id) => id?.trim()).filter(Boolean)),
    ) as string[];

    const resolvedTagIds = uniqueTagIdentifiers.length
      ? await this.resolveTagIds(uniqueTagIdentifiers)
      : [];

    if (uniqueRecipientIds.length) {
      const recipients = await prisma.user.findMany({
        where: { id: { in: uniqueRecipientIds } },
        select: { id: true },
      });

      if (recipients.length !== uniqueRecipientIds.length) {
        throw new Error("One or more recipients not found");
      }
    }

    if (uniqueAttachmentIds.length) {
      const attachments = await prisma.attachment.findMany({
        where: { id: { in: uniqueAttachmentIds } },
        select: { id: true },
      });

      if (attachments.length !== uniqueAttachmentIds.length) {
        throw new Error("One or more attachments not found");
      }
    }

    const memo = await this.memoRepository.create({
      ...data,
      slug: await this.generateUniqueMemoSlug(data.title),
      recipientIds: uniqueRecipientIds,
      attachmentIds: uniqueAttachmentIds,
      tagIds: resolvedTagIds,
    });

    setImmediate(() => {
      this.loggingService
        .logMemoCreation(data.creatorId, memo.id, {
          title: data.title,
          recipientCount: uniqueRecipientIds.length,
        })
        .catch((error) => console.error("Failed to log memo creation:", error));
    });

    if (data.status !== "draft" && uniqueRecipientIds.length && creatorName) {
      setImmediate(() => {
        this.notificationService
          .notifyNewMemo(memo.id, memo.title, uniqueRecipientIds, creatorName)
          .catch((error) =>
            console.error("Failed to send memo notifications:", error),
          );
      });
    }

    return {
      id: memo.id,
      slug: memo.slug ?? undefined,
      title: memo.title,
      body: memo.body,
      groupId: memo.groupId,
      creator: memo.creator,
      visibility: memo.visibility,
      status: memo.status,
      pinned: memo.pinned,
      archived: memo.archived,
      referencedMemoIds: memo.referencedMemoIds,
      recipients: memo.recipients.map((r) => r.user),
      tags: memo.tags.map((mt) => mt.tag),
      attachments: memo.attachments,
      workflow: (memo as any).workflow ?? undefined,
      createdAt: memo.createdAt,
      updatedAt: memo.updatedAt,
    };
  }

  async updateMemo(
    id: string,
    data: UpdateMemoData,
    userId: string,
    userRole = "member",
  ) {
    const existingMemo = await this.memoRepository.findById(id);

    if (!existingMemo) {
      throw new Error("Memo not found");
    }

    const canEditAnyMemo = hasPermission(userRole, "canEditAnyMemo");
    if (existingMemo.creatorId !== userId && !canEditAnyMemo) {
      throw new Error("Only the creator can update this memo");
    }

    const canPinMemos = hasPermission(userRole, "canPinMemos");
    const canArchiveMemos = hasPermission(userRole, "canArchiveMemos");
    const isCreator = existingMemo.creatorId === userId;

    if (data.pinned !== undefined && data.pinned !== existingMemo.pinned) {
      if (!canPinMemos && !isCreator) {
        throw new Error("You do not have permission to pin memos");
      }
    }

    const isArchiveStatusUpdate = data.status === "archived";
    const isArchiveFlagUpdate =
      data.archived !== undefined && data.archived !== existingMemo.archived;

    if (isArchiveStatusUpdate || isArchiveFlagUpdate) {
      if (!canArchiveMemos && !isCreator) {
        throw new Error("You do not have permission to archive memos");
      }
    }

    const resolvedTagIds = data.tagIds?.length
      ? await this.resolveTagIds(data.tagIds)
      : data.tagIds;

    if (data.attachmentIds?.length) {
      const attachments = await prisma.attachment.findMany({
        where: { id: { in: data.attachmentIds } },
        select: { id: true },
      });

      if (attachments.length !== data.attachmentIds.length) {
        throw new Error("One or more attachments not found");
      }
    }

    const normalizedRecipientIds =
      data.recipientIds === undefined
        ? undefined
        : Array.from(
            new Set(
              data.recipientIds
                .map((id) => id?.trim())
                .filter((id): id is string => Boolean(id)),
            ),
          );

    if (normalizedRecipientIds?.length) {
      const recipients = await prisma.user.findMany({
        where: { id: { in: normalizedRecipientIds } },
        select: { id: true },
      });

      if (recipients.length !== normalizedRecipientIds.length) {
        throw new Error("One or more recipients not found");
      }
    }

    // When soft-deleting, save current status so it can be restored later
    const updatePayload: UpdateMemoData = {
      ...data,
      tagIds: resolvedTagIds,
      recipientIds: normalizedRecipientIds,
    };

    const nextVisibility = updatePayload.visibility ?? existingMemo.visibility;
    if (nextVisibility === "department" || nextVisibility === "protected") {
      updatePayload.recipientIds = [];
    }

    // Keep archived flag and status aligned when archive fields are updated.
    if (updatePayload.status === "archived") {
      updatePayload.archived = true;
    }
    if (updatePayload.archived === true) {
      updatePayload.status = "archived";
    }
    if (updatePayload.archived === false && existingMemo.archived) {
      if (updatePayload.status === "archived") {
        updatePayload.status = "sent";
      }
      if (!updatePayload.status) {
        updatePayload.status = "sent";
      }
    }

    if (data.status === "deleted" && existingMemo.status !== "deleted") {
      updatePayload.previousStatus = existingMemo.status;
    }

    const memo = await this.memoRepository.update(id, updatePayload);

    return {
      id: memo.id,
      slug: memo.slug ?? undefined,
      title: memo.title,
      body: memo.body,
      creator: memo.creator,
      visibility: memo.visibility,
      status: memo.status,
      previousStatus: (memo as any).previousStatus ?? null,
      pinned: memo.pinned,
      archived: memo.archived,
      referencedMemoIds: memo.referencedMemoIds,
      recipients: memo.recipients.map((r) => r.user),
      tags: memo.tags.map((mt) => mt.tag),
      attachments: memo.attachments,
      workflow: (memo as any).workflow ?? undefined,
      createdAt: memo.createdAt,
      updatedAt: memo.updatedAt,
    };
  }

  async deleteMemo(id: string, userId: string, userRole = "member") {
    const existingMemo = await this.memoRepository.findById(id);

    if (!existingMemo) {
      throw new Error("Memo not found");
    }

    const canDeleteAnyMemo = hasPermission(userRole, "canDeleteAnyMemo");
    if (existingMemo.creatorId !== userId && !canDeleteAnyMemo) {
      throw new Error("Only the creator can delete this memo");
    }

    await this.memoRepository.delete(id);
    return { success: true };
  }

  async markAsRead(memoId: string, userId: string) {
    return this.memoRepository.updateRecipientStatus(memoId, userId, {
      opened: true,
    });
  }

  async acknowledgeMemo(memoId: string, userId: string) {
    const result = await this.memoRepository.updateRecipientStatus(
      memoId,
      userId,
      {
        acknowledged: true,
      },
    );

    setImmediate(async () => {
      try {
        const [memo, actor] = await Promise.all([
          prisma.memo.findUnique({
            where: { id: memoId },
            select: { id: true, title: true, creatorId: true },
          }),
          prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          }),
        ]);

        if (memo?.creatorId && memo.creatorId !== userId) {
          await this.notificationService.createNotification({
            userId: memo.creatorId,
            type: "memo_received",
            title: "Memo acknowledged",
            body: `${actor?.name || "A recipient"} acknowledged "${memo.title}"`,
            actionUrl: `/memos/${memo.id}`,
          });
        }
      } catch (error) {
        console.error("Failed to send acknowledge notification:", error);
      }
    });

    return result;
  }

  async unacknowledgeMemo(memoId: string, userId: string) {
    return this.memoRepository.updateRecipientStatus(memoId, userId, {
      acknowledged: false,
    });
  }

  async approveMemo(memoId: string, userId: string) {
    const result = await this.memoRepository.updateRecipientStatus(
      memoId,
      userId,
      {
        approved: true,
      },
    );

    setImmediate(async () => {
      try {
        const [memo, actor] = await Promise.all([
          prisma.memo.findUnique({
            where: { id: memoId },
            select: { id: true, title: true, creatorId: true },
          }),
          prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          }),
        ]);

        if (memo?.creatorId && memo.creatorId !== userId) {
          await this.notificationService.createNotification({
            userId: memo.creatorId,
            type: "memo_approved",
            title: "Memo approved",
            body: `${actor?.name || "A recipient"} approved "${memo.title}"`,
            actionUrl: `/memos/${memo.id}`,
          });
        }
      } catch (error) {
        console.error("Failed to send approve notification:", error);
      }
    });

    return result;
  }

  async unapproveMemo(memoId: string, userId: string) {
    return this.memoRepository.updateRecipientStatus(memoId, userId, {
      approved: false,
    });
  }

  async replyToMemo(memoId: string, userId: string) {
    const result = await this.memoRepository.updateRecipientStatus(
      memoId,
      userId,
      {
        replied: true,
      },
    );

    setImmediate(async () => {
      try {
        const [memo, actor] = await Promise.all([
          prisma.memo.findUnique({
            where: { id: memoId },
            select: { id: true, title: true, creatorId: true },
          }),
          prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          }),
        ]);

        if (memo?.creatorId && memo.creatorId !== userId) {
          await this.notificationService.createNotification({
            userId: memo.creatorId,
            type: "comment_added",
            title: "Memo replied",
            body: `${actor?.name || "A recipient"} replied to "${memo.title}"`,
            actionUrl: `/memos/${memo.id}`,
          });
        }
      } catch (error) {
        console.error("Failed to send reply notification:", error);
      }
    });

    return result;
  }

  async addReaction(memoId: string, userId: string, emoji: string) {
    const existingReaction = await prisma.reaction.findFirst({
      where: {
        memoId,
        userId,
        emoji,
      },
    });

    if (existingReaction) {
      throw new Error("User has already reacted with this emoji");
    }

    const reaction = await this.memoRepository.addReaction(
      memoId,
      userId,
      emoji,
    );

    setImmediate(async () => {
      try {
        const [memo, actor] = await Promise.all([
          prisma.memo.findUnique({
            where: { id: memoId },
            select: { id: true, title: true, creatorId: true },
          }),
          prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          }),
        ]);

        if (memo?.creatorId && memo.creatorId !== userId) {
          await this.notificationService.createNotification({
            userId: memo.creatorId,
            type: "reaction_added",
            title: "New Like",
            body: `${actor?.name || "Someone"} liked your memo "${memo.title}" with ${emoji}`,
            actionUrl: `/memos/${memo.id}`,
          });
        }
      } catch (error) {
        console.error("Failed to send memo reaction notification:", error);
      }
    });

    return reaction;
  }

  async removeReaction(memoId: string, userId: string, emoji: string) {
    return this.memoRepository.removeReaction(memoId, userId, emoji);
  }

  async getReactions(memoId: string) {
    return this.memoRepository.getReactions(memoId);
  }

  async performAction(
    memoId: string,
    action: string,
    userId: string,
    userRole = "member",
  ) {
    const memo = await this.memoRepository.findById(memoId);
    if (!memo) {
      return null;
    }

    const isCreator = memo.creatorId === userId;
    const isRecipient = memo.recipients.some((r) => r.userId === userId);
    const canEditAnyMemo = hasPermission(userRole, "canEditAnyMemo");
    const canPinMemos = hasPermission(userRole, "canPinMemos");
    const canArchiveMemos = hasPermission(userRole, "canArchiveMemos");

    switch (action) {
      case "pin":
        if (!canPinMemos) {
          throw new Error("You do not have permission to pin memos");
        }
        return this.memoRepository.update(memoId, { pinned: true });

      case "unpin":
        if (!canPinMemos) {
          throw new Error("You do not have permission to pin memos");
        }
        return this.memoRepository.update(memoId, { pinned: false });

      case "archive":
        if (!canArchiveMemos) {
          throw new Error("You do not have permission to archive memos");
        }
        return this.memoRepository.update(memoId, {
          archived: true,
          status: "archived",
        });

      case "unarchive":
        if (!canArchiveMemos) {
          throw new Error("You do not have permission to archive memos");
        }
        return this.memoRepository.update(memoId, {
          archived: false,
          status: "sent",
        });

      case "star": {
        const currentStarred = (memo.starredBy as string[]) || [];
        if (!currentStarred.includes(userId)) {
          const newStarred = [...currentStarred, userId];
          return this.memoRepository.update(memoId, {
            starredBy: newStarred as any,
          } as any);
        }
        return memo;
      }

      case "unstar": {
        const currentStarred = (memo.starredBy as string[]) || [];
        const newStarred = currentStarred.filter((id) => id !== userId);
        return this.memoRepository.update(memoId, {
          starredBy: newStarred as any,
        } as any);
      }

      case "hide": {
        const currentHidden = (memo.hiddenBy as string[]) || [];
        if (!currentHidden.includes(userId)) {
          const newHidden = [...currentHidden, userId];
          return this.memoRepository.update(memoId, {
            hiddenBy: newHidden as any,
          } as any);
        }
        return memo;
      }

      case "read":
        if (!isRecipient) {
          throw new Error("Only recipients can mark memos as read");
        }
        await this.memoRepository.updateRecipientStatus(memoId, userId, {
          opened: true,
        });
        return this.memoRepository.findById(memoId);

      case "acknowledge":
        if (!isRecipient) {
          throw new Error("Only recipients can acknowledge memos");
        }
        await this.memoRepository.updateRecipientStatus(memoId, userId, {
          acknowledged: true,
        });
        setImmediate(async () => {
          try {
            const actor = await prisma.user.findUnique({
              where: { id: userId },
              select: { name: true },
            });
            if (memo.creatorId !== userId) {
              await this.notificationService.createNotification({
                userId: memo.creatorId,
                type: "memo_received",
                title: "Memo acknowledged",
                body: `${actor?.name || "A recipient"} acknowledged "${memo.title}"`,
                actionUrl: `/memos/${memo.id}`,
              });
            }
          } catch (error) {
            console.error("Failed to send acknowledge notification:", error);
          }
        });
        return this.memoRepository.findById(memoId);

      case "unacknowledge":
        if (!isRecipient) {
          throw new Error("Only recipients can unacknowledge memos");
        }
        await this.memoRepository.updateRecipientStatus(memoId, userId, {
          acknowledged: false,
        });
        return this.memoRepository.findById(memoId);

      case "approve":
        if (!isRecipient) {
          throw new Error("Only recipients can approve memos");
        }
        await this.memoRepository.updateRecipientStatus(memoId, userId, {
          approved: true,
        });
        setImmediate(async () => {
          try {
            const actor = await prisma.user.findUnique({
              where: { id: userId },
              select: { name: true },
            });
            if (memo.creatorId !== userId) {
              await this.notificationService.createNotification({
                userId: memo.creatorId,
                type: "memo_approved",
                title: "Memo approved",
                body: `${actor?.name || "A recipient"} approved "${memo.title}"`,
                actionUrl: `/memos/${memo.id}`,
              });
            }
          } catch (error) {
            console.error("Failed to send approve notification:", error);
          }
        });
        return this.memoRepository.findById(memoId);

      case "unapprove":
        if (!isRecipient) {
          throw new Error("Only recipients can unapprove memos");
        }
        await this.memoRepository.updateRecipientStatus(memoId, userId, {
          approved: false,
        });
        return this.memoRepository.findById(memoId);

      case "reply":
        if (!isRecipient) {
          throw new Error("Only recipients can reply to memos");
        }
        await this.memoRepository.updateRecipientStatus(memoId, userId, {
          replied: true,
        });
        return this.memoRepository.findById(memoId);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async approveMemoWorkflow(
    memoId: string,
    userId: string,
    stepId: string,
    approved: boolean,
    comment?: string,
  ) {
    const memo = await this.memoRepository.findById(memoId);
    if (!memo) {
      throw new Error("Memo not found");
    }

    const isRecipient = memo.recipients.some((r) => r.userId === userId);
    if (!isRecipient) {
      throw new Error("Only recipients can approve/reject memos");
    }

    const workflow = (memo as any).workflow as any;
    if (
      !workflow?.enabled ||
      !Array.isArray(workflow.approvalChain) ||
      workflow.approvalChain.length === 0
    ) {
      throw new Error("Workflow is not configured for this memo");
    }

    const sortedChain = [...workflow.approvalChain].sort(
      (a, b) => (a.order || 0) - (b.order || 0),
    );
    const targetStep = sortedChain.find((step) => step.id === stepId);

    if (!targetStep) {
      throw new Error("Workflow step not found");
    }
    if (targetStep.approverId !== userId) {
      throw new Error("You are not assigned to this workflow step");
    }
    if (targetStep.status !== "pending") {
      throw new Error("This workflow step has already been decided");
    }

    const priorSteps = sortedChain.filter(
      (step) => (step.order || 0) < (targetStep.order || 0),
    );
    if (priorSteps.some((step) => step.status !== "approved")) {
      throw new Error("Prior workflow steps must be approved first");
    }

    const decidedAt = new Date().toISOString();
    const updatedChain = sortedChain.map((step) =>
      step.id === stepId
        ? {
            ...step,
            status: approved ? "approved" : "rejected",
            decidedAt,
            comment,
          }
        : step,
    );

    await this.memoRepository.update(memoId, {
      workflow: {
        ...workflow,
        approvalChain: updatedChain,
      },
    } as any);

    await prisma.memoRecipient.updateMany({
      where: { memoId, userId },
      data: {
        approved,
        approvedAt: new Date(),
      },
    });

    setImmediate(() => {
      this.loggingService
        .logMemoAction(
          userId,
          memoId,
          approved ? "workflow_approved" : "workflow_rejected",
          { comment },
        )
        .catch((error) =>
          console.error("Failed to log workflow approval:", error),
        );
    });

    const statusText = approved ? "approved" : "rejected";
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    if (currentUser) {
      await this.notificationService.createNotification({
        userId: memo.creatorId,
        type: approved ? "memo_approved" : "memo_rejected",
        title: `Memo ${statusText}: ${memo.title}`,
        body: `${currentUser.name} has ${statusText} your memo${comment ? ": " + comment : ""}`,
        actionUrl: `/memos/${memoId}`,
      });
    }

    return this.memoRepository.findById(memoId);
  }

  async processScheduledMemos() {
    const now = new Date();

    const candidates = await prisma.memo.findMany({
      where: {
        status: "draft",
        workflow: { not: null },
      },
      select: {
        id: true,
        title: true,
        status: true,
        workflow: true,
      },
      take: 200,
    });

    let processed = 0;

    for (const memo of candidates) {
      const workflow = memo.workflow as any;
      if (!workflow?.enabled || !workflow?.scheduledSendAt) continue;
      if (workflow.sentBySchedule) continue;

      const scheduleTime = new Date(workflow.scheduledSendAt);
      if (Number.isNaN(scheduleTime.getTime())) continue;
      if (now < scheduleTime) continue;

      await this.memoRepository.update(memo.id, {
        status: "sent",
        workflow: {
          ...workflow,
          sentBySchedule: true,
        },
      } as any);

      processed += 1;
    }

    return { processed };
  }

  async processWorkflowEscalations() {
    const now = new Date();

    const candidates = await prisma.memo.findMany({
      where: {
        status: "sent",
        workflow: { not: null },
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        workflow: true,
      },
      take: 200,
    });

    let processed = 0;

    for (const memo of candidates) {
      const workflow = memo.workflow as any;
      const escalation = workflow?.escalation;

      if (!workflow?.enabled) continue;
      if (!Array.isArray(workflow.approvalChain)) continue;
      if (!escalation?.enabled) continue;
      if (escalation.escalatedAt) continue;

      const sortedChain = [...workflow.approvalChain].sort(
        (a, b) => (a.order || 0) - (b.order || 0),
      );

      const currentStep = sortedChain.find((step) => {
        if (step.status !== "pending") return false;
        const priorSteps = sortedChain.filter(
          (candidate) => (candidate.order || 0) < (step.order || 0),
        );
        return priorSteps.every((candidate) => candidate.status === "approved");
      });

      if (!currentStep) continue;

      const createdAt = new Date(memo.createdAt);
      const hoursSinceCreated =
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceCreated < (escalation.hoursUntilEscalation ?? 0)) continue;

      await this.memoRepository.update(memo.id, {
        workflow: {
          ...workflow,
          escalation: {
            ...escalation,
            escalatedAt: now.toISOString(),
            escalatedStepId: currentStep.id,
          },
        },
      } as any);

      processed += 1;
    }

    return { processed };
  }

  async runWorkflowAutomationTick() {
    workflowAutomationStatus.lastRunAt = new Date().toISOString();

    try {
      const [scheduledResult, escalationResult] = await Promise.all([
        this.processScheduledMemos(),
        this.processWorkflowEscalations(),
      ]);

      workflowAutomationStatus.scheduledProcessedLastRun =
        scheduledResult.processed;
      workflowAutomationStatus.escalationsProcessedLastRun =
        escalationResult.processed;
      workflowAutomationStatus.totalScheduledProcessed +=
        scheduledResult.processed;
      workflowAutomationStatus.totalEscalationsProcessed +=
        escalationResult.processed;
      workflowAutomationStatus.lastSuccessAt = new Date().toISOString();
      workflowAutomationStatus.lastError = null;

      return {
        scheduledProcessed: scheduledResult.processed,
        escalationsProcessed: escalationResult.processed,
      };
    } catch (error) {
      workflowAutomationStatus.lastError =
        error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  getWorkflowAutomationStatus() {
    return { ...workflowAutomationStatus };
  }
}
