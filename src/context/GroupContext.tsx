import React, { createContext, useContext, useState, useCallback } from 'react';
import { Group, GroupInvite, GroupFile } from '@/types';
import { groups as initialGroups, currentUser } from '@/data/mock';

interface GroupContextType {
  groups: Group[];
  addGroup: (data: { name: string; description: string; type: Group['type']; memberIds: string[] }) => Group;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
  addMember: (groupId: string, userId: string) => void;
  removeMember: (groupId: string, userId: string) => void;
  addAdmin: (groupId: string, userId: string) => void;
  removeAdmin: (groupId: string, userId: string) => void;
  getGroupById: (id: string) => Group | undefined;
  inviteUser: (groupId: string, userId: string) => void;
  acceptInvite: (groupId: string, userId: string) => void;
  declineInvite: (groupId: string, userId: string) => void;
  getInviteStatus: (groupId: string, userId: string) => GroupInvite | undefined;
  addFile: (groupId: string, file: Omit<GroupFile, 'id' | 'uploadedAt'>) => void;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const [groups, setGroups] = useState<Group[]>(initialGroups);

  const getGroupById = useCallback((id: string) => groups.find(g => g.id === id), [groups]);

  const addGroup = useCallback((data: { name: string; description: string; type: Group['type']; memberIds: string[] }) => {
    const newGroup: Group = {
      id: `g${Date.now()}`,
      name: data.name,
      description: data.description,
      type: data.type,
      memberIds: [currentUser.id],
      adminIds: [currentUser.id],
      pendingInvites: data.memberIds.map(uid => ({
        userId: uid,
        status: 'pending' as const,
        invitedAt: new Date().toISOString(),
      })),
      files: [],
      avatar: '',
      createdAt: new Date().toISOString(),
    };
    setGroups(prev => [...prev, newGroup]);
    return newGroup;
  }, []);

  const updateGroup = useCallback((id: string, updates: Partial<Group>) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id));
  }, []);

  const addMember = useCallback((groupId: string, userId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId || g.memberIds.includes(userId)) return g;
      return { ...g, memberIds: [...g.memberIds, userId] };
    }));
  }, []);

  const removeMember = useCallback((groupId: string, userId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      return { ...g, memberIds: g.memberIds.filter(id => id !== userId), adminIds: g.adminIds.filter(id => id !== userId) };
    }));
  }, []);

  const addAdmin = useCallback((groupId: string, userId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId || g.adminIds.includes(userId)) return g;
      return { ...g, adminIds: [...g.adminIds, userId] };
    }));
  }, []);

  const removeAdmin = useCallback((groupId: string, userId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      return { ...g, adminIds: g.adminIds.filter(id => id !== userId) };
    }));
  }, []);

  const inviteUser = useCallback((groupId: string, userId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      if (g.memberIds.includes(userId)) return g;
      if (g.pendingInvites.some(i => i.userId === userId && i.status === 'pending')) return g;
      const invite: GroupInvite = { userId, status: 'pending', invitedAt: new Date().toISOString() };
      return { ...g, pendingInvites: [...g.pendingInvites, invite] };
    }));
  }, []);

  const acceptInvite = useCallback((groupId: string, userId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      const now = new Date().toISOString();
      return {
        ...g,
        memberIds: g.memberIds.includes(userId) ? g.memberIds : [...g.memberIds, userId],
        pendingInvites: g.pendingInvites.map(i =>
          i.userId === userId ? { ...i, status: 'accepted' as const, respondedAt: now } : i
        ),
      };
    }));
  }, []);

  const declineInvite = useCallback((groupId: string, userId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      const now = new Date().toISOString();
      return {
        ...g,
        pendingInvites: g.pendingInvites.map(i =>
          i.userId === userId ? { ...i, status: 'declined' as const, respondedAt: now } : i
        ),
      };
    }));
  }, []);

  const getInviteStatus = useCallback((groupId: string, userId: string) => {
    const group = groups.find(g => g.id === groupId);
    return group?.pendingInvites.find(i => i.userId === userId);
  }, [groups]);

  const addFile = useCallback((groupId: string, file: Omit<GroupFile, 'id' | 'uploadedAt'>) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      const newFile: GroupFile = { ...file, id: `gf${Date.now()}`, uploadedAt: new Date().toISOString() };
      return { ...g, files: [...g.files, newFile] };
    }));
  }, []);

  return (
    <GroupContext.Provider value={{
      groups, addGroup, updateGroup, deleteGroup, addMember, removeMember,
      addAdmin, removeAdmin, getGroupById, inviteUser, acceptInvite, declineInvite,
      getInviteStatus, addFile,
    }}>
      {children}
    </GroupContext.Provider>
  );
}

export function useGroups() {
  const context = useContext(GroupContext);
  if (!context) throw new Error('useGroups must be used within GroupProvider');
  return context;
}
