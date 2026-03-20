import { createHash } from "node:crypto";
import { join } from "node:path";
import { RedisClient } from "bun";
import { type CacheMode, config } from "../config";
import type { ImageFormat } from "../types";

// In-memory LRU cache implementation
interface MemoryCacheEntry {
  data: Buffer;
  createdAt: number;
}

class LRUCache {
  private cache = new Map<string, MemoryCacheEntry>();
  private maxItems: number;

  constructor(maxItems: number) {
    this.maxItems = maxItems;
  }

  get(key: string): Buffer | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    const age = Date.now() - entry.createdAt;
    if (age > config.cacheTTL * 1000) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  set(key: string, data: Buffer): void {
    // Remove oldest entries if at capacity
    while (this.cache.size >= this.maxItems) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      } else {
        break;
      }
    }

    this.cache.set(key, {
      data,
      createdAt: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Remove expired entries
  cleanup(): number {
    const now = Date.now();
    const ttlMs = config.cacheTTL * 1000;
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.createdAt > ttlMs) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

// Initialize memory cache
const memoryCache = new LRUCache(config.maxMemoryCacheItems);

// Redis client state
let redisClient: RedisClient | null = null;
let redisConnected = false;

export async function initRedisCache(): Promise<void> {
  if (config.cacheMode !== "redis") return;

  try {
    redisClient = new RedisClient(config.redisUrl, {
      connectionTimeout: config.redisConnectionTimeout,
      autoReconnect: true,
      maxRetries: config.redisMaxRetries,
      enableOfflineQueue: true,
      enableAutoPipelining: true,
    });
    await redisClient.connect();
    redisConnected = true;
    console.log("Redis cache connected");
  } catch (error) {
    console.error("Redis connection failed:", error);
    redisConnected = false;
  }
}

export async function disconnectRedisCache(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      // Ignore disconnect errors during shutdown
    }
    redisClient = null;
    redisConnected = false;
  }
}

function redisKey(key: string): string {
  return `${config.redisKeyPrefix}${key}`;
}

// Redis cache operations
async function getRedisCached(key: string): Promise<Buffer | null> {
  if (!redisClient || !redisConnected) return null;
  try {
    const data = await redisClient.getBuffer(redisKey(key));
    return data ? Buffer.from(data) : null;
  } catch (error) {
    console.error("Redis get error:", error);
    return null;
  }
}

async function setRedisCache(key: string, data: Buffer): Promise<void> {
  if (!redisClient || !redisConnected) return;
  try {
    await redisClient.set(redisKey(key), data, "EX", config.cacheTTL);
  } catch (error) {
    console.error("Redis set error:", error);
  }
}

export function generateCacheKey(
  params: Record<string, string | number | boolean | undefined>,
): string {
  // Filter out undefined values and sort keys for consistent hashing
  const filtered = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  return createHash("sha256").update(filtered).digest("hex");
}

function getCachePath(key: string): string {
  // Shard by first 2 characters to avoid too many files in one directory
  const shard = key.substring(0, 2);
  return join(config.cacheDir, shard, key);
}

// Disk cache operations
async function getDiskCached(key: string): Promise<Buffer | null> {
  const path = getCachePath(key);
  const file = Bun.file(path);

  if (await file.exists()) {
    try {
      const stat = await file.stat();
      const age = Date.now() - stat.mtime.getTime();

      if (age < config.cacheTTL * 1000) {
        return Buffer.from(await file.arrayBuffer());
      }

      // Expired - delete in background
      Bun.$`rm -f ${path}`.quiet().catch(() => {});
    } catch {
      // File might have been deleted between exists check and read
      return null;
    }
  }

  return null;
}

async function setDiskCache(key: string, data: Buffer): Promise<void> {
  const path = getCachePath(key);
  const dir = join(config.cacheDir, key.substring(0, 2));

  try {
    // Ensure directory exists
    await Bun.$`mkdir -p ${dir}`.quiet();
    await Bun.write(path, data);
  } catch (error) {
    // Cache write failure is non-fatal
    console.error("Cache write failed:", error);
  }
}

// Memory cache operations
function getMemoryCached(key: string): Buffer | null {
  return memoryCache.get(key);
}

