import { Request, Response, NextFunction } from "express";
import multer from "multer";

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error("Error:", error);

  // Prisma errors
  if (error.code === "P2002") {
    return res.status(409).json({
      success: false,
      error: "A record with this information already exists",
    });
  }

  if (error.code === "P2025") {
    return res.status(404).json({ success: false, error: "Record not found" });
  }

  // Validation errors
  if (error.name === "ZodError") {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: error.errors,
    });
  }

  // JWT errors
  if (error.name === "JsonWebTokenError") {
    return res.status(401).json({ success: false, error: "Invalid token" });
  }

  if (error.name === "TokenExpiredError") {
    return res.status(401).json({ success: false, error: "Token expired" });
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "Attachment size is bigger than the max attachment size.",
      });
    }

    return res.status(400).json({
      success: false,
      error: error.message || "Upload failed",
    });
  }

  // Default error
  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal server error";

  res.status(statusCode).json({ success: false, error: message });
};
