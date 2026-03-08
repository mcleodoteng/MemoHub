import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Message, Conversation, SharedMemo, Attachment } from '@/types';
import { conversations as initialConversations, messages as initialMessages, currentUser, getUserById } from '@/data/mock';

interface MessageContextType {
  conversations: Conversation[];
  messages: Message[];
  sendMessage: (conversationId: string, body: string, sharedMemo?: SharedMemo, attachments?: Attachment[]) => void;
  sendSystemMessage: (conversationId: string, body: string) => void;
  addReaction: (messageId: string, emoji: string, userId: string) => void;
  markAsRead: (conversationId: string, userId: string) => void;
  getConversationMessages: (conversationId: string) => Message[];
  typingUsers: Record<string, string[]>;
  simulateTyping: (conversationId: string, userId: string) => void;
  createConversation: (participantIds: string[], name?: string, groupId?: string) => Conversation;
  starMessage: (messageId: string, userId: string) => void;
  starredMessages: Message[];
  getUnreadCount: (conversationId: string, userId: string) => number;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

export function MessageProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const typingTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const getConversationMessages = useCallback((conversationId: string) =>
    messages.filter(m => m.conversationId === conversationId), [messages]);

  const getUnreadCount = useCallback((conversationId: string, userId: string) =>
    messages.filter(m => m.conversationId === conversationId && !m.readBy.includes(userId) && m.senderId !== userId).length,
  [messages]);

  const starredMessages = messages.filter(m => m.starredBy?.includes(currentUser.id));

  const sendMessage = useCallback((conversationId: string, body: string, sharedMemo?: SharedMemo) => {
    const now = new Date().toISOString();
    const newMsg: Message = {
      id: `msg${Date.now()}`,
      conversationId,
      senderId: currentUser.id,
      body,
      attachments: [],
      reactions: [],
      sharedMemo,
      readBy: [currentUser.id],
      createdAt: now,
    };
    setMessages(prev => [...prev, newMsg]);
    setConversations(prev => prev.map(c =>
      c.id === conversationId ? { ...c, lastMessage: newMsg, updatedAt: now } : c
    ));

    const conv = conversations.find(c => c.id === conversationId);
    if (conv) {
      const otherUsers = conv.participantIds.filter(id => id !== currentUser.id);
      if (otherUsers.length > 0) {
        const responder = otherUsers[Math.floor(Math.random() * otherUsers.length)];
        setTimeout(() => {
          setTypingUsers(prev => ({
            ...prev,
            [conversationId]: [...(prev[conversationId] || []), responder],
          }));
        }, 1000);

        setTimeout(() => {
          setTypingUsers(prev => ({
            ...prev,
            [conversationId]: (prev[conversationId] || []).filter(id => id !== responder),
          }));
          const replyTime = new Date().toISOString();
          const replies = [
            'Got it, thanks!', 'I\'ll look into that.', 'Sounds good 👍',
            'Let me check and get back to you.', 'Great idea!', 'Noted!',
          ];
          const replyMsg: Message = {
            id: `msg${Date.now()}`,
            conversationId,
            senderId: responder,
            body: replies[Math.floor(Math.random() * replies.length)],
            attachments: [],
            reactions: [],
            readBy: [responder],
            createdAt: replyTime,
          };
          setMessages(prev => [...prev, replyMsg]);
          setConversations(prev => prev.map(c =>
            c.id === conversationId ? { ...c, lastMessage: replyMsg, updatedAt: replyTime } : c
          ));
        }, 3000);
      }
    }
  }, [conversations]);

  const sendSystemMessage = useCallback((conversationId: string, body: string) => {
    const now = new Date().toISOString();
    const sysMsg: Message = {
      id: `msg${Date.now()}`,
      conversationId,
      senderId: 'system',
      body,
      attachments: [],
      reactions: [],
      readBy: [],
      isSystem: true,
      createdAt: now,
    };
    setMessages(prev => [...prev, sysMsg]);
  }, []);

  const addReaction = useCallback((messageId: string, emoji: string, userId: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId) return msg;
      const existing = msg.reactions.find(r => r.emoji === emoji);
      if (existing) {
        if (existing.users.includes(userId)) {
          const updated = msg.reactions.map(r =>
            r.emoji === emoji ? { ...r, users: r.users.filter(u => u !== userId) } : r
          ).filter(r => r.users.length > 0);
          return { ...msg, reactions: updated };
        }
        return { ...msg, reactions: msg.reactions.map(r => r.emoji === emoji ? { ...r, users: [...r.users, userId] } : r) };
      }
      return { ...msg, reactions: [...msg.reactions, { emoji, users: [userId] }] };
    }));
  }, []);

  const markAsRead = useCallback((conversationId: string, userId: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.conversationId !== conversationId || msg.readBy.includes(userId)) return msg;
      return { ...msg, readBy: [...msg.readBy, userId] };
    }));
  }, []);

  const simulateTyping = useCallback((conversationId: string, userId: string) => {
    const key = `${conversationId}_${userId}`;
    if (typingTimers.current[key]) clearTimeout(typingTimers.current[key]);
    setTypingUsers(prev => ({
      ...prev,
      [conversationId]: [...new Set([...(prev[conversationId] || []), userId])],
    }));
    typingTimers.current[key] = setTimeout(() => {
      setTypingUsers(prev => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).filter(id => id !== userId),
      }));
    }, 2000);
  }, []);

  const createConversation = useCallback((participantIds: string[], name?: string, groupId?: string) => {
    const newConv: Conversation = {
      id: `conv${Date.now()}`,
      type: participantIds.length > 2 || groupId ? 'group' : 'direct',
      participantIds,
      name,
      groupId,
      updatedAt: new Date().toISOString(),
    };
    setConversations(prev => [...prev, newConv]);
    return newConv;
  }, []);

  const starMessage = useCallback((messageId: string, userId: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId) return msg;
      const starred = msg.starredBy || [];
      if (starred.includes(userId)) {
        return { ...msg, starredBy: starred.filter(id => id !== userId) };
      }
      return { ...msg, starredBy: [...starred, userId] };
    }));
  }, []);

  return (
    <MessageContext.Provider value={{
      conversations, messages, sendMessage, sendSystemMessage, addReaction, markAsRead,
      getConversationMessages, typingUsers, simulateTyping, createConversation,
      starMessage, starredMessages, getUnreadCount,
    }}>
      {children}
    </MessageContext.Provider>
  );
}

export function useMessages() {
  const context = useContext(MessageContext);
  if (!context) throw new Error('useMessages must be used within MessageProvider');
  return context;
}
