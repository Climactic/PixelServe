export class PixelServeError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR",
  ) {
    super(message);
    this.name = "PixelServeError";
  }
}

export class ValidationError extends PixelServeError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class ForbiddenError extends PixelServeError {
  constructor(message: string) {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends PixelServeError {
  constructor(message: string) {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class FetchError extends PixelServeError {
  constructor(message: string) {
    super(message, 502, "FETCH_ERROR");
    this.name = "FetchError";
  }
}

export class TimeoutError extends PixelServeError {
  constructor(message: string = "Request timed out") {
    super(message, 504, "TIMEOUT");
    this.name = "TimeoutError";
  }
}

export class ImageProcessingError extends PixelServeError {
  constructor(message: string) {
    super(message, 422, "IMAGE_PROCESSING_ERROR");
    this.name = "ImageProcessingError";
  }
}
