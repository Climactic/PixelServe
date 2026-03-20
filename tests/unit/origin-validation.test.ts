import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createOriginGuard } from "../../src/middleware/origin-validator";

function createAppWithOriginValidation(allowedOrigins: string[]) {
  return new Elysia()
    .onRequest(createOriginGuard(allowedOrigins))
    .get("/", () => ({ status: "ok" }))
    .get("/health", () => ({ status: "healthy" }))
    .get("/image", () => ({ status: "ok" }));
}

describe("Origin Validation", () => {
  describe("when allowedOrigins is configured", () => {
    const app = createAppWithOriginValidation([
      "example.com",
      "https://trusted.io",
    ]);

    test("blocks requests without Origin or Referer headers", async () => {
      const response = await app.handle(new Request("http://localhost/"));
      expect(response.status).toBe(403);
    });

    test("allows requests with an allowed Origin (bare domain match)", async () => {
      const response = await app.handle(
        new Request("http://localhost/", {
          headers: { Origin: "https://example.com" },
        }),
      );
      expect(response.status).toBe(200);
    });

    test("allows requests with an allowed Origin (full URL match)", async () => {
      const response = await app.handle(
        new Request("http://localhost/", {
          headers: { Origin: "https://trusted.io" },
        }),
      );
      expect(response.status).toBe(200);
    });

    test("blocks requests with a disallowed Origin", async () => {
      const response = await app.handle(
        new Request("http://localhost/", {
          headers: { Origin: "https://evil.com" },
        }),
      );
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toBe("FORBIDDEN");
    });

    test("uses Referer as fallback when Origin is absent", async () => {
      const response = await app.handle(
        new Request("http://localhost/", {
          headers: { Referer: "https://example.com/page" },
        }),
      );
      expect(response.status).toBe(200);
    });

    test("blocks requests with disallowed Referer when Origin is absent", async () => {
      const response = await app.handle(
        new Request("http://localhost/", {
          headers: { Referer: "https://evil.com/page" },
        }),
      );
      expect(response.status).toBe(403);
    });

    test("always allows /health regardless of origin", async () => {
      const response = await app.handle(
        new Request("http://localhost/health", {
          headers: { Origin: "https://evil.com" },
        }),
      );
      expect(response.status).toBe(200);
    });

    test("allows subdomain matching", async () => {
      const response = await app.handle(
        new Request("http://localhost/", {
          headers: { Origin: "https://sub.example.com" },
        }),
      );
      expect(response.status).toBe(200);
    });

    test("allows deep subdomain matching", async () => {
      const response = await app.handle(
        new Request("http://localhost/", {
          headers: { Origin: "https://a.b.example.com" },
        }),
      );
      expect(response.status).toBe(200);
    });

    test("allows subdomain matching against full-URL allowed entry", async () => {
      const response = await app.handle(
        new Request("http://localhost/", {
          headers: { Origin: "https://sub.trusted.io" },
        }),
      );
      expect(response.status).toBe(200);
    });

    test("does not allow partial domain matches", async () => {
      const response = await app.handle(
        new Request("http://localhost/", {
          headers: { Origin: "https://notexample.com" },
        }),
      );
      expect(response.status).toBe(403);
    });

    test("blocks on non-health routes like /image", async () => {
      const response = await app.handle(
        new Request("http://localhost/image", {
          headers: { Origin: "https://evil.com" },
        }),
      );
      expect(response.status).toBe(403);
    });
  });

  describe("when allowedOrigins is empty (no restrictions)", () => {
    const app = createAppWithOriginValidation([]);

    test("allows all requests regardless of origin", async () => {
      const response = await app.handle(
        new Request("http://localhost/", {
          headers: { Origin: "https://anything.com" },
        }),
      );
      expect(response.status).toBe(200);
    });

    test("allows requests without any origin headers", async () => {
      const response = await app.handle(new Request("http://localhost/"));
      expect(response.status).toBe(200);
    });
  });
});
