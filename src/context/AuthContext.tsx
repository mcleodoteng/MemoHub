import React, { createContext, useContext, useState, useCallback } from 'react';
import { User } from '@/types';
import { users } from '@/data/mock';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
}

// Mock credentials - password is "password" for all users
const mockCredentials: Record<string, string> = {
  'alex@memohub.com': 'password',
  'sarah@memohub.com': 'password',
  'marcus@memohub.com': 'password',
  'priya@memohub.com': 'password',
  'james@memohub.com': 'password',
  'emily@memohub.com': 'password',
  'david@memohub.com': 'password',
  'olivia@memohub.com': 'password',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const savedId = sessionStorage.getItem('memohub_user_id');
    if (savedId) return users.find(u => u.id === savedId) || null;
    return null;
  });

  const login = useCallback((email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!mockCredentials[normalizedEmail]) {
      return { success: false, error: 'No account found with this email' };
    }
    if (mockCredentials[normalizedEmail] !== password) {
      return { success: false, error: 'Incorrect password' };
    }
    const user = users.find(u => u.email.toLowerCase() === normalizedEmail);
    if (!user) return { success: false, error: 'User not found' };
    setCurrentUser(user);
    sessionStorage.setItem('memohub_user_id', user.id);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    sessionStorage.removeItem('memohub_user_id');
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated: !!currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
