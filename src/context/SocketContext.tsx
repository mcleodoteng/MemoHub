import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";
import { getStoredToken } from "@/lib/api";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  typingUsers: Record<string, string[]>; // { conversationId: [userId1, userId2] }
  onlineUsers: Set<string>;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  emitMessage: (event: string, data: any) => void;
  onEvent: (event: string, callback: (data: any) => void) => void;
  offEvent: (event: string, callback?: (data: any) => void) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const joinedRooms = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const token = getStoredToken();
    if (!token) {
      return;
    }

    // Connect to Socket.IO server
    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (import.meta.env.DEV ? window.location.origin : "http://localhost:5000");
    const newSocket = io(socketUrl, {
      auth: {
        token: `Bearer ${token}`,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Connection events
    newSocket.on("connect", () => {
      console.log("[Socket] Connected:", newSocket.id);
      setIsConnected(true);

      // Join user-specific room for notifications
      newSocket.emit("join_room", `user_${currentUser.id}`);
      joinedRooms.current.add(`user_${currentUser.id}`);
    });

    newSocket.on("disconnect", () => {
      console.log("[Socket] Disconnected");
      setIsConnected(false);
      joinedRooms.current.clear();
    });

    newSocket.on("connect_error", (error) => {
      const message = error?.message || "";
      if (message.toLowerCase().includes("invalid authentication token")) {
        setIsConnected(false);
        newSocket.disconnect();
        return;
      }
      console.warn("[Socket] Connection warning:", error);
    });

    // Online users tracking
    newSocket.on("user_joined", (userId: string) => {
      setOnlineUsers((prev) => new Set([...prev, userId]));
    });

    newSocket.on("user_left", (userId: string) => {
      setOnlineUsers((prev) => {
        const updated = new Set(prev);
        updated.delete(userId);
        return updated;
      });
    });

    newSocket.on("online_users", (userIds: string[]) => {
      setOnlineUsers(new Set(userIds));
    });

    // Typing indicator tracking
    newSocket.on(
      "user_typing",
      ({
        conversationId,
        userId,
      }: {
        conversationId: string;
        userId: string;
      }) => {
        setTypingUsers((prev) => ({
          ...prev,
          [conversationId]: [...(prev[conversationId] || []), userId].filter(
            (id, index, arr) => arr.indexOf(id) === index,
          ),
        }));

        // Clear after 3 seconds
        setTimeout(() => {
          setTypingUsers((prev) => ({
            ...prev,
            [conversationId]: (prev[conversationId] || []).filter(
              (id) => id !== userId,
            ),
          }));
        }, 3000);
      },
    );

    newSocket.on(
      "user_stopped_typing",
      ({
        conversationId,
        userId,
      }: {
        conversationId: string;
        userId: string;
      }) => {
        setTypingUsers((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] || []).filter(
            (id) => id !== userId,
          ),
        }));
      },
    );

    setSocket(newSocket);

    return () => {
      // Leave all rooms
      joinedRooms.current.forEach((room) => {
        newSocket.emit("leave_room", room);
      });
      newSocket.disconnect();
    };
  }, [currentUser?.id]);

  const joinRoom = useCallback(
    (roomId: string) => {
      if (socket && !joinedRooms.current.has(roomId)) {
        if (roomId.startsWith("conversation_")) {
          socket.emit("join_conversation", roomId.replace("conversation_", ""));
        } else if (roomId.startsWith("memo_")) {
          socket.emit("join_memo", roomId.replace("memo_", ""));
        } else {
          socket.emit("join_room", roomId);
        }
        joinedRooms.current.add(roomId);
        console.log(`[Socket] Joined room: ${roomId}`);
      }
    },
    [socket],
  );

  const leaveRoom = useCallback(
    (roomId: string) => {
      if (socket && joinedRooms.current.has(roomId)) {
        if (roomId.startsWith("conversation_")) {
          socket.emit(
            "leave_conversation",
            roomId.replace("conversation_", ""),
          );
        } else if (roomId.startsWith("memo_")) {
          socket.emit("leave_memo", roomId.replace("memo_", ""));
        } else {
          socket.emit("leave_room", roomId);
        }
        joinedRooms.current.delete(roomId);
        console.log(`[Socket] Left room: ${roomId}`);
      }
    },
    [socket],
  );

  const emitMessage = useCallback(
    (event: string, data: any) => {
      if (socket && isConnected) {
        socket.emit(event, data);
      } else {
        console.warn(`[Socket] Cannot emit event "${event}" - not connected`);
      }
    },
    [socket, isConnected],
  );

  const onEvent = useCallback(
    (event: string, callback: (data: any) => void) => {
      if (socket) {
        socket.on(event, callback);
      }
    },
    [socket],
  );

  const offEvent = useCallback(
    (event: string, callback?: (data: any) => void) => {
      if (socket) {
        if (callback) {
          socket.off(event, callback);
        } else {
          socket.off(event);
        }
      }
    },
    [socket],
  );

  const value: SocketContextType = {
    socket,
    isConnected,
    typingUsers,
    onlineUsers,
    joinRoom,
    leaveRoom,
    emitMessage,
    onEvent,
    offEvent,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return context;
}
