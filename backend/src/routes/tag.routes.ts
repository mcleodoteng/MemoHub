import { Router } from "express";
import {
  getTags,
  getTagById,
  createTag,
  updateTag,
  deleteTag,
} from "../controllers/tag.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

// GET /api/tags - List all tags with categories
router.get("/", getTags);

// POST /api/tags - Create new tag (auth required)
router.post("/", authMiddleware, createTag);

// GET /api/tags/:id - Get specific tag
router.get("/:id", getTagById);

// PUT /api/tags/:id - Update tag (auth required)
router.put("/:id", authMiddleware, updateTag);

// DELETE /api/tags/:id - Delete tag (auth required)
router.delete("/:id", authMiddleware, deleteTag);

export default router;
