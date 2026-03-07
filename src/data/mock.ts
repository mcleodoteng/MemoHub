import type { User, Memo, Comment, Group, Conversation, Message, Notification, Tag, TagCategory } from '@/types';

// ===== USERS =====
export const currentUser: User = {
  id: 'u1',
  name: 'Alex Johnson',
  email: 'alex@memohub.com',
  avatar: '',
  role: 'admin',
  department: 'Engineering',
  status: 'online',
  createdAt: '2024-01-15T08:00:00Z',
};

export const users: User[] = [
  currentUser,
  { id: 'u2', name: 'Sarah Chen', email: 'sarah@memohub.com', avatar: '', role: 'manager', department: 'Design', status: 'online', createdAt: '2024-02-01T08:00:00Z' },
  { id: 'u3', name: 'Marcus Williams', email: 'marcus@memohub.com', avatar: '', role: 'member', department: 'Engineering', status: 'away', createdAt: '2024-02-10T08:00:00Z' },
  { id: 'u4', name: 'Priya Patel', email: 'priya@memohub.com', avatar: '', role: 'manager', department: 'Marketing', status: 'online', createdAt: '2024-03-01T08:00:00Z' },
  { id: 'u5', name: 'James Lee', email: 'james@memohub.com', avatar: '', role: 'member', department: 'Engineering', status: 'offline', createdAt: '2024-03-15T08:00:00Z' },
  { id: 'u6', name: 'Emily Torres', email: 'emily@memohub.com', avatar: '', role: 'member', department: 'HR', status: 'online', createdAt: '2024-04-01T08:00:00Z' },
  { id: 'u7', name: 'David Kim', email: 'david@memohub.com', avatar: '', role: 'member', department: 'Finance', status: 'away', createdAt: '2024-04-10T08:00:00Z' },
  { id: 'u8', name: 'Olivia Brown', email: 'olivia@memohub.com', avatar: '', role: 'member', department: 'Design', status: 'online', createdAt: '2024-05-01T08:00:00Z' },
];

export const getUserById = (id: string) => users.find(u => u.id === id);
export const getUserInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

// ===== TAG CATEGORIES =====
export const tagCategories: TagCategory[] = [
  { id: 'tc1', name: 'Priority' },
  { id: 'tc2', name: 'Department' },
  { id: 'tc3', name: 'Type' },
];

export const tags: Tag[] = [
  { id: 't1', name: 'Urgent', category: 'Priority', color: 'hsl(0, 72%, 51%)' },
  { id: 't2', name: 'High', category: 'Priority', color: 'hsl(38, 92%, 50%)' },
  { id: 't3', name: 'Normal', category: 'Priority', color: 'hsl(205, 85%, 50%)' },
  { id: 't4', name: 'Low', category: 'Priority', color: 'hsl(152, 60%, 40%)' },
  { id: 't5', name: 'Engineering', category: 'Department', color: 'hsl(243, 75%, 59%)' },
  { id: 't6', name: 'Design', category: 'Department', color: 'hsl(280, 60%, 55%)' },
  { id: 't7', name: 'Marketing', category: 'Department', color: 'hsl(167, 72%, 40%)' },
  { id: 't8', name: 'Announcement', category: 'Type', color: 'hsl(243, 75%, 59%)' },
  { id: 't9', name: 'Policy', category: 'Type', color: 'hsl(220, 10%, 46%)' },
  { id: 't10', name: 'Request', category: 'Type', color: 'hsl(38, 92%, 50%)' },
];

