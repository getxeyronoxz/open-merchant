import { z } from "zod";

/**
 * The single error shape crossing the SDK boundary. Codes are stable
 * identifiers the UI switches on; messages are human-readable; detail is a
 * developer-facing explanation that must never contain secrets.
 */

export const appErrorCodeSchema = z.enum([
  "already-exists",
  "not-a-project",
  "not-found",
  "invalid-input",
  "invalid-project",
  "storage-error",
  "cancelled",
  "ai-not-configured",
  "ai-provider-error",
]);

export const appErrorSchema = z.object({
  code: appErrorCodeSchema,
  message: z.string(),
  detail: z.string().optional(),
});

export class AppError extends Error {
  readonly code: z.infer<typeof appErrorCodeSchema>;
  readonly detail?: string;

  constructor(error: z.infer<typeof appErrorSchema>) {
    super(error.message);
    this.name = "AppError";
    this.code = error.code;
    this.detail = error.detail;
  }

  toJSON(): z.infer<typeof appErrorSchema> {
    return { code: this.code, message: this.message, detail: this.detail };
  }
}

export type SerializedAppError = z.infer<typeof appErrorSchema>;
