// ===== USER =====
export interface User {
  id: string;
  name: string;
  email: string;
  bio?: string;
  avatar: string;
  role: "super_admin" | "admin" | "manager" | "group_leader" | "member";
  assignedRoleKey?: string;
  assignedRoleName?: string;
  baseRole?: "super_admin" | "admin" | "manager" | "group_leader" | "member";
  department: string;
  status: "online" | "away" | "offline";
  isBlocked?: boolean;
  createdAt: string;
  twoFactorEnabled?: boolean;
  sessionTimeoutMinutes?: number;
}

// ===== MEMO =====
export type MemoVisibility = "public" | "private" | "protected";
export type MemoStatus = "draft" | "sent" | "pinned" | "archived" | "deleted";

export interface MemoRecipientStatus {
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
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
}

export interface Reaction {
  emoji: string;
  users: string[]; // user IDs
}

export interface MemoEditEntry {
  id: string;
  editedAt: string;
  editedBy: string;
  changes: {
    field: string;
    oldValue: string;
    newValue: string;
  }[];
}

export interface MemoActivityEntry {
  id: string;
  userId: string;
  action:
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
  timestamp: string;
  detail?: string;
}

// ===== WORKFLOW / APPROVAL CHAIN =====
export interface ApprovalStep {
  id: string;
  approverId: string;
  order: number; // 1-based step order
  status: "pending" | "approved" | "rejected";
  decidedAt?: string;
  comment?: string;
}

export interface WorkflowConfig {
  enabled: boolean;
  approvalChain: ApprovalStep[];
  escalation?: {
    enabled: boolean;
    hoursUntilEscalation: number; // hours before auto-escalation
    escalateToUserId?: string; // who to notify on escalation
    escalatedAt?: string;
    escalatedStepId?: string;
  };
  scheduledSendAt?: string; // ISO string for delayed delivery
  sentBySchedule?: boolean; // true if auto-sent by scheduler
}

export interface Memo {
  id: string;
  slug?: string;
  title: string;
  body: string;
  creatorId: string;
  visibility: MemoVisibility;
  status: MemoStatus;
  recipientIds: string[];
  recipientStatuses: MemoRecipientStatus[];
  groupId?: string;
  tags: string[];
  attachments: Attachment[];
  reactions: Reaction[];
  pinned: boolean;
  archived: boolean;
  referencedMemoIds: string[];
  editHistory: MemoEditEntry[];
  activityLog: MemoActivityEntry[];
  hiddenBy?: string[];
  starredBy?: string[];
  workflow?: WorkflowConfig;
  previousStatus?: string;
  createdAt: string;
  updatedAt: string;
}

// ===== COMMENT =====
export interface Comment {
  id: string;
  memoId: string;
  authorId: string;
  body: string;
  parentId?: string; // for threaded replies
  pinned?: boolean;
  pinnedBy?: string;
  attachments: Attachment[];
  reactions: Reaction[];
  referencedMemoIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ===== GROUP =====
export interface GroupInvite {
  id?: string;
  userId: string;
  status: "pending" | "accepted" | "declined";
  invitedAt: string;
  respondedAt?: string;
}

export interface GroupFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
  source: "memo" | "chat" | "upload";
}

export interface Group {
  id: string;
  name: string;
  description: string;
  type: "department" | "project" | "custom";
  memberIds: string[];
  adminIds: string[];
  pendingInvites: GroupInvite[];
  files: GroupFile[];
  avatar: string;
  createdAt: string;
}

// ===== MESSAGING =====
export interface MessageReaction {
  emoji: string;
  users: string[];
}

export interface SharedMemo {
  memoId: string;
  title: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  attachments: Attachment[];
  reactions: MessageReaction[];
  sharedMemo?: SharedMemo;
  readBy: string[];
  isSystem?: boolean; // system notifications like "user joined"
  isEdited?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  clientOnly?: boolean;
  starred?: boolean;
  starredBy?: string[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: "direct" | "group";
  participantIds: string[];
  name?: string;
  groupId?: string; // link to a group
  messageCount?: number;
  lastMessage?: Message;
  typingUsers?: string[];
  updatedAt: string;
}

// ===== REMINDER =====
export interface Reminder {
  id: string;
  title: string;
  description?: string;
  userId: string;
  creatorName?: string;
  groupId?: string; // if set, this is a group reminder
  groupName?: string;
  groupType?: string;
  visibility?: "personal" | "group" | "public";
  dueAt: string;
  fired: boolean;
  firedAt?: string;
  createdAt: string;
}

// ===== NOTIFICATION =====
export type NotificationType =
  | "memo_received"
  | "memo_approved"
  | "memo_rejected"
  | "comment_added"
  | "reaction_added"
  | "message_received"
  | "mention"
  | "group_invite"
  | "group_activity"
  | "reminder"
  | "starred_activity"
  | "workflow_pending_approval";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

// ===== TAG =====
export interface Tag {
  id: string;
  name: string;
  category: string;
  color: string;
}

export interface TagCategory {
  id: string;
  name: string;
}
