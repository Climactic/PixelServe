export type CacheMode = "disk" | "memory" | "none";

function parseCacheMode(value: string | undefined): CacheMode {
  const mode = (value || "disk").toLowerCase();
  if (mode === "memory" || mode === "none" || mode === "disk") {
    return mode;
  }
  return "disk";
}

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),

  // Cache settings
  cacheMode: parseCacheMode(process.env.CACHE_MODE),
  cacheDir: process.env.CACHE_DIR || "./cache",
  cacheTTL: parseInt(process.env.CACHE_TTL || "86400", 10), // 24 hours in seconds
  maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE || "1073741824", 10), // 1GB
  maxMemoryCacheItems: parseInt(
    process.env.MAX_MEMORY_CACHE_ITEMS || "1000",
    10,
  ), // Max items in memory cache

  // Security
  allowedDomains: (process.env.ALLOWED_DOMAINS || "")
    .split(",")
    .filter(Boolean),
  blockedDomains: ["localhost", "127.0.0.1", "0.0.0.0", "::1"],
  maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE || "10485760", 10), // 10MB
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || "30000", 10), // 30s

  // Image defaults
  defaultQuality: 80,
  defaultFormat: "webp" as const,
  maxWidth: 4096,
  maxHeight: 4096,

  // Cache headers
  browserCacheTTL: parseInt(process.env.BROWSER_CACHE_TTL || "31536000", 10), // 1 year

  // OG image defaults
  ogDefaultWidth: 1200,
  ogDefaultHeight: 630,
  ogDefaultBg: "1a1a2e",
  ogDefaultFg: "ffffff",

  // Custom templates directory
  templatesDir: process.env.TEMPLATES_DIR || "./templates",
} as const;

export type Config = typeof config;
