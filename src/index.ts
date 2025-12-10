import { Elysia } from "elysia";
import { config } from "./config";
import { healthRoutes } from "./routes/health";
import { imageRoutes } from "./routes/image";
import { ogRoutes } from "./routes/og";
import { startCacheCleanup } from "./services/cache";

// Ensure cache directory exists (only for disk mode)
if (config.cacheMode === "disk") {
  await Bun.$`mkdir -p ${config.cacheDir}`.quiet();
}

const app = new Elysia()
  .onError(({ error, code, set }) => {
    // Don't log Elysia's built-in NOT_FOUND errors (these are normal 404s)
    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        error: "NOT_FOUND",
        message: "Route not found",
      };
    }

    console.error("Unhandled error:", error);
    set.status = 500;
    return {
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    };
  })
  // Root endpoint with API info
  .get("/", () => ({
    name: "PixelServe",
    version: "1.0.0",
    endpoints: {
      image:
        "/image?url=<source>&w=<width>&h=<height>&format=<webp|avif|png|jpg>",
      og: "/og?title=<title>&description=<desc>&bg=<hex>&fg=<hex>",
      health: "/health",
    },
    documentation: "https://github.com/your-repo/pixelserve",
  }))
  .use(healthRoutes)
  .use(imageRoutes)
  .use(ogRoutes)
  .listen(config.port);

// Start background cache cleanup (every hour)
startCacheCleanup(3600000);

// Build cache info string based on mode
function getCacheInfo(): string {
  switch (config.cacheMode) {
    case "disk":
      return `disk (${config.cacheDir})`;
    case "memory":
      return `memory (max ${config.maxMemoryCacheItems} items)`;
    case "none":
      return "disabled";
  }
}

console.log(`
╔═══════════════════════════════════════════════════════╗
║                    PixelServe                         ║
╠═══════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${config.port.toString().padEnd(5)}            ║
║                                                       ║
║  Endpoints:                                           ║
║    GET /image  - Image processing                     ║
║    GET /og     - OG image generation                  ║
║    GET /health - Health check                         ║
║                                                       ║
║  Cache: ${getCacheInfo().padEnd(43)} ║
╚═══════════════════════════════════════════════════════╝
`);

export type App = typeof app;
