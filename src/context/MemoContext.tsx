import React, { createContext, useContext, useState, useCallback } from 'react';
import { Memo, Comment, MemoVisibility, MemoEditEntry, Attachment } from '@/types';
import { memos as initialMemos, comments as initialComments, currentUser } from '@/data/mock';

interface MemoContextType {
  memos: Memo[];
  comments: Comment[];
  addMemo: (memo: Omit<Memo, 'id' | 'createdAt' | 'updatedAt' | 'recipientStatuses' | 'reactions' | 'editHistory' | 'hiddenBy'>) => Memo;
  updateMemo: (id: string, updates: Partial<Memo>) => void;
  editMemo: (id: string, updates: { title?: string; body?: string; tags?: string[]; visibility?: MemoVisibility; attachments?: Attachment[]; recipientIds?: string[]; referencedMemoIds?: string[] }, editorId: string) => void;
  deleteMemo: (id: string) => void;
  togglePin: (id: string) => void;
  toggleArchive: (id: string) => void;
  hideMemo: (memoId: string, userId: string) => void;
  acknowledgeMemo: (memoId: string, userId: string) => void;
  approveMemo: (memoId: string, userId: string) => void;
  addComment: (memoId: string, body: string, authorId: string) => void;
  addReaction: (memoId: string, emoji: string, userId: string) => void;
  getMemoById: (id: string) => Memo | undefined;
  getCommentsByMemoId: (memoId: string) => Comment[];
}

const MemoContext = createContext<MemoContextType | undefined>(undefined);

export function MemoProvider({ children }: { children: React.ReactNode }) {
  const [memos, setMemos] = useState<Memo[]>(initialMemos.map(m => ({ ...m, hiddenBy: m.hiddenBy || [] })));
  const [comments, setComments] = useState<Comment[]>(initialComments);

  const getMemoById = useCallback((id: string) => memos.find(m => m.id === id), [memos]);
  const getCommentsByMemoId = useCallback((memoId: string) => comments.filter(c => c.memoId === memoId), [comments]);

  const addMemo = useCallback((memoData: Omit<Memo, 'id' | 'createdAt' | 'updatedAt' | 'recipientStatuses' | 'reactions' | 'editHistory' | 'hiddenBy'>) => {
    const now = new Date().toISOString();
    const newMemo: Memo = {
      ...memoData,
      id: `m${Date.now()}`,
      reactions: [],
      editHistory: [],
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
    setMemos(prev => prev.filter(m => m.id !== id));
  }, []);

  const togglePin = useCallback((id: string) => {
    setMemos(prev => prev.map(m => m.id === id ? { ...m, pinned: !m.pinned } : m));
  }, []);

  const toggleArchive = useCallback((id: string) => {
    setMemos(prev => prev.map(m => m.id === id ? { ...m, archived: !m.archived } : m));
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

  const acknowledgeMemo = useCallback((memoId: string, userId: string) => {
    setMemos(prev => prev.map(m => {
      if (m.id !== memoId) return m;
      return {
        ...m,
        recipientStatuses: m.recipientStatuses.map(s =>
          s.userId === userId ? { ...s, opened: true, openedAt: s.openedAt || new Date().toISOString(), acknowledged: true, acknowledgedAt: new Date().toISOString() } : s
        ),
      };
    }));
  }, []);

  const approveMemo = useCallback((memoId: string, userId: string) => {
    setMemos(prev => prev.map(m => {
      if (m.id !== memoId) return m;
      return {
        ...m,
        recipientStatuses: m.recipientStatuses.map(s =>
          s.userId === userId ? {
            ...s,
            opened: true,
            openedAt: s.openedAt || new Date().toISOString(),
            acknowledged: true,
            acknowledgedAt: s.acknowledgedAt || new Date().toISOString(),
            approved: true,
            approvedAt: new Date().toISOString(),
          } : s
        ),
      };
    }));
  }, []);

  const addComment = useCallback((memoId: string, body: string, authorId: string) => {
    const now = new Date().toISOString();
    const newComment: Comment = {
      id: `c${Date.now()}`,
      memoId,
      authorId,
      body,
      attachments: [],
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

  return (
    <MemoContext.Provider value={{
      memos, comments, addMemo, updateMemo, editMemo, deleteMemo, togglePin, toggleArchive,
      hideMemo, acknowledgeMemo, approveMemo, addComment, addReaction, getMemoById, getCommentsByMemoId,
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
