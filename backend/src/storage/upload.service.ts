import multer from "multer";
import { Request } from "express";
import {
  StorageAdapter,
  FileUpload,
  createStorageAdapter,
} from "./storage.adapter.js";
import { PrismaClient } from "@prisma/client";
import { MAX_SUPPORTED_ATTACHMENT_SIZE_BYTES } from "../services/system-settings.service.js";

const prisma = new PrismaClient();

export interface UploadOptions {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  folder?: string;
}

export class UploadService {
  private storageAdapter: StorageAdapter;
  private defaultOptions: UploadOptions = {
    maxSize: MAX_SUPPORTED_ATTACHMENT_SIZE_BYTES,
    allowedTypes: undefined,
    folder: "files",
  };

  constructor() {
    this.storageAdapter = createStorageAdapter();
  }

  // File filter function for multer
  private fileFilter(options: UploadOptions) {
    return (
      req: Request,
      file: Express.Multer.File,
      cb: multer.FileFilterCallback,
    ) => {
      const allowedTypes =
        options.allowedTypes || this.defaultOptions.allowedTypes!;

      if (!allowedTypes || allowedTypes.length === 0) {
        cb(null, true);
        return;
      }

      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(
          new Error(
            `File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(", ")}`,
          ),
        );
      }
    };
  }

  // Create multer upload middleware
  createUploadMiddleware(options: UploadOptions = {}) {
    const mergedOptions = { ...this.defaultOptions, ...options };

    const storage = multer.memoryStorage();

    return multer({
      storage,
      limits: {
        fileSize: mergedOptions.maxSize,
      },
      fileFilter: this.fileFilter(mergedOptions),
    });
  }

  // Upload single file
  async uploadFile(
    file: FileUpload,
    options: UploadOptions = {},
  ): Promise<any> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    // Validate file size
    if (file.size > mergedOptions.maxSize!) {
      throw new Error(
        `File size ${file.size} exceeds maximum allowed size ${mergedOptions.maxSize}`,
      );
    }

    if (
      mergedOptions.allowedTypes &&
      mergedOptions.allowedTypes.length > 0 &&
      !mergedOptions.allowedTypes.includes(file.mimetype)
    ) {
      throw new Error(`File type ${file.mimetype} not allowed`);
    }

    // Upload to storage
    const result = await this.storageAdapter.upload(file, mergedOptions.folder);

    return result;
  }

  // Upload multiple files
  async uploadFiles(
    files: FileUpload[],
    options: UploadOptions = {},
  ): Promise<any[]> {
    const results = await Promise.all(
      files.map((file) => this.uploadFile(file, options)),
    );
    return results;
  }

  // Save attachment to database
  async saveAttachment(data: {
    name: string;
    type: string;
    size: number;
    url: string;
    uploadedBy: string;
    memoId?: string;
    commentId?: string;
  }) {
    return prisma.attachment.create({
      data,
    });
  }

  // Delete attachment
  async deleteAttachment(id: string, userId: string) {
    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      throw new Error("Attachment not found");
    }

    if (attachment.uploadedBy !== userId) {
      throw new Error("Access denied");
    }

    // Delete from storage
    await this.storageAdapter.delete(attachment.url.replace("/uploads/", ""));

    // Delete from database
    return prisma.attachment.delete({
      where: { id },
    });
  }

  // Get attachments for memo
  async getMemoAttachments(memoId: string) {
    return prisma.attachment.findMany({
      where: { memoId },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // Get attachments for comment
  async getCommentAttachments(commentId: string) {
    return prisma.attachment.findMany({
      where: { commentId },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // Get user's attachments
  async getUserAttachments(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ) {
    return prisma.attachment.findMany({
      where: { uploadedBy: userId },
      include: {
        memo: {
          select: {
            id: true,
            title: true,
          },
        },
        comment: {
          select: {
            id: true,
            memo: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }
}