// ===== MEMOS =====
export const memos: Memo[] = [
  {
    id: 'm1',
    title: 'Q1 Engineering Sprint Planning',
    body: 'Team, please review the sprint goals for Q1. We will focus on the new dashboard features and API optimizations. All team leads should prepare their capacity reports by Friday.',
    creatorId: 'u1',
    visibility: 'public',
    status: 'sent',
    recipientIds: ['u2', 'u3', 'u5'],
    recipientStatuses: [
      { userId: 'u2', opened: true, openedAt: '2024-12-01T09:00:00Z', acknowledged: true, acknowledgedAt: '2024-12-01T10:00:00Z', approved: true, approvedAt: '2024-12-01T11:00:00Z', replied: true, repliedAt: '2024-12-01T12:00:00Z' },
      { userId: 'u3', opened: true, openedAt: '2024-12-01T09:30:00Z', acknowledged: true, acknowledgedAt: '2024-12-01T10:30:00Z', approved: false, replied: false },
      { userId: 'u5', opened: true, openedAt: '2024-12-02T08:00:00Z', acknowledged: false, approved: false, replied: false },
    ],
    tags: ['Urgent', 'Engineering'],
    attachments: [{ id: 'a1', name: 'sprint-plan.pdf', type: 'application/pdf', size: 245000, url: '#' }],
    reactions: [{ emoji: '👍', users: ['u2', 'u3'] }, { emoji: '🚀', users: ['u5'] }],
    pinned: true,
    archived: false,
    referencedMemoIds: [],
    editHistory: [],
    activityLog: [],
    createdAt: '2024-12-01T08:00:00Z',
    updatedAt: '2024-12-01T08:00:00Z',
  },
  {
    id: 'm2',
    title: 'New Design System Guidelines',
    body: 'The updated design system documentation is now available. Please review the new component library and color palette changes. All new features should follow these guidelines.',
    creatorId: 'u2',
    visibility: 'public',
    status: 'sent',
    recipientIds: ['u1', 'u3', 'u8'],
    recipientStatuses: [
      { userId: 'u1', opened: true, openedAt: '2024-12-02T09:00:00Z', acknowledged: true, acknowledgedAt: '2024-12-02T10:00:00Z', approved: true, approvedAt: '2024-12-02T14:00:00Z', replied: false },
      { userId: 'u3', opened: true, openedAt: '2024-12-02T11:00:00Z', acknowledged: false, approved: false, replied: false },
      { userId: 'u8', opened: false, acknowledged: false, approved: false, replied: false },
    ],
    tags: ['Design', 'Announcement'],
    attachments: [{ id: 'a2', name: 'design-system-v2.fig', type: 'application/figma', size: 1200000, url: '#' }],
    reactions: [{ emoji: '❤️', users: ['u1', 'u8'] }],
    pinned: false,
    archived: false,
    referencedMemoIds: [],
    editHistory: [],
    activityLog: [],
    createdAt: '2024-12-02T08:00:00Z',
    updatedAt: '2024-12-02T08:00:00Z',
  },
  {
    id: 'm3',
    title: 'Budget Approval for Marketing Campaign',
    body: 'Requesting approval for the Q1 marketing campaign budget. Total estimated cost: $45,000. Please review the attached breakdown and provide your approval.',
    creatorId: 'u4',
    visibility: 'private',
    status: 'sent',
    recipientIds: ['u1', 'u7'],
    recipientStatuses: [
      { userId: 'u1', opened: true, openedAt: '2024-12-03T10:00:00Z', acknowledged: true, acknowledgedAt: '2024-12-03T11:00:00Z', approved: false, replied: false },
      { userId: 'u7', opened: false, acknowledged: false, approved: false, replied: false },
    ],
    tags: ['High', 'Marketing', 'Request'],
    attachments: [{ id: 'a3', name: 'budget-breakdown.xlsx', type: 'application/excel', size: 89000, url: '#' }],
    reactions: [],
    pinned: false,
    archived: false,
    referencedMemoIds: [],
    editHistory: [],
    activityLog: [],
    createdAt: '2024-12-03T09:00:00Z',
    updatedAt: '2024-12-03T09:00:00Z',
  },
  {
    id: 'm4',
    title: 'HR Policy Update: Remote Work',
    body: 'We are updating our remote work policy effective January 1st. Key changes include flexible hours and home office stipend. All employees must acknowledge this memo.',
    creatorId: 'u6',
    visibility: 'public',
    status: 'sent',
    recipientIds: ['u1', 'u2', 'u3', 'u4', 'u5', 'u7', 'u8'],
    recipientStatuses: [
      { userId: 'u1', opened: true, openedAt: '2024-12-04T08:30:00Z', acknowledged: true, acknowledgedAt: '2024-12-04T09:00:00Z', approved: true, approvedAt: '2024-12-04T09:30:00Z', replied: true, repliedAt: '2024-12-04T10:00:00Z' },
      { userId: 'u2', opened: true, openedAt: '2024-12-04T09:00:00Z', acknowledged: true, acknowledgedAt: '2024-12-04T10:00:00Z', approved: false, replied: false },
      { userId: 'u3', opened: false, acknowledged: false, approved: false, replied: false },
      { userId: 'u4', opened: true, openedAt: '2024-12-04T11:00:00Z', acknowledged: false, approved: false, replied: false },
      { userId: 'u5', opened: false, acknowledged: false, approved: false, replied: false },
      { userId: 'u7', opened: false, acknowledged: false, approved: false, replied: false },
      { userId: 'u8', opened: true, openedAt: '2024-12-04T14:00:00Z', acknowledged: true, acknowledgedAt: '2024-12-04T15:00:00Z', approved: true, approvedAt: '2024-12-04T16:00:00Z', replied: false },
    ],
    tags: ['Announcement', 'Policy'],
    attachments: [{ id: 'a4', name: 'remote-work-policy.pdf', type: 'application/pdf', size: 320000, url: '#' }],
    reactions: [{ emoji: '🎉', users: ['u1', 'u2', 'u5', 'u8'] }, { emoji: '👏', users: ['u3'] }],
    pinned: true,
    archived: false,
    referencedMemoIds: [],
    editHistory: [
      {
        id: 'eh1',
        editedAt: '2024-12-04T12:00:00Z',
        editedBy: 'u6',
        changes: [
          { field: 'body', oldValue: 'We are updating our remote work policy.', newValue: 'We are updating our remote work policy effective January 1st. Key changes include flexible hours and home office stipend. All employees must acknowledge this memo.' },
        ],
      },
    ],
    activityLog: [],
    createdAt: '2024-12-04T08:00:00Z',
    updatedAt: '2024-12-04T12:00:00Z',
  },
  {
    id: 'm5',
    title: 'Confidential: Performance Review Criteria',
    body: 'Managers only — here are the updated performance review criteria for 2025. This is protected information and should not be shared broadly.',
    creatorId: 'u1',
    visibility: 'protected',
    status: 'sent',
    recipientIds: ['u2', 'u4'],
    recipientStatuses: [
      { userId: 'u2', opened: true, openedAt: '2024-12-05T09:00:00Z', acknowledged: true, acknowledgedAt: '2024-12-05T10:00:00Z', approved: true, approvedAt: '2024-12-05T11:00:00Z', replied: true, repliedAt: '2024-12-05T12:00:00Z' },
      { userId: 'u4', opened: true, openedAt: '2024-12-05T10:00:00Z', acknowledged: true, acknowledgedAt: '2024-12-05T11:00:00Z', approved: false, replied: false },
    ],
    tags: ['High', 'Policy'],
    attachments: [],
    reactions: [{ emoji: '👍', users: ['u2'] }],
    pinned: false,
    archived: false,
    referencedMemoIds: ['m4'],
    editHistory: [],
    activityLog: [],
    createdAt: '2024-12-05T08:00:00Z',
    updatedAt: '2024-12-05T08:00:00Z',
  },
];

