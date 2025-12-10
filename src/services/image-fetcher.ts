import { config } from "../config";
import { FetchError, TimeoutError, ValidationError } from "../utils/errors";
import { validateUrl } from "../utils/url-validator";

export async function fetchImage(urlString: string): Promise<Buffer> {
  const url = await validateUrl(urlString);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeout);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "PixelServe/1.0",
        Accept: "image/*",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new FetchError(
        `Failed to fetch image: ${response.status} ${response.statusText}`,
      );
    }

    // Validate content type
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      throw new ValidationError(
        `URL does not return an image (got ${contentType})`,
      );
    }

    // Check content length if available
    const contentLength = parseInt(
      response.headers.get("content-length") || "0",
      10,
    );
    if (contentLength > 0 && contentLength > config.maxImageSize) {
      throw new ValidationError(
        `Image exceeds maximum size limit (${Math.round(config.maxImageSize / 1024 / 1024)}MB)`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    // Double-check actual size
    if (arrayBuffer.byteLength > config.maxImageSize) {
      throw new ValidationError(
        `Image exceeds maximum size limit (${Math.round(config.maxImageSize / 1024 / 1024)}MB)`,
      );
    }

    return Buffer.from(arrayBuffer);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new TimeoutError("Image fetch timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
