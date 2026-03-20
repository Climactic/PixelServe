import type { ErrorHandler } from "elysia";
import { PixelServeError } from "../utils/errors";

/**
 * Creates a shared Elysia onError handler that formats PixelServeError
 * instances into structured JSON responses.
 */
export function createErrorHandler(logPrefix: string): ErrorHandler {
  return ({ error, set }) => {
    if (error instanceof PixelServeError) {
      set.status = error.statusCode;
      return {
        error: error.code,
        message: error.message,
      };
    }

    console.error(`${logPrefix}:`, error);
    set.status = 500;
    return {
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    };
  };
}
