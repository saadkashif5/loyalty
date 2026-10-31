import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ApiError } from "@/utils/ApiError";

/**
 * Accepts one file in memory (never written to disk here). Size is capped
 * before it is read in full; the content type is checked later from the
 * bytes themselves (see services/storage.service.ts).
 */
export function singleUpload(field: string, maxBytes: number) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 10, fieldSize: 2000 },
  }).single(field);

  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        next(
          ApiError.badRequest(
            err.code === "LIMIT_FILE_SIZE"
              ? `The file is too large (up to ${Math.round(maxBytes / 1024 / 1024)} MB)`
              : "Upload one file",
          ),
        );
        return;
      }
      next(err);
    });
  };
}
