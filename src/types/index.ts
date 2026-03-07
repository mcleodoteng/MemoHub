// ===== USER =====
export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'admin' | 'manager' | 'member';
  department: string;
  status: 'online' | 'away' | 'offline';
  createdAt: string;
}

// ===== MEMO =====
export type MemoVisibility = 'public' | 'private' | 'protected';
export type MemoStatus = 'draft' | 'sent' | 'pinned' | 'archived' | 'deleted';

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

export interface Memo {
  id: string;
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
  createdAt: string;
  updatedAt: string;
}

// ===== COMMENT =====
export interface Comment {
  id: string;
  memoId: string;
  authorId: string;
  body: string;
  attachments: Attachment[];
  reactions: Reaction[];
  referencedMemoIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ===== GROUP =====
export interface Group {
  id: string;
  name: string;
  description: string;
  type: 'department' | 'project' | 'custom';
  memberIds: string[];
  adminIds: string[];
  avatar: string;
  createdAt: string;
}

// ===== MESSAGING =====
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  attachments: Attachment[];
  readBy: string[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  participantIds: string[];
  name?: string;
  lastMessage?: Message;
  updatedAt: string;
}

// ===== NOTIFICATION =====
export type NotificationType = 'memo_received' | 'memo_approved' | 'comment_added' | 'reaction_added' | 'message_received' | 'mention' | 'group_invite';

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
