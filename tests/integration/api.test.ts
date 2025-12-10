import { beforeAll, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import sharp from "sharp";
import { healthRoutes } from "../../src/routes/health";
// Create a test app instance (mimics production setup without starting a server)
import { imageRoutes } from "../../src/routes/image";
import { ogRoutes } from "../../src/routes/og";

// Create test app
const createTestApp = () => {
  return new Elysia()
    .onError(({ error, set }) => {
      // console.error("Test error:", error);
      set.status = 500;
      return {
        error: "INTERNAL_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      };
    })
    .get("/", () => ({
      name: "PixelServe",
      version: "1.0.0",
      endpoints: {
        image:
          "/image?url=<source>&w=<width>&h=<height>&format=<webp|avif|png|jpg>",
        og: "/og?title=<title>&description=<desc>&bg=<hex>&fg=<hex>",
        health: "/health",
      },
    }))
    .use(healthRoutes)
    .use(imageRoutes)
    .use(ogRoutes);
};

describe("API Integration Tests", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(() => {
    app = createTestApp();
  });

  describe("Root Endpoint", () => {
    test("GET / returns API info", async () => {
      const response = await app.handle(new Request("http://localhost/"));

      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.name).toBe("PixelServe");
      expect(json.version).toBe("1.0.0");
      expect(json.endpoints).toBeDefined();
      expect(json.endpoints.image).toBeDefined();
      expect(json.endpoints.og).toBeDefined();
      expect(json.endpoints.health).toBeDefined();
    });
  });

  describe("Health Endpoint", () => {
    test("GET /health returns health status", async () => {
      const response = await app.handle(new Request("http://localhost/health"));

      expect(response.status).toBe(200);

      const json = await response.json();
      // Status can be "ok" or "degraded" depending on cache accessibility
      expect(["ok", "degraded"]).toContain(json.status);
      expect(json.uptime).toBeGreaterThanOrEqual(0);
      expect(json.version).toBe("1.0.0");
      expect(json.cache).toBeDefined();
    });

    test("GET /health returns no-cache headers", async () => {
      const response = await app.handle(new Request("http://localhost/health"));

      const cacheControl = response.headers.get("Cache-Control");
      expect(cacheControl).toContain("no-cache");
      expect(cacheControl).toContain("no-store");
    });
  });

  describe("OG Image Endpoint", () => {
    test("GET /og generates PNG image with title", async () => {
      const response = await app.handle(
        new Request("http://localhost/og?title=Hello%20World"),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("image/png");

      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      expect(metadata.format).toBe("png");
      expect(metadata.width).toBe(1200);
      expect(metadata.height).toBe(630);
    });

    test("GET /og with custom dimensions", async () => {
      const response = await app.handle(
        new Request("http://localhost/og?title=Test&w=800&h=400"),
      );

      expect(response.status).toBe(200);

      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      expect(metadata.width).toBe(800);
      expect(metadata.height).toBe(400);
    });

    test("GET /og with description", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/og?title=Main%20Title&description=A%20description%20here",
        ),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("image/png");

      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      expect(metadata.format).toBe("png");
    });

    test("GET /og with custom colors", async () => {
      const response = await app.handle(
        new Request("http://localhost/og?title=Test&bg=0f172a&fg=f8fafc"),
      );

      expect(response.status).toBe(200);

      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      expect(metadata.format).toBe("png");
    });

    test("GET /og with titleColor and descColor", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/og?title=Test&description=Desc&titleColor=ff5500&descColor=888888",
        ),
      );

      expect(response.status).toBe(200);

      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      expect(metadata.format).toBe("png");
    });

    test("GET /og with template=gradient", async () => {
      const response = await app.handle(
        new Request("http://localhost/og?title=Gradient&template=gradient"),
      );

      expect(response.status).toBe(200);

      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      expect(metadata.format).toBe("png");
    });

    test("GET /og with template=modern", async () => {
      const response = await app.handle(
        new Request("http://localhost/og?title=Modern&template=modern"),
      );

      expect(response.status).toBe(200);

      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      expect(metadata.format).toBe("png");
    });

    test("GET /og with template=minimal", async () => {
      const response = await app.handle(
        new Request("http://localhost/og?title=Minimal&template=minimal"),
      );

      expect(response.status).toBe(200);

      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      expect(metadata.format).toBe("png");
    });

    test("GET /og with template=brand", async () => {
      const response = await app.handle(
        new Request("http://localhost/og?title=Brand&template=brand"),
      );

      expect(response.status).toBe(200);

      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      expect(metadata.format).toBe("png");
    });

    test("GET /og with template=blog", async () => {
      const response = await app.handle(
        new Request("http://localhost/og?title=Blog%20Post&template=blog"),
      );

      expect(response.status).toBe(200);

      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      expect(metadata.format).toBe("png");
    });

    test("GET /og with template=dark", async () => {
      const response = await app.handle(
        new Request("http://localhost/og?title=Dark%20Mode&template=dark"),
      );

      expect(response.status).toBe(200);

      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      expect(metadata.format).toBe("png");
    });

    test("GET /og with template=split", async () => {
      const response = await app.handle(
        new Request("http://localhost/og?title=Split%20Layout&template=split"),
      );

      expect(response.status).toBe(200);

      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      expect(metadata.format).toBe("png");
    });

    test("GET /og with unknown template falls back to default", async () => {
      const response = await app.handle(
        new Request("http://localhost/og?title=Test&template=nonexistent"),
      );

      expect(response.status).toBe(200);

      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      expect(metadata.format).toBe("png");
    });

    test("GET /og returns cache headers", async () => {
      const response = await app.handle(
        new Request("http://localhost/og?title=Test"),
      );

      const cacheControl = response.headers.get("Cache-Control");
      expect(cacheControl).toContain("public");
      expect(cacheControl).toContain("max-age=");
    });

    test("GET /og/templates returns template list", async () => {
      const response = await app.handle(
        new Request("http://localhost/og/templates"),
      );

      expect(response.status).toBe(200);

      const json = await response.json();
      // The response includes templates array at root level
      expect(json.templates).toBeInstanceOf(Array);
      expect(json.templates).toContain("default");
      expect(json.templates).toContain("gradient");
      expect(json.templates).toContain("modern");
      expect(json.templates).toContain("minimal");
      expect(json.templates).toContain("brand");
      expect(json.templates).toContain("blog");
      expect(json.templates).toContain("dark");
      expect(json.templates).toContain("split");
      // All templates are now loaded from JSON files
      expect(json.templatesDir).toBeDefined();
    });

    test("GET /og with extremely long title still works", async () => {
      const longTitle = "A".repeat(200);
      const response = await app.handle(
        new Request(
          `http://localhost/og?title=${encodeURIComponent(longTitle)}`,
        ),
      );

      expect(response.status).toBe(200);

      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      expect(metadata.format).toBe("png");
    });

    test("GET /og with special characters in title", async () => {
      const specialTitle = "Test & quotes";
      const response = await app.handle(
        new Request(
          `http://localhost/og?title=${encodeURIComponent(specialTitle)}`,
        ),
      );

      expect(response.status).toBe(200);

      const buffer = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(buffer).metadata();
      expect(metadata.format).toBe("png");
    });
  });

  describe("Image Processing Endpoint", () => {
    test("GET /image without url returns error", async () => {
      const response = await app.handle(new Request("http://localhost/image"));

      // Should return error for missing required param (422 from Elysia validation, or 500 if caught by error handler)
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test("GET /image with invalid url format returns error", async () => {
      const response = await app.handle(
        new Request("http://localhost/image?url=not-a-valid-url"),
      );

      // Should return validation error
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test("GET /image rejects localhost URLs (SSRF prevention)", async () => {
      const response = await app.handle(
        new Request("http://localhost/image?url=http://localhost/test.png"),
      );

      // Should block - error may be 403 or 500 depending on error handling
      expect(response.status).toBeGreaterThanOrEqual(400);

      // Verify it's an error response
      const json = await response.json();
      expect(json.error).toBeDefined();
    });

    test("GET /image rejects 127.0.0.1 URLs (SSRF prevention)", async () => {
      const response = await app.handle(
        new Request("http://localhost/image?url=http://127.0.0.1/test.png"),
      );

      // Should block - error may be 403 or 500 depending on error handling
      expect(response.status).toBeGreaterThanOrEqual(400);

      const json = await response.json();
      expect(json.error).toBeDefined();
    });

    test("GET /image rejects file:// protocol", async () => {
      const response = await app.handle(
        new Request("http://localhost/image?url=file:///etc/passwd"),
      );

      // Should block - error may be 403 or 500 depending on error handling
      expect(response.status).toBeGreaterThanOrEqual(400);

      const json = await response.json();
      expect(json.error).toBeDefined();
    });
  });
});
