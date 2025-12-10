import { describe, expect, test } from "bun:test";
import {
  FetchError,
  ForbiddenError,
  ImageProcessingError,
  NotFoundError,
  PixelServeError,
  TimeoutError,
  ValidationError,
} from "../../src/utils/errors";

describe("Error Classes", () => {
  describe("PixelServeError", () => {
    test("creates error with message", () => {
      const error = new PixelServeError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.name).toBe("PixelServeError");
    });

    test("defaults to 500 status code", () => {
      const error = new PixelServeError("Test error");
      expect(error.statusCode).toBe(500);
    });

    test("defaults to INTERNAL_ERROR code", () => {
      const error = new PixelServeError("Test error");
      expect(error.code).toBe("INTERNAL_ERROR");
    });

    test("accepts custom status code", () => {
      const error = new PixelServeError("Test error", 418);
      expect(error.statusCode).toBe(418);
    });

    test("accepts custom error code", () => {
      const error = new PixelServeError("Test error", 500, "CUSTOM_CODE");
      expect(error.code).toBe("CUSTOM_CODE");
    });

    test("is instanceof Error", () => {
      const error = new PixelServeError("Test");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("ValidationError", () => {
    test("creates error with message", () => {
      const error = new ValidationError("Invalid input");
      expect(error.message).toBe("Invalid input");
      expect(error.name).toBe("ValidationError");
    });

    test("has 400 status code", () => {
      const error = new ValidationError("Invalid input");
      expect(error.statusCode).toBe(400);
    });

    test("has VALIDATION_ERROR code", () => {
      const error = new ValidationError("Invalid input");
      expect(error.code).toBe("VALIDATION_ERROR");
    });

    test("is instanceof PixelServeError", () => {
      const error = new ValidationError("Test");
      expect(error).toBeInstanceOf(PixelServeError);
    });
  });

  describe("ForbiddenError", () => {
    test("creates error with message", () => {
      const error = new ForbiddenError("Access denied");
      expect(error.message).toBe("Access denied");
      expect(error.name).toBe("ForbiddenError");
    });

    test("has 403 status code", () => {
      const error = new ForbiddenError("Access denied");
      expect(error.statusCode).toBe(403);
    });

    test("has FORBIDDEN code", () => {
      const error = new ForbiddenError("Access denied");
      expect(error.code).toBe("FORBIDDEN");
    });

    test("is instanceof PixelServeError", () => {
      const error = new ForbiddenError("Test");
      expect(error).toBeInstanceOf(PixelServeError);
    });
  });

  describe("NotFoundError", () => {
    test("creates error with message", () => {
      const error = new NotFoundError("Resource not found");
      expect(error.message).toBe("Resource not found");
      expect(error.name).toBe("NotFoundError");
    });

    test("has 404 status code", () => {
      const error = new NotFoundError("Resource not found");
      expect(error.statusCode).toBe(404);
    });

    test("has NOT_FOUND code", () => {
      const error = new NotFoundError("Resource not found");
      expect(error.code).toBe("NOT_FOUND");
    });

    test("is instanceof PixelServeError", () => {
      const error = new NotFoundError("Test");
      expect(error).toBeInstanceOf(PixelServeError);
    });
  });

  describe("FetchError", () => {
    test("creates error with message", () => {
      const error = new FetchError("Failed to fetch");
      expect(error.message).toBe("Failed to fetch");
      expect(error.name).toBe("FetchError");
    });

    test("has 502 status code", () => {
      const error = new FetchError("Failed to fetch");
      expect(error.statusCode).toBe(502);
    });

    test("has FETCH_ERROR code", () => {
      const error = new FetchError("Failed to fetch");
      expect(error.code).toBe("FETCH_ERROR");
    });

    test("is instanceof PixelServeError", () => {
      const error = new FetchError("Test");
      expect(error).toBeInstanceOf(PixelServeError);
    });
  });

  describe("TimeoutError", () => {
    test("creates error with default message", () => {
      const error = new TimeoutError();
      expect(error.message).toBe("Request timed out");
      expect(error.name).toBe("TimeoutError");
    });

    test("creates error with custom message", () => {
      const error = new TimeoutError("Custom timeout message");
      expect(error.message).toBe("Custom timeout message");
    });

    test("has 504 status code", () => {
      const error = new TimeoutError();
      expect(error.statusCode).toBe(504);
    });

    test("has TIMEOUT code", () => {
      const error = new TimeoutError();
      expect(error.code).toBe("TIMEOUT");
    });

    test("is instanceof PixelServeError", () => {
      const error = new TimeoutError();
      expect(error).toBeInstanceOf(PixelServeError);
    });
  });

  describe("ImageProcessingError", () => {
    test("creates error with message", () => {
      const error = new ImageProcessingError("Processing failed");
      expect(error.message).toBe("Processing failed");
      expect(error.name).toBe("ImageProcessingError");
    });

    test("has 422 status code", () => {
      const error = new ImageProcessingError("Processing failed");
      expect(error.statusCode).toBe(422);
    });

    test("has IMAGE_PROCESSING_ERROR code", () => {
      const error = new ImageProcessingError("Processing failed");
      expect(error.code).toBe("IMAGE_PROCESSING_ERROR");
    });

    test("is instanceof PixelServeError", () => {
      const error = new ImageProcessingError("Test");
      expect(error).toBeInstanceOf(PixelServeError);
    });
  });

  describe("Error Hierarchy", () => {
    test("all custom errors extend Error", () => {
      expect(new ValidationError("test")).toBeInstanceOf(Error);
      expect(new ForbiddenError("test")).toBeInstanceOf(Error);
      expect(new NotFoundError("test")).toBeInstanceOf(Error);
      expect(new FetchError("test")).toBeInstanceOf(Error);
      expect(new TimeoutError()).toBeInstanceOf(Error);
      expect(new ImageProcessingError("test")).toBeInstanceOf(Error);
    });

    test("all custom errors extend PixelServeError", () => {
      expect(new ValidationError("test")).toBeInstanceOf(PixelServeError);
      expect(new ForbiddenError("test")).toBeInstanceOf(PixelServeError);
      expect(new NotFoundError("test")).toBeInstanceOf(PixelServeError);
      expect(new FetchError("test")).toBeInstanceOf(PixelServeError);
      expect(new TimeoutError()).toBeInstanceOf(PixelServeError);
      expect(new ImageProcessingError("test")).toBeInstanceOf(PixelServeError);
    });

    test("errors can be caught as PixelServeError", () => {
      try {
        throw new ValidationError("test");
      } catch (e) {
        expect(e).toBeInstanceOf(PixelServeError);
        if (e instanceof PixelServeError) {
          expect(e.statusCode).toBe(400);
        }
      }
    });
  });
});
