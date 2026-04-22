import { prisma } from "../config/prisma.js";
import { hasPermission } from "../middleware/role-permissions.js";

type NormalizedActivityAction =
  | "created"
  | "updated"
  | "deleted"
  | "opened"
  | "acknowledged"
  | "unacknowledged"
  | "approved"
  | "unapproved"
  | "commented"
  | "replied"
  | "edited_comment"
  | "deleted_comment"
  | "reacted";

interface ReportSourceUser {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
}

interface ReportSourceGroup {
  id: string;
  name: string;
  type: string;
  memberIds: string[];
}

interface ReportSourceMemo {
  id: string;
  title: string;
  body: string;
  creatorId: string;
  visibility: string;
  status: string;
  recipientIds: string[];
  recipientStatuses: Array<{
    userId: string;
    opened: boolean;
    openedAt?: string;
    acknowledged: boolean;
    acknowledgedAt?: string;
    approved: boolean;
    approvedAt?: string;
    replied: boolean;
    repliedAt?: string;
    repliedComment?: string;
  }>;
  groupId?: string;
  tags: string[];
  attachments: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
    thumbnailUrl?: string;
  }>;
  reactions: Array<{
    emoji: string;
    users: string[];
  }>;
  pinned: boolean;
  archived: boolean;
  referencedMemoIds: string[];
  editHistory: Array<{
    id: string;
    editedAt: string;
    editedBy: string;
    changes: Array<{
      field: string;
      oldValue: string;
      newValue: string;
    }>;
  }>;
  activityLog: Array<{
    id: string;
    userId: string;
    action: NormalizedActivityAction;
    timestamp: string;
    detail?: string;
  }>;
  hiddenBy: string[];
  starredBy: string[];
  workflow?: unknown;
  previousStatus?: string;
  createdAt: string;
  updatedAt: string;
}

