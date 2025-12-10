import { describe, expect, test } from "bun:test";
import { ForbiddenError, ValidationError } from "../../src/utils/errors";
import {
  isValidHexColor,
  sanitizeHexColor,
} from "../../src/utils/url-validator";

// Note: validateUrl is async and requires DNS resolution, so we test it separately
// These tests focus on the synchronous hex color validation functions

describe("URL Validator - Hex Color Validation", () => {
  describe("isValidHexColor", () => {
    test("accepts valid 3-character hex colors", () => {
      expect(isValidHexColor("fff")).toBe(true);
      expect(isValidHexColor("000")).toBe(true);
      expect(isValidHexColor("abc")).toBe(true);
      expect(isValidHexColor("ABC")).toBe(true);
      expect(isValidHexColor("123")).toBe(true);
    });

    test("accepts valid 6-character hex colors", () => {
      expect(isValidHexColor("ffffff")).toBe(true);
      expect(isValidHexColor("000000")).toBe(true);
      expect(isValidHexColor("abcdef")).toBe(true);
      expect(isValidHexColor("ABCDEF")).toBe(true);
      expect(isValidHexColor("123456")).toBe(true);
      expect(isValidHexColor("1a2b3c")).toBe(true);
    });

    test("rejects invalid hex colors", () => {
      expect(isValidHexColor("")).toBe(false);
      expect(isValidHexColor("ff")).toBe(false); // Too short
      expect(isValidHexColor("ffff")).toBe(false); // 4 chars
      expect(isValidHexColor("fffff")).toBe(false); // 5 chars
      expect(isValidHexColor("fffffff")).toBe(false); // 7 chars
      expect(isValidHexColor("gggggg")).toBe(false); // Invalid characters
      expect(isValidHexColor("#ffffff")).toBe(false); // Has hash
      expect(isValidHexColor("rgb(255,255,255)")).toBe(false);
    });
  });

  describe("sanitizeHexColor", () => {
    test("returns color without hash unchanged", () => {
      expect(sanitizeHexColor("ffffff")).toBe("ffffff");
      expect(sanitizeHexColor("000")).toBe("000");
    });

    test("removes leading hash", () => {
      expect(sanitizeHexColor("#ffffff")).toBe("ffffff");
      expect(sanitizeHexColor("#000")).toBe("000");
      expect(sanitizeHexColor("#abc")).toBe("abc");
    });

    test("throws ValidationError for invalid colors", () => {
      expect(() => sanitizeHexColor("gggggg")).toThrow(ValidationError);
      expect(() => sanitizeHexColor("#gggggg")).toThrow(ValidationError);
      expect(() => sanitizeHexColor("ff")).toThrow(ValidationError);
      expect(() => sanitizeHexColor("")).toThrow(ValidationError);
    });
  });
});

describe("URL Validator - validateUrl", () => {
  // Import validateUrl dynamically to test with different configs
  const { validateUrl } = require("../../src/utils/url-validator");

  test("rejects invalid URL format", async () => {
    await expect(validateUrl("not-a-url")).rejects.toThrow(ValidationError);
    await expect(validateUrl("")).rejects.toThrow(ValidationError);
    await expect(validateUrl("://missing-protocol.com")).rejects.toThrow(
      ValidationError,
    );
  });

  test("rejects non-HTTP/HTTPS protocols", async () => {
    await expect(validateUrl("file:///etc/passwd")).rejects.toThrow(
      ForbiddenError,
    );
    await expect(validateUrl("ftp://example.com/file.jpg")).rejects.toThrow(
      ForbiddenError,
    );
    await expect(validateUrl("javascript:alert(1)")).rejects.toThrow(
      ForbiddenError,
    );
    await expect(validateUrl("data:image/png;base64,abc")).rejects.toThrow(
      ForbiddenError,
    );
  });

  test("rejects blocked domains (localhost, etc.)", async () => {
    await expect(validateUrl("http://localhost/image.png")).rejects.toThrow(
      ForbiddenError,
    );
    await expect(validateUrl("http://127.0.0.1/image.png")).rejects.toThrow(
      ForbiddenError,
    );
    await expect(validateUrl("http://0.0.0.0/image.png")).rejects.toThrow(
      ForbiddenError,
    );
  });

  test("accepts valid external URLs", async () => {
    // These should not throw (they may warn about DNS if domain doesn't exist)
    const result = await validateUrl("https://example.com/image.png");
    expect(result).toBeInstanceOf(URL);
    expect(result.protocol).toBe("https:");
    expect(result.hostname).toBe("example.com");
  });
});
