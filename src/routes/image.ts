import { Elysia, t } from "elysia";
import {
  generateCacheKey,
  getCached,
  getCacheHeaders,
  setCache,
} from "../services/cache";
import { processImage } from "../services/image-processor";
import type { ImageParams } from "../types";
import { PixelServeError } from "../utils/errors";

const imageQuerySchema = t.Object({
  url: t.String({ minLength: 1 }),
  w: t.Optional(t.Numeric({ minimum: 1, maximum: 4096 })),
  h: t.Optional(t.Numeric({ minimum: 1, maximum: 4096 })),
  size: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  fit: t.Optional(
    t.Union([
      t.Literal("cover"),
      t.Literal("contain"),
      t.Literal("fill"),
      t.Literal("inside"),
      t.Literal("outside"),
    ]),
  ),
  position: t.Optional(
    t.Union([
      t.Literal("center"),
      t.Literal("top"),
      t.Literal("right"),
      t.Literal("bottom"),
      t.Literal("left"),
      t.Literal("top left"),
      t.Literal("top right"),
      t.Literal("bottom left"),
      t.Literal("bottom right"),
      t.Literal("entropy"),
      t.Literal("attention"),
    ]),
  ),
  q: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  format: t.Optional(
    t.Union([
      t.Literal("webp"),
      t.Literal("avif"),
      t.Literal("png"),
      t.Literal("jpg"),
      t.Literal("jpeg"),
      t.Literal("gif"),
    ]),
  ),
  blur: t.Optional(t.Numeric({ minimum: 0.3, maximum: 1000 })),
  grayscale: t.Optional(t.BooleanString()),
  rotate: t.Optional(t.Numeric()),
  flip: t.Optional(t.BooleanString()),
  flop: t.Optional(t.BooleanString()),
  brightness: t.Optional(t.Numeric({ minimum: 0 })),
  saturation: t.Optional(t.Numeric({ minimum: 0 })),
  sharpen: t.Optional(t.Numeric({ minimum: 0 })),
  tint: t.Optional(t.String({ pattern: "^[0-9A-Fa-f]{3,6}$" })),
  trim: t.Optional(t.BooleanString()),
  crop: t.Optional(t.String({ pattern: "^\\d+,\\d+,\\d+,\\d+$" })),
  wm_image: t.Optional(t.String()),
  wm_position: t.Optional(
    t.Union([
      t.Literal("center"),
      t.Literal("top"),
      t.Literal("top left"),
      t.Literal("top right"),
      t.Literal("bottom"),
      t.Literal("bottom left"),
      t.Literal("bottom right"),
      t.Literal("left"),
      t.Literal("right"),
    ]),
  ),
  wm_opacity: t.Optional(t.Numeric({ minimum: 0, maximum: 1 })),
  wm_scale: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  wm_padding: t.Optional(t.Numeric({ minimum: 0, maximum: 500 })),
  wm_text: t.Optional(t.String()),
  wm_font: t.Optional(t.String()),
  wm_fontsize: t.Optional(t.Numeric({ minimum: 8, maximum: 200 })),
  wm_color: t.Optional(t.String({ pattern: "^[0-9A-Fa-f]{3,8}$" })),
});

export const imageRoutes = new Elysia({ prefix: "/image" })
  .onError(({ error, set }) => {
    if (error instanceof PixelServeError) {
      set.status = error.statusCode;
      return {
        error: error.code,
        message: error.message,
      };
    }

    console.error("Unexpected error:", error);
    set.status = 500;
    return {
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    };
  })
  .get(
    "/",
    async ({ query, set }) => {
      const params: ImageParams = {
        url: query.url,
        w: query.w,
        h: query.h,
        size: query.size,
        fit: query.fit,
        position: query.position,
        q: query.q,
        format: query.format,
        blur: query.blur,
        grayscale: query.grayscale,
        rotate: query.rotate,
        flip: query.flip,
        flop: query.flop,
        brightness: query.brightness,
        saturation: query.saturation,
        sharpen: query.sharpen,
        tint: query.tint,
        trim: query.trim,
        crop: query.crop,
        wm_image: query.wm_image,
        wm_text: query.wm_text,
        wm_position: query.wm_position,
        wm_opacity: query.wm_opacity,
        wm_scale: query.wm_scale,
        wm_padding: query.wm_padding,
        wm_font: query.wm_font,
        wm_fontsize: query.wm_fontsize,
        wm_color: query.wm_color,
      };

      // Generate cache key from all parameters
      const cacheKey = generateCacheKey(
        params as Record<string, string | number | boolean | undefined>,
      );

      // Check cache
      const cached = await getCached(cacheKey);
      if (cached) {
        const format = params.format || "webp";
        const headers = getCacheHeaders(format);
        set.headers = headers;
        return new Response(cached, { headers });
      }

      // Process image
      const { buffer, format } = await processImage(params);

      // Store in cache (async, don't wait)
      setCache(cacheKey, buffer, format).catch((err) =>
        console.error("Cache write error:", err),
      );

      // Return response with proper headers
      const headers = getCacheHeaders(format);
      set.headers = headers;
      return new Response(buffer, { headers });
    },
    {
      query: imageQuerySchema,
    },
  );