interface ReportSourceResponse {
  generatedAt: string;
  users: ReportSourceUser[];
  groups: ReportSourceGroup[];
  memos: ReportSourceMemo[];
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function aggregateMemoReactions(
  reactions: Array<{ emoji: string; userId: string }>,
): Array<{ emoji: string; users: string[] }> {
  const byEmoji = new Map<string, Set<string>>();
  for (const reaction of reactions) {
    if (!byEmoji.has(reaction.emoji)) {
      byEmoji.set(reaction.emoji, new Set<string>());
    }
    byEmoji.get(reaction.emoji)?.add(reaction.userId);
  }

  return Array.from(byEmoji.entries()).map(([emoji, users]) => ({
    emoji,
    users: Array.from(users),
  }));
}

function resolveReplyCommentForRecipient(
  recipient: {
    userId: string;
    replied: boolean;
    repliedAt: Date | null;
  },
  comments: Array<{
    authorId: string;
    body: string;
    createdAt: Date;
  }>,
): string | undefined {
  if (!recipient.replied) return undefined;

  const authoredComments = comments.filter((comment) => {
    if (comment.authorId !== recipient.userId) return false;
    return typeof comment.body === "string" && comment.body.length > 0;
  });

  if (authoredComments.length === 0) return undefined;
  if (!recipient.repliedAt) {
    return authoredComments[authoredComments.length - 1]?.body;
  }

  const repliedAtMs = recipient.repliedAt.getTime();

  // Primary match: comment authored closest before (or at) repliedAt.
  let latestBeforeOrAt: (typeof authoredComments)[number] | undefined;
  for (const comment of authoredComments) {
    if (comment.createdAt.getTime() <= repliedAtMs) {
      if (
        !latestBeforeOrAt ||
        comment.createdAt.getTime() > latestBeforeOrAt.createdAt.getTime()
      ) {
        latestBeforeOrAt = comment;
      }
    }
  }
  if (latestBeforeOrAt) return latestBeforeOrAt.body;

  // Fallback for clock skew/order issues: earliest comment after repliedAt.
  let earliestAfter: (typeof authoredComments)[number] | undefined;
  for (const comment of authoredComments) {
    if (comment.createdAt.getTime() > repliedAtMs) {
      if (
        !earliestAfter ||
        comment.createdAt.getTime() < earliestAfter.createdAt.getTime()
      ) {
        earliestAfter = comment;
      }
    }
  }

  return earliestAfter?.body || authoredComments[authoredComments.length - 1]?.body;
}

export class ReportsService {
  async getSourceForUser(
    userId: string,
    role?: string,
  ): Promise<ReportSourceResponse> {
    const canViewAllMemos = hasPermission(role, "canViewAllMemos");
    const canViewAllUsers = hasPermission(role, "canViewAllUsers");

    const memoCandidates = await prisma.memo.findMany({
      where: canViewAllMemos
        ? {
            status: { not: "deleted" },
          }
        : {
            status: { not: "deleted" },
            OR: [
              { visibility: "public" },
              { creatorId: userId },
              { recipients: { some: { userId } } },
            ],
          },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            role: true,
          },
        },
        group: {
          include: {
            members: {
              select: {
                userId: true,
              },
            },
          },
        },
        recipients: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                department: true,
                role: true,
              },
            },
          },
        },
        attachments: true,
        tags: {
          include: {
            tag: true,
          },
        },
        reactions: true,
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                department: true,
                role: true,
              },
            },
            attachments: true,
            commentReactions: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        editHistory: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const visibleMemos = memoCandidates.filter((memo) => {
      if (canViewAllMemos) return true;
      const hiddenBy = toStringArray(memo.hiddenBy);
      return !hiddenBy.includes(userId);
    });

    const memoIds = visibleMemos.map((memo) => memo.id);

    const activityLogs = memoIds.length
      ? await prisma.activityLog.findMany({
          where: {
            resourceType: "memo",
            resourceId: { in: memoIds },
          },
          orderBy: {
            createdAt: "desc",
          },
        })
      : [];

    const activityLogsByMemo = new Map<string, typeof activityLogs>();
    for (const log of activityLogs) {
      const details =
        log.details && typeof log.details === "object"
          ? (log.details as Record<string, unknown>)
          : {};
      const memoId =
        log.resourceType === "memo"
          ? log.resourceId
          : typeof details.memoId === "string"
            ? details.memoId
            : undefined;
      if (!memoId) continue;
      const existing = activityLogsByMemo.get(memoId) || [];
      existing.push(log);
      activityLogsByMemo.set(memoId, existing);
    }

    const referencedUserIds = new Set<string>([userId]);
    const referencedGroupIds = new Set<string>();

    for (const memo of visibleMemos) {
      referencedUserIds.add(memo.creatorId);
      if (memo.groupId) referencedGroupIds.add(memo.groupId);
      toStringArray(memo.starredBy).forEach((id) => referencedUserIds.add(id));
      memo.recipients.forEach((recipient) => referencedUserIds.add(recipient.userId));
      memo.reactions.forEach((reaction) => referencedUserIds.add(reaction.userId));
      memo.comments.forEach((comment) => {
        referencedUserIds.add(comment.authorId);
        comment.commentReactions.forEach((reaction) =>
          referencedUserIds.add(reaction.userId),
        );
      });
      memo.editHistory.forEach((entry) => referencedUserIds.add(entry.editedBy));
      memo.group?.members.forEach((member) => referencedUserIds.add(member.userId));
    }

    const users = await prisma.user.findMany({
      where: canViewAllUsers
        ? { deletedAt: null }
        : { id: { in: Array.from(referencedUserIds) }, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        role: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    const groups = await prisma.group.findMany({
      where: referencedGroupIds.size > 0 ? { id: { in: Array.from(referencedGroupIds) } } : undefined,
      include: {
        members: {
          select: {
            userId: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const memos: ReportSourceMemo[] = visibleMemos.map((memo) => {
      const derivedActivityLog: ReportSourceMemo["activityLog"] = [];
      const seen = new Set<string>();

      const pushActivity = (
        id: string,
        actorUserId: string,
        action: NormalizedActivityAction,
        timestamp: Date | string,
        detail?: string,
      ) => {
        if (!actorUserId || seen.has(id)) return;
        seen.add(id);
        derivedActivityLog.push({
          id,
          userId: actorUserId,
          action,
          timestamp:
            timestamp instanceof Date
              ? timestamp.toISOString()
              : new Date(timestamp).toISOString(),
          detail,
        });
      };

      pushActivity(
        `memo-created-${memo.id}`,
        memo.creatorId,
        "created",
        memo.createdAt,
      );

      memo.editHistory.forEach((entry) => {
        pushActivity(
          `memo-updated-${entry.id}`,
          entry.editedBy,
          "updated",
          entry.createdAt,
          entry.reason || "memo content updated",
        );
      });

      memo.recipients.forEach((recipient) => {
        if (recipient.opened && recipient.openedAt) {
          pushActivity(
            `memo-opened-${memo.id}-${recipient.userId}`,
            recipient.userId,
            "opened",
            recipient.openedAt,
          );
        }
        if (recipient.acknowledged && recipient.acknowledgedAt) {
          pushActivity(
            `memo-ack-${memo.id}-${recipient.userId}`,
            recipient.userId,
            "acknowledged",
            recipient.acknowledgedAt,
          );
        }
        if (recipient.approved && recipient.approvedAt) {
          pushActivity(
            `memo-approved-${memo.id}-${recipient.userId}`,
            recipient.userId,
            "approved",
            recipient.approvedAt,
          );
        }
        if (recipient.replied && recipient.repliedAt) {
          pushActivity(
            `memo-replied-${memo.id}-${recipient.userId}`,
            recipient.userId,
            "replied",
            recipient.repliedAt,
          );
        }
      });

      memo.comments.forEach((comment) => {
        pushActivity(
          `comment-created-${comment.id}`,
          comment.authorId,
          comment.parentId ? "replied" : "commented",
          comment.createdAt,
          comment.parentId ? "on a memo thread" : undefined,
        );

        if (comment.updatedAt.getTime() > comment.createdAt.getTime()) {
          pushActivity(
            `comment-edited-${comment.id}`,
            comment.authorId,
            "edited_comment",
            comment.updatedAt,
          );
        }

        comment.commentReactions.forEach((reaction) => {
          pushActivity(
            `comment-reacted-${reaction.id}`,
            reaction.userId,
            "reacted",
            reaction.createdAt,
            `with ${reaction.emoji} on a comment`,
          );
        });
      });

      memo.reactions.forEach((reaction) => {
        pushActivity(
          `memo-reacted-${reaction.id}`,
          reaction.userId,
          "reacted",
          reaction.createdAt,
          `with ${reaction.emoji}`,
        );
      });

      (activityLogsByMemo.get(memo.id) || []).forEach((log) => {
        if (log.resourceType === "memo" && log.action === "delete") {
          pushActivity(`audit-delete-${log.id}`, log.userId, "deleted", log.createdAt);
        }
        if (log.resourceType === "memo" && log.action === "update") {
          pushActivity(`audit-update-${log.id}`, log.userId, "updated", log.createdAt);
        }
      });

      derivedActivityLog.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      return {
        id: memo.id,
        title: memo.title,
        body: memo.body,
        creatorId: memo.creatorId,
        visibility: memo.visibility,
        status: memo.status,
        recipientIds: memo.recipients.map((recipient) => recipient.userId),
        recipientStatuses: memo.recipients.map((recipient) => ({
          userId: recipient.userId,
          opened: recipient.opened,
          openedAt: recipient.openedAt?.toISOString(),
          acknowledged: recipient.acknowledged,
          acknowledgedAt: recipient.acknowledgedAt?.toISOString(),
          approved: recipient.approved,
          approvedAt: recipient.approvedAt?.toISOString(),
          replied: recipient.replied,
          repliedAt: recipient.repliedAt?.toISOString(),
          repliedComment: resolveReplyCommentForRecipient(
            {
              userId: recipient.userId,
              replied: recipient.replied,
              repliedAt: recipient.repliedAt,
            },
            memo.comments,
          ),
        })),
        groupId: memo.groupId || undefined,
        tags: memo.tags.map((tag) => tag.tag.name),
        attachments: memo.attachments.map((attachment) => ({
          id: attachment.id,
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          url: attachment.url,
          thumbnailUrl: attachment.type.startsWith("image/")
            ? attachment.url
            : undefined,
        })),
        reactions: aggregateMemoReactions(
          memo.reactions.map((reaction) => ({
            emoji: reaction.emoji,
            userId: reaction.userId,
          })),
        ),
        pinned: memo.pinned,
        archived: memo.archived,
        referencedMemoIds: toStringArray(memo.referencedMemoIds),
        editHistory: memo.editHistory.map((entry) => ({
          id: entry.id,
          editedAt: entry.createdAt.toISOString(),
          editedBy: entry.editedBy,
          changes: [
            {
              field: "body",
              oldValue: entry.oldBody,
              newValue: entry.newBody,
            },
          ],
        })),
        activityLog: derivedActivityLog,
        hiddenBy: toStringArray(memo.hiddenBy),
        starredBy: toStringArray(memo.starredBy),
        workflow:
          memo.workflow && typeof memo.workflow === "object"
            ? memo.workflow
            : undefined,
        previousStatus: memo.previousStatus || undefined,
        createdAt: memo.createdAt.toISOString(),
        updatedAt: memo.updatedAt.toISOString(),
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        role: user.role,
      })),
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        type: group.type,
        memberIds: group.members.map((member) => member.userId),
      })),
      memos,
    };
  }
}
