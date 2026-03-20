import { config } from "../config";
import { MAX_REDIRECTS } from "../constants";
import { FetchError, TimeoutError, ValidationError } from "../utils/errors";
import { validateUrl } from "../utils/url-validator";

export async function fetchImage(urlString: string): Promise<Buffer> {
  let currentUrl = await validateUrl(urlString);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeout);

  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      const response = await fetch(currentUrl.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent": "PixelServe/1.0",
          Accept: "image/*",
        },
        redirect: "manual",
      });

      // Handle redirects manually to re-validate each target against SSRF
      if (isRedirectStatus(response.status)) {
        const location = response.headers.get("Location");
        if (!location) {
          throw new FetchError("Redirect response missing Location header");
        }
        // Resolve relative redirects and re-validate against SSRF
        const resolvedUrl = new URL(location, currentUrl.toString());
        currentUrl = await validateUrl(resolvedUrl.toString());
        continue;
      }

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
    }

    throw new FetchError(`Too many redirects (max ${MAX_REDIRECTS})`);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new TimeoutError("Image fetch timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isRedirectStatus(status: number): boolean {
  return (
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 307 ||
    status === 308
  );
}