function setMemoryCache(key: string, data: Buffer): void {
  memoryCache.set(key, data);
}

// Unified cache interface
export async function getCached(key: string): Promise<Buffer | null> {
  switch (config.cacheMode) {
    case "disk":
      return getDiskCached(key);
    case "memory":
      return getMemoryCached(key);
    case "hybrid": {
      // Try memory first (L1), then disk (L2)
      const memoryHit = getMemoryCached(key);
      if (memoryHit) return memoryHit;

      const diskHit = await getDiskCached(key);
      if (diskHit) {
        // Promote to memory cache
        setMemoryCache(key, diskHit);
      }
      return diskHit;
    }
    case "redis":
      return getRedisCached(key);
    case "none":
      return null;
    default:
      return null;
  }
}

export async function setCache(
  key: string,
  data: Buffer,
  _format: ImageFormat,
): Promise<void> {
  switch (config.cacheMode) {
    case "disk":
      return setDiskCache(key, data);
    case "memory":
      setMemoryCache(key, data);
      return;
    case "hybrid":
      // Write to both memory (L1) and disk (L2)
      setMemoryCache(key, data);
      return setDiskCache(key, data);
    case "redis":
      return setRedisCache(key, data);
    case "none":
      return;
  }
}

const MIME_TYPES: Record<string, string> = {
  webp: "image/webp",
  avif: "image/avif",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
};

export function getCacheHeaders(format: ImageFormat): Record<string, string> {
  return {
    "Content-Type": MIME_TYPES[format] || "image/jpeg",
    "Cache-Control": `public, max-age=${config.browserCacheTTL}, immutable`,
    Vary: "Accept",
  };
}

// Background cache cleanup - runs periodically to remove expired entries
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

async function cleanupDiskCache(): Promise<number> {
  const maxAgeMinutes = Math.floor(config.cacheTTL / 60);
  let deleted = 0;

  try {
    const result =
      await Bun.$`find ${config.cacheDir} -type f -mmin +${maxAgeMinutes} 2>/dev/null`.text();
    const oldFiles = result.split("\n").filter(Boolean);

    for (const file of oldFiles) {
      try {
        await Bun.$`rm -f ${file}`.quiet();
        deleted++;
      } catch {
        // Ignore individual file deletion errors
      }
    }
  } catch {
    // Find command might fail if cache dir doesn't exist yet
  }

  return deleted;
}

export async function cleanupCache(): Promise<number> {
  switch (config.cacheMode) {
    case "none":
    case "redis":
      return 0;
    case "memory":
      return memoryCache.cleanup();
    case "disk":
      return cleanupDiskCache();
    case "hybrid": {
      // Clean both caches
      const memoryDeleted = memoryCache.cleanup();
      const diskDeleted = await cleanupDiskCache();
      return memoryDeleted + diskDeleted;
    }
  }
}

export function startCacheCleanup(intervalMs: number = 3600000): void {
  if (cleanupInterval) return;
  if (config.cacheMode === "none" || config.cacheMode === "redis") return;

  cleanupInterval = setInterval(async () => {
    const deleted = await cleanupCache();
    if (deleted > 0) {
      console.log(`Cache cleanup: removed ${deleted} expired entries`);
    }
  }, intervalMs);

  // Don't prevent process from exiting
  cleanupInterval.unref();
}

export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Mask credentials in Redis URL for display
function maskRedisUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "***";
    }
    return parsed.toString();
  } catch {
    return url.replace(/:\/\/[^@]*@/, "://***@");
  }
}

// Export for health check
export function getCacheStats(): {
  mode: CacheMode;
  items?: number;
  directory?: string;
  connected?: boolean;
  url?: string;
} {
  switch (config.cacheMode) {
    case "memory":
      return { mode: "memory", items: memoryCache.size() };
    case "disk":
      return { mode: "disk", directory: config.cacheDir };
    case "hybrid":
      return {
        mode: "hybrid",
        items: memoryCache.size(),
        directory: config.cacheDir,
      };
    case "redis":
      return {
        mode: "redis",
        connected: redisConnected,
        url: maskRedisUrl(config.redisUrl),
      };
    case "none":
      return { mode: "none" };
  }
}
