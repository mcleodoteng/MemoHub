import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Reminder } from '@/types';
import { currentUser } from '@/data/mock';

interface ReminderContextType {
  reminders: Reminder[];
  addReminder: (data: { title: string; description?: string; dueAt: string; groupId?: string }) => Reminder;
  deleteReminder: (id: string) => void;
  firedReminders: Reminder[];
  dismissFired: (id: string) => void;
}

const ReminderContext = createContext<ReminderContextType | undefined>(undefined);

// Simple beep using Web Audio API
function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1100;
      osc2.type = 'sine';
      gain2.gain.value = 0.3;
      osc2.start();
      osc2.stop(ctx.currentTime + 0.3);
    }, 250);
  } catch {
    // Audio not supported
  }
}

export function ReminderProvider({ children }: { children: React.ReactNode }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [firedReminders, setFiredReminders] = useState<Reminder[]>([]);
  const intervalRef = useRef<NodeJS.Timeout>();

  const addReminder = useCallback((data: { title: string; description?: string; dueAt: string; groupId?: string }) => {
    const reminder: Reminder = {
      id: `rem${Date.now()}`,
      title: data.title,
      description: data.description,
      userId: currentUser.id,
      groupId: data.groupId,
      dueAt: data.dueAt,
      fired: false,
      createdAt: new Date().toISOString(),
    };
    setReminders(prev => [...prev, reminder]);
    return reminder;
  }, []);

  const deleteReminder = useCallback((id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    setFiredReminders(prev => prev.filter(r => r.id !== id));
  }, []);

  const dismissFired = useCallback((id: string) => {
    setFiredReminders(prev => prev.filter(r => r.id !== id));
  }, []);

  // Check reminders every second
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const now = new Date();
      setReminders(prev => {
        const updated = prev.map(r => {
          if (r.fired) return r;
          const due = new Date(r.dueAt);
          if (due <= now) {
            playBeep();
            setFiredReminders(f => [...f, { ...r, fired: true }]);
            return { ...r, fired: true };
          }
          return r;
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <ReminderContext.Provider value={{ reminders, addReminder, deleteReminder, firedReminders, dismissFired }}>
      {children}
    </ReminderContext.Provider>
  );
}

export function useReminders() {
  const context = useContext(ReminderContext);
  if (!context) throw new Error('useReminders must be used within ReminderProvider');
  return context;
}