export const getMemoById = (id: string) => memos.find(m => m.id === id);

// ===== COMMENTS =====
export const comments: Comment[] = [
  { id: 'c1', memoId: 'm1', authorId: 'u2', body: 'Looks great! I\'ll have the design capacity report ready by Thursday.', attachments: [], reactions: [{ emoji: '👍', users: ['u1'] }], referencedMemoIds: [], createdAt: '2024-12-01T12:00:00Z', updatedAt: '2024-12-01T12:00:00Z' },
  { id: 'c2', memoId: 'm1', authorId: 'u3', body: 'Can we also include the backend refactoring tasks?', attachments: [], reactions: [], referencedMemoIds: [], createdAt: '2024-12-01T13:00:00Z', updatedAt: '2024-12-01T13:00:00Z' },
  { id: 'c3', memoId: 'm4', authorId: 'u1', body: 'Great update! The home office stipend is a welcome addition. Ref: previous discussion in the engineering memo.', attachments: [], reactions: [{ emoji: '❤️', users: ['u6'] }], referencedMemoIds: ['m1'], createdAt: '2024-12-04T10:00:00Z', updatedAt: '2024-12-04T10:00:00Z' },
  { id: 'c4', memoId: 'm5', authorId: 'u2', body: 'I suggest we add a section on peer feedback. Happy to help draft this.', attachments: [], reactions: [], referencedMemoIds: [], createdAt: '2024-12-05T12:00:00Z', updatedAt: '2024-12-05T12:00:00Z' },
];

// ===== GROUPS =====
export const groups: Group[] = [
  { id: 'g1', name: 'Engineering', description: 'All engineering team members', type: 'department', memberIds: ['u1', 'u3', 'u5'], adminIds: ['u1'], pendingInvites: [], files: [], avatar: '', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'g2', name: 'Design', description: 'Design and UX team', type: 'department', memberIds: ['u2', 'u8'], adminIds: ['u2'], pendingInvites: [], files: [], avatar: '', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'g3', name: 'Leadership', description: 'Company leadership team', type: 'custom', memberIds: ['u1', 'u2', 'u4', 'u6'], adminIds: ['u1'], pendingInvites: [], files: [], avatar: '', createdAt: '2024-02-01T00:00:00Z' },
  { id: 'g4', name: 'Project Alpha', description: 'Cross-functional project team', type: 'project', memberIds: ['u1', 'u2', 'u3', 'u4'], adminIds: ['u1', 'u2'], pendingInvites: [], files: [], avatar: '', createdAt: '2024-06-01T00:00:00Z' },
];

