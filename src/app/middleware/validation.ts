// src/app/middleware/validateRequest.ts
// biome-ignore assist/source/organizeImports: <explanation>
import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import httpStatus from "http-status";

export const validateRequest = (schema: ZodType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errorMessages = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ");

      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: "Validation failed",
        errors: result.error.issues, // frontend-e field-wise dekhaite kaje lagbe
        errorMessage: errorMessages,
      });
    }

    // validated + transformed data (trim, toLowerCase etc) req.body-te bosay dilam
    req.body = result.data;
    next();
  };
};