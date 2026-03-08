import React, { createContext, useContext, useState, useCallback } from 'react';
import { Memo, Comment, MemoVisibility, MemoEditEntry, Attachment, ApprovalStep, WorkflowConfig } from '@/types';
import { memos as initialMemos, comments as initialComments, currentUser } from '@/data/mock';

interface MemoContextType {
  memos: Memo[];
  comments: Comment[];
  addMemo: (memo: Omit<Memo, 'id' | 'createdAt' | 'updatedAt' | 'recipientStatuses' | 'reactions' | 'editHistory' | 'hiddenBy' | 'activityLog'>) => Memo;
  updateMemo: (id: string, updates: Partial<Memo>) => void;
  editMemo: (id: string, updates: { title?: string; body?: string; tags?: string[]; visibility?: MemoVisibility; attachments?: Attachment[]; recipientIds?: string[]; referencedMemoIds?: string[] }, editorId: string) => void;
  deleteMemo: (id: string) => void;
  permanentlyDeleteMemo: (id: string) => void;
  restoreMemo: (id: string) => void;
  togglePin: (id: string) => void;
  toggleArchive: (id: string) => void;
  toggleStar: (memoId: string, userId: string) => void;
  hideMemo: (memoId: string, userId: string) => void;
  acknowledgeMemo: (memoId: string, userId: string) => void;
  unacknowledgeMemo: (memoId: string, userId: string) => void;
  approveMemo: (memoId: string, userId: string) => void;
  unapproveMemo: (memoId: string, userId: string) => void;
  markOpened: (memoId: string, userId: string) => void;
  addComment: (memoId: string, body: string, authorId: string, attachments?: Attachment[], parentId?: string) => void;
  editComment: (commentId: string, newBody: string, userId: string) => void;
  deleteComment: (commentId: string, userId: string) => void;
  toggleCommentPin: (commentId: string, userId: string) => void;
  addCommentReaction: (commentId: string, emoji: string, userId: string) => void;
  addReaction: (memoId: string, emoji: string, userId: string) => void;
  approveWorkflowStep: (memoId: string, stepId: string, userId: string, approved: boolean, comment?: string) => void;
  checkEscalations: () => void;
  checkScheduledMemos: () => void;
  getMemoById: (id: string) => Memo | undefined;
  getCommentsByMemoId: (memoId: string) => Comment[];
}

const MemoContext = createContext<MemoContextType | undefined>(undefined);

