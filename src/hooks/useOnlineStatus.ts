import { useState, useEffect, useCallback, useRef } from 'react';
import { allUsers } from '@/data/mock';

type StatusMap = Record<string, 'online' | 'away' | 'offline'>;

// Simulated real-time status store
let globalStatusMap: StatusMap = {};
const listeners = new Set<(map: StatusMap) => void>();

function initStatuses() {
  allUsers.forEach(u => {
    globalStatusMap[u.id] = u.status;
  });
}
initStatuses();

// Simulate random status changes every 8-15 seconds
let intervalId: ReturnType<typeof setInterval> | null = null;

function startSimulation() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    const userIds = Object.keys(globalStatusMap);
    const randomId = userIds[Math.floor(Math.random() * userIds.length)];
    const statuses: Array<'online' | 'away' | 'offline'> = ['online', 'away', 'offline'];
    const currentStatus = globalStatusMap[randomId];
    // Pick a different status
    const newStatus = statuses.filter(s => s !== currentStatus)[Math.floor(Math.random() * 2)];
    globalStatusMap = { ...globalStatusMap, [randomId]: newStatus };
    listeners.forEach(fn => fn(globalStatusMap));
  }, 10000);
}

function stopSimulation() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function useOnlineStatuses() {
  const [statuses, setStatuses] = useState<StatusMap>(globalStatusMap);

  useEffect(() => {
    const handler = (map: StatusMap) => setStatuses({ ...map });
    listeners.add(handler);
    startSimulation();
    return () => {
      listeners.delete(handler);
      if (listeners.size === 0) stopSimulation();
    };
  }, []);

  const getUserStatus = useCallback((userId: string): 'online' | 'away' | 'offline' => {
    return statuses[userId] || 'offline';
  }, [statuses]);

  return { statuses, getUserStatus };
}

export function useUserStatus(userId: string) {
  const { getUserStatus } = useOnlineStatuses();
  return getUserStatus(userId);
}
