import { Request, Response } from "express";
import { TagService } from "../services/tag.service.js";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { z } from "zod";

const tagService = new TagService();

const createTagSchema = z.object({
  name: z.string().min(1, "Tag name is required").max(50, "Tag name too long"),
  category: z
    .string()
    .min(1, "Category is required")
    .max(50, "Category too long"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format"),
});

const updateTagSchema = z.object({
  name: z
    .string()
    .min(1, "Tag name is required")
    .max(50, "Tag name too long")
    .optional(),
  category: z
    .string()
    .min(1, "Category is required")
    .max(50, "Category too long")
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, "Invalid color format")
    .optional(),
});

export const getTags = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const result = await tagService.getTagsWithCategories(
      parseInt(page as string) || 1,
      parseInt(limit as string) || 50,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get tags error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch tags",
    });
  }
};

export const getTagById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const tag = await tagService.getTagById(id);

    if (!tag) {
      return res.status(404).json({
        success: false,
        error: "Tag not found",
      });
    }

    res.json({
      success: true,
      data: { tag },
    });
  } catch (error) {
    console.error("Get tag error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch tag",
    });
  }
};

export const createTag = async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = createTagSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid input data",
        details: validationResult.error.issues,
      });
    }

    const tag = await tagService.createTag(validationResult.data as any);

    res.status(201).json({
      success: true,
      data: { tag },
    });
  } catch (error: any) {
    console.error("Create tag error:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to create tag",
    });
  }
};

export const updateTag = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const validationResult = updateTagSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid input data",
        details: validationResult.error.issues,
      });
    }

    const tag = await tagService.updateTag(id, validationResult.data);

    if (!tag) {
      return res.status(404).json({
        success: false,
        error: "Tag not found",
      });
    }

    res.json({
      success: true,
      data: { tag },
    });
  } catch (error) {
    console.error("Update tag error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update tag",
    });
  }
};

export const deleteTag = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await tagService.deleteTag(id);

    res.json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error("Delete tag error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete tag",
    });
  }
};
