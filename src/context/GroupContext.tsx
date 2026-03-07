import React, { createContext, useContext, useState, useCallback } from 'react';
import { Group } from '@/types';
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
      memberIds: [currentUser.id, ...data.memberIds],
      adminIds: [currentUser.id],
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

  return (
    <GroupContext.Provider value={{ groups, addGroup, updateGroup, deleteGroup, addMember, removeMember, addAdmin, removeAdmin, getGroupById }}>
      {children}
    </GroupContext.Provider>
  );
}

export function useGroups() {
  const context = useContext(GroupContext);
  if (!context) throw new Error('useGroups must be used within GroupProvider');
  return context;
}
