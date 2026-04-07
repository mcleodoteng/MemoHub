import { useMemo, useCallback } from "react";
import { useSocket } from "@/context/SocketContext";
import { useUsers } from "@/context/UserContext";

type StatusMap = Record<string, "online" | "away" | "offline">;

export function useOnlineStatuses() {
  const { onlineUsers } = useSocket();
  const { users } = useUsers();

  const statuses = useMemo<StatusMap>(() => {
    const baseStatuses: StatusMap = {};
    users.forEach((user) => {
      baseStatuses[user.id] = user.status || "offline";
    });
    onlineUsers.forEach((userId) => {
      baseStatuses[userId] = "online";
    });
    return baseStatuses;
  }, [users, onlineUsers]);

  const getUserStatus = useCallback(
    (userId: string): "online" | "away" | "offline" => {
      return statuses[userId] || "offline";
    },
    [statuses],
  );

  return { statuses, getUserStatus };
}

export function useUserStatus(userId: string) {
  const { getUserStatus } = useOnlineStatuses();
  return getUserStatus(userId);
}
