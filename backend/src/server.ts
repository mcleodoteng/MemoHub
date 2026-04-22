import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import rateLimit from "express-rate-limit";

// Load environment variables
dotenv.config();

// Import routes and middleware
import authRoutes from "./routes/auth.routes.js";
import memoRoutes from "./routes/memo.routes.js";
import commentRoutes from "./routes/comment.routes.js";
import conversationRoutes from "./routes/conversation.routes.js";
import messageRoutes from "./routes/message.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import reminderRoutes from "./routes/reminder.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import userRoutes from "./routes/user.routes.js";
import groupRoutes from "./routes/group.routes.js";
import tagRoutes from "./routes/tag.routes.js";
import loggingRoutes from "./routes/logging.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import passwordResetRoutes from "./routes/password-reset.routes.js";
import tokenRoutes from "./routes/token.routes.js";
import userProfileRoutes from "./routes/user-profile.routes.js";
import systemSettingsRoutes from "./routes/system-settings.routes.js";
import { config } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import { requestLoggerMiddleware } from "./middleware/request-logger.middleware.js";
import { initializeSocketServer } from "./sockets/socket.server.js";
import { setDynamicRoleLookup } from "./middleware/role-permissions.js";
import {
  getResolvedBaseRole,
  getResolvedPermissions,
  initializeRoleConfigCache,
} from "./services/role-config.service.js";
import { EmailService } from "./services/email.service.js";
import { MemoService } from "./services/memo.service.js";
import { ReminderService } from "./services/reminder.service.js";
import { SystemSettingsService } from "./services/system-settings.service.js";

// Initialize Express app
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const emailService = new EmailService();
const memoService = new MemoService();
const reminderService = new ReminderService();
const systemSettingsService = new SystemSettingsService();
let workflowAutomationInterval: NodeJS.Timeout | null = null;
let reminderAutomationInterval: NodeJS.Timeout | null = null;
let auditCleanupInterval: NodeJS.Timeout | null = null;

setDynamicRoleLookup({
  getResolvedPermissions,
  getResolvedBaseRole,
});

app.set("trust proxy", 1);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Rate limiting
const isDev = process.env.NODE_ENV !== "production";

const apiLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (isDev) return true;
    if (req.method === "OPTIONS") return true;
    if (req.path === "/api/health" || req.path === "/api/ready") return true;
    if (req.path === "/api/users/me") return true;
    return false;
  },
  message: {
    success: false,
    error: "Too many requests from this IP, please try again later.",
  },
});

const authLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: Math.max(20, Math.floor(config.rateLimitMax / 2)),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (isDev) return true;
    return req.method === "OPTIONS";
  },
  message: {
    success: false,
    error: "Too many authentication attempts, please try again later.",
  },
});

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  }),
);
if (config.logRequests) {
  app.use(requestLoggerMiddleware);
}
app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files from uploads directory (absolute path prevents cwd issues)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/auth", passwordResetRoutes); // Mount password reset routes under /api/auth
app.use("/api/auth", tokenRoutes); // Mount token routes under /api/auth
app.use("/api/users", userRoutes);
app.use("/api/profile", authMiddleware, userProfileRoutes);
app.use("/api/groups", authMiddleware, groupRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/memos", authMiddleware, memoRoutes);
app.use("/api/comments", authMiddleware, commentRoutes);
app.use("/api/conversations", authMiddleware, conversationRoutes);
app.use("/api/messages", authMiddleware, messageRoutes);
app.use("/api/notifications", authMiddleware, notificationRoutes);
app.use("/api/reminders", authMiddleware, reminderRoutes);
app.use("/api/upload", authMiddleware, uploadRoutes);
app.use("/api/logs", authMiddleware, loggingRoutes);
app.use("/api/reports", authMiddleware, reportsRoutes);
app.use("/api/system", authMiddleware, systemSettingsRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "MemoHub API is running",
    data: {
      status: "ok",
      environment: config.nodeEnv,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});

app.get("/api/ready", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      message: "MemoHub API is ready",
      data: {
        status: "ready",
        database: "connected",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: "MemoHub API is not ready",
      data: {
        status: "not_ready",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      },
    });
  }
});

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = config.port;
const shutdown = async (signal: string) => {
  console.log(`🛑 Received ${signal}. Shutting down MemoHub backend...`);

  if (workflowAutomationInterval) {
    clearInterval(workflowAutomationInterval);
    workflowAutomationInterval = null;
  }

  if (reminderAutomationInterval) {
    clearInterval(reminderAutomationInterval);
    reminderAutomationInterval = null;
  }

  if (auditCleanupInterval) {
    clearInterval(auditCleanupInterval);
    auditCleanupInterval = null;
  }

  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log("✅ Prisma disconnected cleanly");
      process.exit(0);
    } catch (error) {
      console.error("❌ Error during shutdown:", error);
      process.exit(1);
    }
  });
};

const bootstrap = async () => {
  await initializeRoleConfigCache();

  server.listen(PORT, () => {
    console.log(`🚀 MemoHub Backend running on port ${PORT}`);
    console.log(`📡 Socket.IO server initialized`);
    console.log(
      `[EmailService] Active transport: ${emailService.getTransportDescription()}`,
    );
    initializeSocketServer();

    void emailService.verifyConnection().catch((error) => {
      console.error("[EmailService] Transport verification failed:", error);
    });

    const runWorkflowAutomation = async () => {
      try {
        const result = await memoService.runWorkflowAutomationTick();
        console.log(
          `[WorkflowAutomation] scheduled=${result.scheduledProcessed} escalations=${result.escalationsProcessed}`,
        );
      } catch (error) {
        console.error("Workflow automation tick failed:", error);
      }
    };

    const runReminderAutomation = async () => {
      try {
        const processed = await reminderService.processDueReminders();
        if (processed > 0) {
          console.log(`[ReminderAutomation] fired=${processed}`);
        }
      } catch (error) {
        console.error("Reminder automation tick failed:", error);
      }
    };

    const runAuditCleanup = async () => {
      try {
        const deleted = await systemSettingsService.cleanupExpiredAuditLogs();
        if (deleted > 0) {
          console.log(`[AuditCleanup] deleted=${deleted}`);
        }
      } catch (error) {
        console.error("Audit cleanup failed:", error);
      }
    };

    void runWorkflowAutomation();
    void runReminderAutomation();
    void runAuditCleanup();
    workflowAutomationInterval = setInterval(runWorkflowAutomation, 30000);
    reminderAutomationInterval = setInterval(runReminderAutomation, 1000);
    auditCleanupInterval = setInterval(runAuditCleanup, 60 * 60 * 1000);
  });
};

void bootstrap();

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

export { io };
