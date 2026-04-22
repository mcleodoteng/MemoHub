import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [frontendUrl];

export const config = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  logRequests: process.env.LOG_REQUESTS !== "false",
  jwtSecret: process.env.JWT_SECRET || "your-super-secret-jwt-key",
  dataEncryptionKey:
    process.env.DATA_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    "development-only-data-encryption-key",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  databaseUrl:
    process.env.DATABASE_URL || "mysql://user:password@localhost:3306/memohub",
  frontendUrl,
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "12"),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || "100"),
  uploadMaxSize: parseInt(process.env.UPLOAD_MAX_SIZE || "10485760"), // 10MB
  corsOrigin,
};
