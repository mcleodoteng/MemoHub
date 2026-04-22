import { Router } from "express";
import {
  uploadFile,
  uploadMultipleFiles,
  getMemoAttachments,
  getCommentAttachments,
  getUserAttachments,
  deleteAttachment,
} from "../controllers/upload.controller.js";
import { UploadService } from "../storage/upload.service.js";

const router = Router();
const uploadService = new UploadService();

// Single file upload middleware
const uploadSingle = uploadService.createUploadMiddleware().single("file");

// Multiple files upload middleware (up to 10 files)
const uploadMultiple = uploadService
  .createUploadMiddleware()
  .array("files", 10);

// POST /api/upload/file - Upload single file
router.post("/file", uploadSingle, uploadFile);

// POST /api/upload/files - Upload multiple files
router.post("/files", uploadMultiple, uploadMultipleFiles);

// GET /api/upload/memo/:memoId - Get attachments for memo
router.get("/memo/:memoId", getMemoAttachments);

// GET /api/upload/comment/:commentId - Get attachments for comment
router.get("/comment/:commentId", getCommentAttachments);

// GET /api/upload/user - Get user's attachments
router.get("/user", getUserAttachments);

// DELETE /api/upload/:id - Delete attachment
router.delete("/:id", deleteAttachment);

export default router;
