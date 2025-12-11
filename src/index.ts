import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { config } from "./config";
import { healthRoutes } from "./routes/health";
import { imageRoutes } from "./routes/image";
import { ogRoutes } from "./routes/og";
import { startCacheCleanup } from "./services/cache";

// Ensure cache directory exists (for disk and hybrid modes)
if (config.cacheMode === "disk" || config.cacheMode === "hybrid") {
  await Bun.$`mkdir -p ${config.cacheDir}`.quiet();
}

const app = new Elysia()
  .use(
    cors({
      origin: config.allowedOrigins.length > 0 ? config.allowedOrigins : true,
    }),
  )
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
    documentation: "https://github.com/climactic/pixelserve",
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
    case "hybrid":
      return `hybrid (memory + ${config.cacheDir})`;
    case "none":
      return "disabled";
  }
}

// ANSI color codes
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

console.log(`
${c.magenta}  ____  _          _ ____
 |  _ \\(_)_  _____| / ___|  ___ _ ____   _____
 | |_) | \\ \\/ / _ \\ \\___ \\ / _ \\ '__\\ \\ / / _ \\
 |  __/| |>  <  __/ |___) |  __/ |   \\ V /  __/
 |_|   |_/_/\\_\\___|_|____/ \\___|_|    \\_/ \\___|${c.reset}

  ${c.dim}High-performance image processing microservice${c.reset}

  ${c.bold}Server:${c.reset}    ${c.cyan}http://localhost:${config.port}${c.reset}
  ${c.bold}Cache:${c.reset}     ${c.yellow}${getCacheInfo()}${c.reset}

  ${c.bold}Endpoints:${c.reset}
    ${c.green}/image${c.reset}   Transform and optimize images
    ${c.green}/og${c.reset}      Generate Open Graph images
    ${c.green}/health${c.reset}  Health check & stats

  ${c.bold}Links:${c.reset}
    ${c.dim}GitHub:${c.reset}  ${c.blue}https://github.com/climactic/pixelserve${c.reset}
    ${c.dim}Sponsor:${c.reset} ${c.magenta}https://github.com/sponsors/climactic${c.reset}
    ${c.dim}Discord:${c.reset} ${c.blue}https://go.climactic.co/discord${c.reset}
`);

export type App = typeof app;
