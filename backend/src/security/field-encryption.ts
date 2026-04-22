import crypto from "crypto";
import { config } from "../config/env.js";

const ENCRYPTION_PREFIX = "enc:v1";
const JSON_WRAPPER_KEY = "__encrypted";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const source = config.dataEncryptionKey || config.jwtSecret;
  return crypto.createHash("sha256").update(source).digest();
}

export function isEncryptedValue(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(`${ENCRYPTION_PREFIX}:`);
}

export function encryptString(
  value?: string | null,
): string | null | undefined {
  if (value === undefined || value === null || value === "") {
    return value;
  }

  if (isEncryptedValue(value)) {
    return value;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv, {
    authTagLength: 16,
  });
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_PREFIX,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptString(
  value?: string | null,
): string | null | undefined {
  if (value === undefined || value === null || value === "") {
    return value;
  }

  if (!isEncryptedValue(value)) {
    return value;
  }

  const [, ivValue, authTagValue, encryptedValue] = value.split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
    { authTagLength: 16 },
  );
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function encryptJson<T = unknown>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    JSON_WRAPPER_KEY in (value as Record<string, unknown>)
  ) {
    return value;
  }

  return {
    [JSON_WRAPPER_KEY]: encryptString(JSON.stringify(value)),
  } as T;
}

export function decryptJson<T = unknown>(value: T): T {
  if (
    !value ||
    typeof value !== "object" ||
    !(JSON_WRAPPER_KEY in (value as Record<string, unknown>))
  ) {
    return value;
  }

  const encrypted = (value as Record<string, unknown>)[JSON_WRAPPER_KEY];
  if (typeof encrypted !== "string") {
    return value;
  }

  try {
    return JSON.parse(decryptString(encrypted) || "null") as T;
  } catch {
    return value;
  }
}
