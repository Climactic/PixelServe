import { describe, expect, test } from "bun:test";
import { generateCacheKey, getCacheHeaders } from "../../src/services/cache";

describe("Cache Service", () => {
  describe("generateCacheKey", () => {
    test("generates consistent hash for same params", () => {
      const params = { url: "https://example.com/image.png", w: 800, h: 600 };
      const key1 = generateCacheKey(params);
      const key2 = generateCacheKey(params);
      expect(key1).toBe(key2);
    });

    test("generates different hashes for different params", () => {
      const params1 = { url: "https://example.com/image.png", w: 800 };
      const params2 = { url: "https://example.com/image.png", w: 900 };
      const key1 = generateCacheKey(params1);
      const key2 = generateCacheKey(params2);
      expect(key1).not.toBe(key2);
    });

    test("ignores undefined values", () => {
      const params1 = {
        url: "https://example.com/image.png",
        w: 800,
        h: undefined,
      };
      const params2 = { url: "https://example.com/image.png", w: 800 };
      const key1 = generateCacheKey(params1);
      const key2 = generateCacheKey(params2);
      expect(key1).toBe(key2);
    });

    test("is order-independent (params sorted)", () => {
      const params1 = { w: 800, url: "https://example.com/image.png", h: 600 };
      const params2 = { url: "https://example.com/image.png", h: 600, w: 800 };
      const key1 = generateCacheKey(params1);
      const key2 = generateCacheKey(params2);
      expect(key1).toBe(key2);
    });

    test("produces SHA256 hash (64 hex characters)", () => {
      const params = { url: "https://example.com/image.png" };
      const key = generateCacheKey(params);
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });

    test("handles boolean values", () => {
      const params1 = { url: "https://example.com/image.png", grayscale: true };
      const params2 = {
        url: "https://example.com/image.png",
        grayscale: false,
      };
      const key1 = generateCacheKey(params1);
      const key2 = generateCacheKey(params2);
      expect(key1).not.toBe(key2);
    });

    test("handles empty params object", () => {
      const key = generateCacheKey({});
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });

    test("handles special characters in URL", () => {
      const params = { url: "https://example.com/image.png?foo=bar&baz=qux" };
      const key = generateCacheKey(params);
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("getCacheHeaders", () => {
    test("returns correct Content-Type for webp", () => {
      const headers = getCacheHeaders("webp");
      expect(headers["Content-Type"]).toBe("image/webp");
    });

    test("returns correct Content-Type for avif", () => {
      const headers = getCacheHeaders("avif");
      expect(headers["Content-Type"]).toBe("image/avif");
    });

    test("returns correct Content-Type for png", () => {
      const headers = getCacheHeaders("png");
      expect(headers["Content-Type"]).toBe("image/png");
    });

    test("returns correct Content-Type for jpg", () => {
      const headers = getCacheHeaders("jpg");
      expect(headers["Content-Type"]).toBe("image/jpeg");
    });

    test("returns correct Content-Type for jpeg", () => {
      const headers = getCacheHeaders("jpeg");
      expect(headers["Content-Type"]).toBe("image/jpeg");
    });

    test("returns correct Content-Type for gif", () => {
      const headers = getCacheHeaders("gif");
      expect(headers["Content-Type"]).toBe("image/gif");
    });

    test("includes Cache-Control header", () => {
      const headers = getCacheHeaders("webp");
      expect(headers["Cache-Control"]).toContain("public");
      expect(headers["Cache-Control"]).toContain("max-age=");
      expect(headers["Cache-Control"]).toContain("immutable");
    });

    test("includes Vary header", () => {
      const headers = getCacheHeaders("webp");
      expect(headers.Vary).toBe("Accept");
    });

    test("returns all expected headers", () => {
      const headers = getCacheHeaders("webp");
      expect(Object.keys(headers)).toContain("Content-Type");
      expect(Object.keys(headers)).toContain("Cache-Control");
      expect(Object.keys(headers)).toContain("Vary");
    });
  });
});
