import { Elysia } from "elysia";
import { config } from "../config";
import { getCacheStats } from "../services/cache";

const startTime = Date.now();

export const healthRoutes = new Elysia().get("/health", async ({ set }) => {
  const cacheStats = getCacheStats();

  const status = {
    status: "ok" as "ok" | "degraded",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    cache: cacheStats,
    version: "1.0.0",
  };

  // Check disk cache directory exists if using disk mode
  if (config.cacheMode === "disk") {
    const cacheDir = Bun.file(config.cacheDir);
    const cacheExists = await cacheDir.exists().catch(() => false);
    if (!cacheExists) {
      status.status = "degraded";
    }
  }

  set.headers = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
  };

  return status;
});