export function MemoProvider({ children }: { children: React.ReactNode }) {
  const [memos, setMemos] = useState<Memo[]>(initialMemos.map(m => ({ ...m, hiddenBy: m.hiddenBy || [], activityLog: m.activityLog || [] })));
  const [comments, setComments] = useState<Comment[]>(initialComments);

  const getMemoById = useCallback((id: string) => memos.find(m => m.id === id), [memos]);
  const getCommentsByMemoId = useCallback((memoId: string) => comments.filter(c => c.memoId === memoId), [comments]);

  const addMemo = useCallback((memoData: Omit<Memo, 'id' | 'createdAt' | 'updatedAt' | 'recipientStatuses' | 'reactions' | 'editHistory' | 'hiddenBy' | 'activityLog'>) => {
    const now = new Date().toISOString();
    const newMemo: Memo = {
      ...memoData,
      id: `m${Date.now()}`,
      reactions: [],
      editHistory: [],
      activityLog: [],
      hiddenBy: [],
      recipientStatuses: memoData.recipientIds.map(userId => ({
        userId,
        opened: false,
        acknowledged: false,
        approved: false,
        replied: false,
      })),
      createdAt: now,
      updatedAt: now,
    };
    setMemos(prev => [newMemo, ...prev]);
    return newMemo;
  }, []);

  const updateMemo = useCallback((id: string, updates: Partial<Memo>) => {
    setMemos(prev => prev.map(m => m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m));
  }, []);

  const editMemo = useCallback((id: string, updates: { title?: string; body?: string; tags?: string[]; visibility?: MemoVisibility; attachments?: Attachment[]; recipientIds?: string[]; referencedMemoIds?: string[] }, editorId: string) => {
    setMemos(prev => prev.map(m => {
      if (m.id !== id || m.creatorId !== editorId) return m;
      const now = new Date().toISOString();
      const changes: MemoEditEntry['changes'] = [];
      if (updates.title !== undefined && updates.title !== m.title) {
        changes.push({ field: 'title', oldValue: m.title, newValue: updates.title });
      }
      if (updates.body !== undefined && updates.body !== m.body) {
        changes.push({ field: 'body', oldValue: m.body, newValue: updates.body });
      }
      if (updates.tags !== undefined && JSON.stringify(updates.tags) !== JSON.stringify(m.tags)) {
        changes.push({ field: 'tags', oldValue: m.tags.join(', '), newValue: updates.tags.join(', ') });
      }
      if (updates.visibility !== undefined && updates.visibility !== m.visibility) {
        changes.push({ field: 'visibility', oldValue: m.visibility, newValue: updates.visibility });
      }
      if (updates.attachments !== undefined) {
        changes.push({ field: 'attachments', oldValue: `${m.attachments.length} files`, newValue: `${updates.attachments.length} files` });
      }
      if (updates.recipientIds !== undefined && JSON.stringify(updates.recipientIds) !== JSON.stringify(m.recipientIds)) {
        changes.push({ field: 'recipients', oldValue: `${m.recipientIds.length} recipients`, newValue: `${updates.recipientIds.length} recipients` });
      }
      if (changes.length === 0) return m;
      const entry: MemoEditEntry = { id: `eh${Date.now()}`, editedAt: now, editedBy: editorId, changes };
      return {
        ...m,
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.body !== undefined && { body: updates.body }),
        ...(updates.tags !== undefined && { tags: updates.tags }),
        ...(updates.visibility !== undefined && { visibility: updates.visibility }),
        ...(updates.attachments !== undefined && { attachments: updates.attachments }),
        ...(updates.recipientIds !== undefined && {
          recipientIds: updates.recipientIds,
          recipientStatuses: updates.recipientIds.map(uid => {
            const existing = m.recipientStatuses.find(s => s.userId === uid);
            return existing || { userId: uid, opened: false, acknowledged: false, approved: false, replied: false };
          }),
        }),
        ...(updates.referencedMemoIds !== undefined && { referencedMemoIds: updates.referencedMemoIds }),
        editHistory: [...m.editHistory, entry],
        updatedAt: now,
      };
    }));
  }, []);

  const deleteMemo = useCallback((id: string) => {
    setMemos(prev => prev.map(m => {
      if (m.id !== id) return m;
      if (m.creatorId !== currentUser.id) return m;
      return { ...m, status: 'deleted' as const, deletedBy: currentUser.id, deletedAt: new Date().toISOString() };
    }));
  }, []);

  const permanentlyDeleteMemo = useCallback((id: string) => {
    setMemos(prev => prev.filter(m => {
      if (m.id !== id) return true;
      if ((m as any).deletedBy !== currentUser.id) return true;
      return false;
    }));
  }, []);

  const restoreMemo = useCallback((id: string) => {
    setMemos(prev => prev.map(m => {
      if (m.id !== id) return m;
      // Only the person who deleted can restore
      if ((m as any).deletedBy !== currentUser.id) return m;
      const { deletedBy, deletedAt, ...rest } = m as any;
      return { ...rest, status: 'sent' as const };
    }));
  }, []);

  const togglePin = useCallback((id: string) => {
    setMemos(prev => prev.map(m => m.id === id ? { ...m, pinned: !m.pinned } : m));
  }, []);

  const toggleArchive = useCallback((id: string) => {
    setMemos(prev => prev.map(m => m.id === id ? { ...m, archived: !m.archived } : m));
  }, []);

  const toggleStar = useCallback((memoId: string, userId: string) => {
    setMemos(prev => prev.map(m => {
      if (m.id !== memoId) return m;
      const starred = m.starredBy || [];
      if (starred.includes(userId)) {
        return { ...m, starredBy: starred.filter(id => id !== userId) };
      }
      return { ...m, starredBy: [...starred, userId] };
    }));
  }, []);

  const hideMemo = useCallback((memoId: string, userId: string) => {
    setMemos(prev => prev.map(m => {
      if (m.id !== memoId) return m;
      const hidden = m.hiddenBy || [];
      if (hidden.includes(userId)) {
        return { ...m, hiddenBy: hidden.filter(id => id !== userId) };
      }
      return { ...m, hiddenBy: [...hidden, userId] };
    }));
  }, []);

  const markOpened = useCallback((memoId: string, userId: string) => {
    setMemos(prev => prev.map(m => {
      if (m.id !== memoId) return m;
      const status = m.recipientStatuses.find(s => s.userId === userId);
      if (!status || status.opened) return m;
      const now = new Date().toISOString();
      const entry: import('@/types').MemoActivityEntry = { id: `al${Date.now()}`, userId, action: 'opened', timestamp: now };
      return {
        ...m,
        recipientStatuses: m.recipientStatuses.map(s =>
          s.userId === userId ? { ...s, opened: true, openedAt: now, acknowledged: true, acknowledgedAt: now } : s
        ),
        activityLog: [...m.activityLog, entry, { id: `al${Date.now()}a`, userId, action: 'acknowledged' as const, timestamp: now, detail: 'Auto-acknowledged on open' }],
      };
    }));
  }, []);

  const acknowledgeMemo = useCallback((memoId: string, userId: string) => {
    setMemos(prev => prev.map(m => {
      if (m.id !== memoId) return m;
      const now = new Date().toISOString();
      const entry: import('@/types').MemoActivityEntry = { id: `al${Date.now()}`, userId, action: 'acknowledged', timestamp: now };
      return {
        ...m,
        recipientStatuses: m.recipientStatuses.map(s =>
          s.userId === userId ? { ...s, opened: true, openedAt: s.openedAt || now, acknowledged: true, acknowledgedAt: now } : s
        ),
        activityLog: [...m.activityLog, entry],
      };
    }));
  }, []);

  const unacknowledgeMemo = useCallback((memoId: string, userId: string) => {
    setMemos(prev => prev.map(m => {
      if (m.id !== memoId) return m;
      const now = new Date().toISOString();
      const entry: import('@/types').MemoActivityEntry = { id: `al${Date.now()}`, userId, action: 'unacknowledged', timestamp: now };
      return {
        ...m,
        recipientStatuses: m.recipientStatuses.map(s =>
          s.userId === userId ? { ...s, acknowledged: false, acknowledgedAt: undefined } : s
        ),
        activityLog: [...m.activityLog, entry],
      };
    }));
  }, []);

  const approveMemo = useCallback((memoId: string, userId: string) => {
    setMemos(prev => prev.map(m => {
      if (m.id !== memoId) return m;
      const now = new Date().toISOString();
      const entry: import('@/types').MemoActivityEntry = { id: `al${Date.now()}`, userId, action: 'approved', timestamp: now };
      return {
        ...m,
        recipientStatuses: m.recipientStatuses.map(s =>
          s.userId === userId ? {
            ...s,
            opened: true,
            openedAt: s.openedAt || now,
            acknowledged: true,
            acknowledgedAt: s.acknowledgedAt || now,
            approved: true,
            approvedAt: now,
          } : s
        ),
        activityLog: [...m.activityLog, entry],
      };
    }));
  }, []);

  const unapproveMemo = useCallback((memoId: string, userId: string) => {
    setMemos(prev => prev.map(m => {
      if (m.id !== memoId) return m;
      const now = new Date().toISOString();
      const entry: import('@/types').MemoActivityEntry = { id: `al${Date.now()}`, userId, action: 'unapproved', timestamp: now };
      return {
        ...m,
        recipientStatuses: m.recipientStatuses.map(s =>
          s.userId === userId ? { ...s, approved: false, approvedAt: undefined } : s
        ),
        activityLog: [...m.activityLog, entry],
      };
    }));
  }, []);

  const addComment = useCallback((memoId: string, body: string, authorId: string, attachments: Attachment[] = [], parentId?: string) => {
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
    setComments(prev => [...prev, newComment]);
    setMemos(prev => prev.map(m => {
      if (m.id !== memoId) return m;
      return {
        ...m,
        recipientStatuses: m.recipientStatuses.map(s =>
          s.userId === authorId ? { ...s, replied: true, repliedAt: now, opened: true, openedAt: s.openedAt || now } : s
        ),
      };
    }));
  }, []);

  const editComment = useCallback((commentId: string, newBody: string, userId: string) => {
    setComments(prev => prev.map(c => {
      if (c.id !== commentId || c.authorId !== userId) return c;
      return { ...c, body: newBody, updatedAt: new Date().toISOString() };
    }));
  }, []);

  const deleteComment = useCallback((commentId: string, userId: string) => {
    setComments(prev => prev.filter(c => !(c.id === commentId && c.authorId === userId)));
  }, []);

  const toggleCommentPin = useCallback((commentId: string, userId: string) => {
    setComments(prev => prev.map(c => {
      if (c.id !== commentId) return c;
      return { ...c, pinned: !c.pinned, pinnedBy: c.pinned ? undefined : userId };
    }));
  }, []);

  const addCommentReaction = useCallback((commentId: string, emoji: string, userId: string) => {
    setComments(prev => prev.map(c => {
      if (c.id !== commentId) return c;
      const existing = c.reactions.find(r => r.emoji === emoji);
      if (existing) {
        if (existing.users.includes(userId)) {
          const updated = c.reactions.map(r =>
            r.emoji === emoji ? { ...r, users: r.users.filter(u => u !== userId) } : r
          ).filter(r => r.users.length > 0);
          return { ...c, reactions: updated };
        }
        return { ...c, reactions: c.reactions.map(r => r.emoji === emoji ? { ...r, users: [...r.users, userId] } : r) };
      }
      return { ...c, reactions: [...c.reactions, { emoji, users: [userId] }] };
    }));
  }, []);

  const addReaction = useCallback((memoId: string, emoji: string, userId: string) => {
    setMemos(prev => prev.map(m => {
      if (m.id !== memoId) return m;
      const existing = m.reactions.find(r => r.emoji === emoji);
      if (existing) {
        if (existing.users.includes(userId)) {
          const updatedReactions = m.reactions.map(r =>
            r.emoji === emoji ? { ...r, users: r.users.filter(u => u !== userId) } : r
          ).filter(r => r.users.length > 0);
          return { ...m, reactions: updatedReactions };
        }
        return { ...m, reactions: m.reactions.map(r => r.emoji === emoji ? { ...r, users: [...r.users, userId] } : r) };
      }
      return { ...m, reactions: [...m.reactions, { emoji, users: [userId] }] };
    }));
  }, []);

  // ===== WORKFLOW AUTOMATION =====

  const approveWorkflowStep = useCallback((memoId: string, stepId: string, userId: string, approved: boolean, comment?: string) => {
    setMemos(prev => prev.map(m => {
      if (m.id !== memoId || !m.workflow?.enabled) return m;
      const step = m.workflow.approvalChain.find(s => s.id === stepId);
      if (!step || step.approverId !== userId || step.status !== 'pending') return m;

      // Check that all prior steps are approved
      const priorSteps = m.workflow.approvalChain.filter(s => s.order < step.order);
      if (priorSteps.some(s => s.status !== 'approved')) return m;

      const now = new Date().toISOString();
      const updatedChain = m.workflow.approvalChain.map(s =>
        s.id === stepId ? { ...s, status: approved ? 'approved' as const : 'rejected' as const, decidedAt: now, comment } : s
      );

      const activityEntry = {
        id: `al${Date.now()}`,
        userId,
        action: approved ? 'approved' as const : 'unapproved' as const,
        timestamp: now,
        detail: `Workflow step ${step.order}: ${approved ? 'Approved' : 'Rejected'}${comment ? ` — "${comment}"` : ''}`,
      };

      return {
        ...m,
        workflow: { ...m.workflow, approvalChain: updatedChain },
        activityLog: [...m.activityLog, activityEntry],
        updatedAt: now,
      };
    }));
  }, []);

  const checkEscalations = useCallback(() => {
    const now = new Date();
    setMemos(prev => prev.map(m => {
      if (!m.workflow?.enabled || !m.workflow.escalation?.enabled) return m;
      if (m.workflow.escalation.escalatedAt) return m; // already escalated

      const currentStep = m.workflow.approvalChain.find(s => s.status === 'pending');
      if (!currentStep) return m;

      // Check if the memo was sent long enough ago
      const sentAt = new Date(m.createdAt);
      const hoursSinceSent = (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceSent >= m.workflow.escalation.hoursUntilEscalation) {
        const escalationTime = now.toISOString();
        return {
          ...m,
          workflow: {
            ...m.workflow,
            escalation: {
              ...m.workflow.escalation,
              escalatedAt: escalationTime,
              escalatedStepId: currentStep.id,
            },
          },
          activityLog: [...m.activityLog, {
            id: `al${Date.now()}`,
            userId: 'system',
            action: 'opened' as const,
            timestamp: escalationTime,
            detail: `Auto-escalation triggered: Step ${currentStep.order} pending for ${m.workflow.escalation.hoursUntilEscalation}h`,
          }],
          updatedAt: escalationTime,
        };
      }
      return m;
    }));
  }, []);

  const checkScheduledMemos = useCallback(() => {
    const now = new Date();
    setMemos(prev => prev.map(m => {
      if (m.status !== 'draft' || !m.workflow?.scheduledSendAt) return m;
      if (m.workflow.sentBySchedule) return m;
      const scheduleTime = new Date(m.workflow.scheduledSendAt);
      if (now >= scheduleTime) {
        const sendTime = now.toISOString();
        return {
          ...m,
          status: 'sent' as const,
          workflow: { ...m.workflow, sentBySchedule: true },
          recipientStatuses: m.recipientIds.map(uid => ({
            userId: uid, opened: false, acknowledged: false, approved: false, replied: false,
          })),
          activityLog: [...m.activityLog, {
            id: `al${Date.now()}`,
            userId: 'system',
            action: 'opened' as const,
            timestamp: sendTime,
            detail: 'Scheduled delivery — memo sent automatically',
          }],
          updatedAt: sendTime,
        };
      }
      return m;
    }));
  }, []);

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
    <MemoContext.Provider value={{
      memos, comments, addMemo, updateMemo, editMemo, deleteMemo, permanentlyDeleteMemo, restoreMemo, togglePin, toggleArchive, toggleStar,
      hideMemo, acknowledgeMemo, unacknowledgeMemo, approveMemo, unapproveMemo, markOpened,
      addComment, editComment, deleteComment, toggleCommentPin, addCommentReaction, addReaction,
      approveWorkflowStep, checkEscalations, checkScheduledMemos,
      getMemoById, getCommentsByMemoId,
    }}>
      {children}
    </MemoContext.Provider>
  );
}

export function useMemos() {
  const context = useContext(MemoContext);
  if (!context) throw new Error('useMemos must be used within MemoProvider');
  return context;
}
