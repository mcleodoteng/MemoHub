import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import { config } from "./env.js";

const prisma = new PrismaClient({
  log:
    config.nodeEnv === "development" ? ["query", "error", "warn"] : ["error"],
});

export { prisma };
