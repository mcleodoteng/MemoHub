import React, { createContext, useContext, useState, useCallback } from 'react';
import { Notification, NotificationType } from '@/types';
import { notifications as initialNotifications, currentUser, getUserById, users } from '@/data/mock';
import { useReminders } from '@/context/ReminderContext';
import { useGroups } from '@/context/GroupContext';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notif: Omit<Notification, 'id' | 'createdAt'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  notifyMentions: (text: string, sourceTitle: string, actionUrl: string, authorId: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Extract mentioned user IDs from text containing @mentions.
 * Supports both plain text "@Name" and HTML mention anchors.
 */
function extractMentionedUserIds(text: string): string[] {
  const ids = new Set<string>();

  // Match HTML mention anchors: data-mention="userId"
  const htmlMentionRegex = /data-mention="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = htmlMentionRegex.exec(text)) !== null) {
    ids.add(match[1]);
  }

  // Match plain text @mentions
  const plainMentionRegex = /@(\w[\w\s]*?\b)/g;
  while ((match = plainMentionRegex.exec(text)) !== null) {
    const name = match[1].trim();
    const user = users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (user) ids.add(user.id);
  }

  return Array.from(ids);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(
    () => [...initialNotifications].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  );

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback((notif: Omit<Notification, 'id' | 'createdAt'>) => {
    const newNotif: Notification = {
      ...notif,
      id: `n${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    setNotifications(prev => [newNotif, ...prev]);
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const notifyMentions = useCallback((text: string, sourceTitle: string, actionUrl: string, authorId: string) => {
    const mentionedIds = extractMentionedUserIds(text);
    const author = getUserById(authorId);
    const authorName = author?.name || 'Someone';

    mentionedIds.forEach(userId => {
      // Don't notify the author about their own mention
      if (userId === authorId) return;
      addNotification({
        userId,
        type: 'mention',
        title: 'You were mentioned',
        body: `${authorName} mentioned you in ${sourceTitle}`,
        read: false,
        actionUrl,
      });
    });
  }, [addNotification]);

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, addNotification, markRead, markAllRead, notifyMentions,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
}
