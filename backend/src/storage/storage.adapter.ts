import { promises as fs } from "fs";
import path from "path";

export interface FileUpload {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface UploadResult {
  filename: string;
  url: string;
  size: number;
  mimetype: string;
}

export abstract class StorageAdapter {
  abstract upload(file: FileUpload, folder?: string): Promise<UploadResult>;
  abstract delete(filename: string): Promise<void>;
  abstract getUrl(filename: string): string;
}

export class LocalStorageAdapter extends StorageAdapter {
  private uploadDir: string;

  constructor(uploadDir: string = "uploads") {
    super();
    this.uploadDir = path.resolve(uploadDir);
  }

  async upload(
    file: FileUpload,
    folder: string = "files",
  ): Promise<UploadResult> {
    // Ensure upload directory exists
    const uploadPath = path.join(this.uploadDir, folder);
    await fs.mkdir(uploadPath, { recursive: true });

    // Generate unique filename (spaces and special chars replaced to avoid URL/path issues)
    const ext = path.extname(file.originalname);
    const rawBasename = path.basename(file.originalname, ext);
    const basename = rawBasename
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_.]/g, "");
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `${basename}_${timestamp}_${random}${ext}`;

    const filePath = path.join(uploadPath, filename);

    // Write file
    await fs.writeFile(filePath, file.buffer);

    return {
      filename,
      url: `/uploads/${folder}/${filename}`,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  async delete(filename: string): Promise<void> {
    try {
      const filePath = path.join(this.uploadDir, filename);
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist, ignore error
      console.warn(`Failed to delete file ${filename}:`, error);
    }
  }

  getUrl(filename: string): string {
    return `/uploads/${filename}`;
  }
}

// Factory function to create storage adapter based on environment
export function createStorageAdapter(): StorageAdapter {
  const storageType = process.env.STORAGE_TYPE || "local";

  switch (storageType) {
    case "local":
    default:
      return new LocalStorageAdapter(process.env.UPLOAD_DIR || "uploads");
  }
}