// ===== CONVERSATIONS =====
export const conversations: Conversation[] = [
  { id: 'conv1', type: 'direct', participantIds: ['u1', 'u2'], lastMessage: { id: 'msg3', conversationId: 'conv1', senderId: 'u2', body: 'Sure, I\'ll send the mockups over!', attachments: [], reactions: [], readBy: ['u2'], createdAt: '2024-12-05T14:30:00Z' }, updatedAt: '2024-12-05T14:30:00Z' },
  { id: 'conv2', type: 'direct', participantIds: ['u1', 'u3'], lastMessage: { id: 'msg5', conversationId: 'conv2', senderId: 'u3', body: 'The API changes are deployed to staging', attachments: [], reactions: [], readBy: ['u3'], createdAt: '2024-12-05T13:00:00Z' }, updatedAt: '2024-12-05T13:00:00Z' },
  { id: 'conv3', type: 'group', participantIds: ['u1', 'u2', 'u3', 'u5'], name: 'Engineering Chat', lastMessage: { id: 'msg8', conversationId: 'conv3', senderId: 'u5', body: 'Has anyone tested the new build?', attachments: [], reactions: [], readBy: ['u5'], createdAt: '2024-12-05T15:00:00Z' }, updatedAt: '2024-12-05T15:00:00Z' },
];

export const messages: Message[] = [
  { id: 'msg1', conversationId: 'conv1', senderId: 'u1', body: 'Hey Sarah, did you get a chance to look at the new components?', attachments: [], reactions: [{ emoji: '👍', users: ['u2'] }], readBy: ['u1', 'u2'], createdAt: '2024-12-05T14:00:00Z' },
  { id: 'msg2', conversationId: 'conv1', senderId: 'u2', body: 'Yes! They look fantastic. A few tweaks needed on the spacing.', attachments: [], reactions: [], readBy: ['u1', 'u2'], createdAt: '2024-12-05T14:15:00Z' },
  { id: 'msg3', conversationId: 'conv1', senderId: 'u2', body: 'Sure, I\'ll send the mockups over!', attachments: [], reactions: [], readBy: ['u2'], createdAt: '2024-12-05T14:30:00Z' },
  { id: 'msg4', conversationId: 'conv2', senderId: 'u1', body: 'Marcus, how\'s the API refactoring going?', attachments: [], reactions: [], readBy: ['u1', 'u3'], createdAt: '2024-12-05T12:00:00Z' },
  { id: 'msg5', conversationId: 'conv2', senderId: 'u3', body: 'The API changes are deployed to staging', attachments: [], reactions: [{ emoji: '🚀', users: ['u1'] }], readBy: ['u3'], createdAt: '2024-12-05T13:00:00Z' },
  { id: 'msg6', conversationId: 'conv3', senderId: 'u1', body: 'Team, let\'s sync on the sprint progress', attachments: [], reactions: [], readBy: ['u1', 'u2', 'u3', 'u5'], createdAt: '2024-12-05T14:00:00Z' },
  { id: 'msg7', conversationId: 'conv3', senderId: 'u3', body: 'I\'ve completed the database migration task', attachments: [], reactions: [{ emoji: '🎉', users: ['u1', 'u5'] }], readBy: ['u1', 'u3', 'u5'], createdAt: '2024-12-05T14:45:00Z' },
  { id: 'msg8', conversationId: 'conv3', senderId: 'u5', body: 'Has anyone tested the new build?', attachments: [], reactions: [], readBy: ['u5'], createdAt: '2024-12-05T15:00:00Z' },
];

// ===== NOTIFICATIONS =====
export const notifications: Notification[] = [
  { id: 'n1', userId: 'u1', type: 'memo_received', title: 'New Memo', body: 'Sarah Chen sent you a memo: New Design System Guidelines', read: false, actionUrl: '/memos/m2', createdAt: '2024-12-05T09:00:00Z' },
  { id: 'n2', userId: 'u1', type: 'comment_added', title: 'New Comment', body: 'Marcus Williams commented on: Q1 Engineering Sprint Planning', read: false, actionUrl: '/memos/m1', createdAt: '2024-12-05T13:00:00Z' },
  { id: 'n3', userId: 'u1', type: 'memo_approved', title: 'Memo Approved', body: 'Sarah Chen approved: Confidential: Performance Review Criteria', read: true, actionUrl: '/memos/m5', createdAt: '2024-12-05T11:00:00Z' },
  { id: 'n4', userId: 'u1', type: 'message_received', title: 'New Message', body: 'Sarah Chen: Sure, I\'ll send the mockups over!', read: false, actionUrl: '/messages/conv1', createdAt: '2024-12-05T14:30:00Z' },
  { id: 'n5', userId: 'u1', type: 'reaction_added', title: 'New Reaction', body: 'Emily Torres reacted ❤️ to your comment', read: true, actionUrl: '/memos/m4', createdAt: '2024-12-04T10:30:00Z' },
  { id: 'n6', userId: 'u1', type: 'mention', title: 'You were mentioned', body: 'Priya Patel mentioned you in Budget Approval for Marketing Campaign', read: false, actionUrl: '/memos/m3', createdAt: '2024-12-05T15:00:00Z' },
];
