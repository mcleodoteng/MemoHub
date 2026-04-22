import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { UploadService } from "../storage/upload.service.js";
import { z } from "zod";
import { SystemSettingsService } from "../services/system-settings.service.js";

const uploadService = new UploadService();
const systemSettingsService = new SystemSettingsService();

// Validation schemas
const uploadQuerySchema = z.object({
  query: z.object({
    memoId: z.string().optional(),
    commentId: z.string().optional(),
  }),
});

const getAttachmentsSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  query: z.object({
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 50)),
    offset: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 0)),
  }),
});

export const uploadFile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    const userId = (req as any).user.id;
    const { memoId, commentId } = req.query;

    await systemSettingsService.enforceAttachmentSize([req.file]);

    // Upload file to storage
    const uploadResult = await uploadService.uploadFile(req.file);

    // Save attachment to database
    const attachment = await uploadService.saveAttachment({
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
      url: uploadResult.url,
      uploadedBy: userId,
      memoId: memoId as string,
      commentId: commentId as string,
    });

    res.status(201).json({
      success: true,
      data: { attachment },
    });
  } catch (error) {
    console.error("Upload error:", error);
    const statusCode =
      typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode) || 500
        : 500;
    res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to upload file",
    });
  }
};

export const uploadMultipleFiles = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
      return res.status(400).json({
        success: false,
        error: "No files uploaded",
      });
    }

    const userId = (req as any).user.id;
    const { memoId, commentId } = req.query;
    const files = Array.isArray(req.files) ? req.files : [req.files];

    await systemSettingsService.enforceAttachmentSize(files);

    // Upload files to storage
    const uploadResults = await uploadService.uploadFiles(files);

    // Save attachments to database
    const attachments = await Promise.all(
      uploadResults.map((result, index) => {
        const file = files[index];
        return uploadService.saveAttachment({
          name: file.originalname,
          type: file.mimetype,
          size: file.size,
          url: result.url,
          uploadedBy: userId,
          memoId: memoId as string,
          commentId: commentId as string,
        });
      }),
    );

    res.status(201).json({
      success: true,
      data: { attachments },
    });
  } catch (error) {
    console.error("Multiple upload error:", error);
    const statusCode =
      typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode) || 500
        : 500;
    res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to upload files",
    });
  }
};

export const getMemoAttachments = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const attachments = await uploadService.getMemoAttachments(id);

    res.json({
      success: true,
      data: { attachments },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch memo attachments",
    });
  }
};

export const getCommentAttachments = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { id } = req.params;

    const attachments = await uploadService.getCommentAttachments(id);

    res.json({
      success: true,
      data: { attachments },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch comment attachments",
    });
  }
};

export const getUserAttachments = async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { limit, offset } = req.query as { limit?: string; offset?: string };

    const attachments = await uploadService.getUserAttachments(
      userId,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );

    res.json({
      success: true,
      data: { attachments },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch user attachments",
    });
  }
};

export const deleteAttachment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    await uploadService.deleteAttachment(id, userId);

    res.json({
      success: true,
      message: "Attachment deleted successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Attachment not found") {
      res.status(404).json({
        success: false,
        error: "Attachment not found",
      });
    } else if (error instanceof Error && error.message === "Access denied") {
      res.status(403).json({
        success: false,
        error: "Access denied",
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to delete attachment",
      });
    }
  }
};
