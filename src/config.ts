import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

// Schema definitions
const CacheModeSchema = Type.Union([
  Type.Literal("disk"),
  Type.Literal("memory"),
  Type.Literal("hybrid"),
  Type.Literal("none"),
]);

const ImageFormatSchema = Type.Union([
  Type.Literal("webp"),
  Type.Literal("avif"),
  Type.Literal("png"),
  Type.Literal("jpg"),
  Type.Literal("jpeg"),
  Type.Literal("gif"),
]);

const ConfigSchema = Type.Object({
  // Server
  port: Type.Number({ default: 3000, minimum: 1, maximum: 65535 }),

  // Cache settings
  cacheMode: Type.Optional(CacheModeSchema),
  cacheDir: Type.String({ default: "./cache" }),
  cacheTTL: Type.Number({ default: 86400, minimum: 0 }), // 24 hours in seconds
  maxCacheSize: Type.Number({ default: 1073741824, minimum: 0 }), // 1GB
  maxMemoryCacheItems: Type.Number({ default: 1000, minimum: 1 }),

  // Security
  allowedDomains: Type.Array(Type.String(), { default: [] }),
  allowedOrigins: Type.Array(Type.String(), { default: [] }),
  blockedDomains: Type.Array(Type.String(), {
    default: ["localhost", "127.0.0.1", "0.0.0.0", "::1"],
  }),
  allowSelfReference: Type.Boolean({ default: false }), // Allow fetching from own /og endpoint
  maxImageSize: Type.Number({ default: 10485760, minimum: 0 }), // 10MB
  requestTimeout: Type.Number({ default: 30000, minimum: 0 }), // 30s

  // Image defaults
  defaultQuality: Type.Number({ default: 80, minimum: 1, maximum: 100 }),
  defaultFormat: Type.Optional(ImageFormatSchema),
  maxWidth: Type.Number({ default: 4096, minimum: 1 }),
  maxHeight: Type.Number({ default: 4096, minimum: 1 }),

  // Cache headers
  browserCacheTTL: Type.Number({ default: 31536000, minimum: 0 }), // 1 year

  // OG image defaults
  ogDefaultWidth: Type.Number({ default: 1200, minimum: 1 }),
  ogDefaultHeight: Type.Number({ default: 630, minimum: 1 }),
  ogDefaultBg: Type.String({ default: "1a1a2e" }),
  ogDefaultFg: Type.String({ default: "ffffff" }),

  // Custom templates directory
  templatesDir: Type.String({ default: "./templates" }),
});

// Helper to parse comma-separated list
function parseList(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Helper to parse comma-separated list with lowercase
function parseListLower(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Parse environment variables into raw config object
const rawConfig = {
  port: parseInt(process.env.PORT || "3000", 10),
  cacheMode: (process.env.CACHE_MODE || "disk").toLowerCase(),
  cacheDir: process.env.CACHE_DIR || "./cache",
  cacheTTL: parseInt(process.env.CACHE_TTL || "86400", 10),
  maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE || "1073741824", 10),
  maxMemoryCacheItems: parseInt(
    process.env.MAX_MEMORY_CACHE_ITEMS || "1000",
    10,
  ),
  allowedDomains: parseListLower(process.env.ALLOWED_DOMAINS),
  allowedOrigins: parseList(process.env.ALLOWED_ORIGINS),
  blockedDomains: ["localhost", "127.0.0.1", "0.0.0.0", "::1"],
  allowSelfReference: process.env.ALLOW_SELF_REFERENCE === "true",
  maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE || "10485760", 10),
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || "30000", 10),
  defaultQuality: 80,
  defaultFormat: "webp",
  maxWidth: 4096,
  maxHeight: 4096,
  browserCacheTTL: parseInt(process.env.BROWSER_CACHE_TTL || "31536000", 10),
  ogDefaultWidth: 1200,
  ogDefaultHeight: 630,
  ogDefaultBg: "1a1a2e",
  ogDefaultFg: "ffffff",
  templatesDir: process.env.TEMPLATES_DIR || "./templates",
};

// Validate and apply defaults
if (!Value.Check(ConfigSchema, rawConfig)) {
  const errors = [...Value.Errors(ConfigSchema, rawConfig)];
  console.error("Invalid configuration:");
  for (const error of errors) {
    console.error(`  ${error.path}: ${error.message}`);
  }
  process.exit(1);
}

// Export validated config
export const config = rawConfig as Static<typeof ConfigSchema> & {
  cacheMode: CacheMode;
  defaultFormat: "webp" | "avif" | "png" | "jpg" | "jpeg" | "gif";
};

// Export types
export type CacheMode = Static<typeof CacheModeSchema>;
export type Config = typeof config;
