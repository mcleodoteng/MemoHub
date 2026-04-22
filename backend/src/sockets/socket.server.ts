import jwt from "jsonwebtoken";
import { io } from "../server.js";
import { handleChatSockets } from "./chat.socket.js";
import { handleMemoSockets } from "./memo.socket.js";
import { handleNotificationSockets } from "./notification.socket.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const connectedUsers = new Map<string, number>();

export const initializeSocketServer = () => {
  // Authentication middleware for sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication token required"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      socket.data.userId = decoded.userId;
      socket.data.user = decoded;
      next();
    } catch (error) {
      next(new Error("Invalid authentication token"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId;
    console.log(`User ${userId} connected with socket ${socket.id}`);

    const currentConnections = connectedUsers.get(userId) || 0;
    connectedUsers.set(userId, currentConnections + 1);
    if (currentConnections === 0) {
      io.emit("user_joined", userId);
    }
    io.emit("online_users", Array.from(connectedUsers.keys()));

    // Join user-specific room for notifications
    socket.join(`user_${userId}`);

    // Join group/department rooms for targeted messaging
    try {
      const userGroups = await prisma.groupMember.findMany({
        where: { userId },
        include: { group: true },
      });

      userGroups.forEach((member) => {
        socket.join(`group_${member.groupId}`);
        console.log(`User ${userId} joined group ${member.groupId}`);
      });

      // Also join department room if user has a department
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { department: true },
      });

      if (user?.department) {
        socket.join(`department_${user.department}`);
        console.log(`User ${userId} joined department ${user.department}`);
      }
    } catch (error) {
      console.error("Error joining group/department rooms:", error);
    }

    // Handle different socket namespaces
    handleChatSockets(io, socket);
    handleMemoSockets(io, socket);
    handleNotificationSockets(io, socket);

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`User ${userId} disconnected from socket ${socket.id}`);
      const remainingConnections = (connectedUsers.get(userId) || 1) - 1;
      if (remainingConnections <= 0) {
        connectedUsers.delete(userId);
        io.emit("user_left", userId);
      } else {
        connectedUsers.set(userId, remainingConnections);
      }
      io.emit("online_users", Array.from(connectedUsers.keys()));
    });

    // Handle connection errors
    socket.on("error", (error) => {
      console.error(`Socket error for user ${userId}:`, error);
    });
  });
};
