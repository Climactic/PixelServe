import { Elysia, t } from "elysia";
import {
  generateCacheKey,
  getCached,
  getCacheHeaders,
  setCache,
} from "../services/cache";
import {
  generateOGImage,
  getAvailableTemplates,
  getSuggestedFonts,
  getTemplateInfo,
} from "../services/og-generator";
import type { OGParams } from "../types";
import { PixelServeError } from "../utils/errors";

const ogQuerySchema = t.Object({
  title: t.Optional(t.String({ maxLength: 200 })),
  description: t.Optional(t.String({ maxLength: 500 })),
  template: t.Optional(t.String()),
  bg: t.Optional(t.String({ pattern: "^[0-9A-Fa-f]{3,6}$" })),
  fg: t.Optional(t.String({ pattern: "^[0-9A-Fa-f]{3,6}$" })),
  // Extended color options
  titleColor: t.Optional(t.String({ pattern: "^[0-9A-Fa-f]{3,6}$" })),
  descColor: t.Optional(t.String({ pattern: "^[0-9A-Fa-f]{3,6}$" })),
  accentColor: t.Optional(t.String({ pattern: "^[0-9A-Fa-f]{3,6}$" })),
  // Images
  image: t.Optional(t.String()),
  logo: t.Optional(t.String()),
  w: t.Optional(t.Numeric({ minimum: 100, maximum: 2400 })),
  h: t.Optional(t.Numeric({ minimum: 100, maximum: 1260 })),
  // Inline template config (base64-encoded JSON or URL-encoded JSON)
  config: t.Optional(t.String({ maxLength: 10000 })),
  // Font options
  font: t.Optional(t.String({ maxLength: 50 })),
});

export const ogRoutes = new Elysia({ prefix: "/og" })
  .onError(({ error, set }) => {
    if (error instanceof PixelServeError) {
      set.status = error.statusCode;
      return {
        error: error.code,
        message: error.message,
      };
    }

    console.error("OG generation error:", error);
    set.status = 500;
    return {
      error: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    };
  })
  // List available templates
  .get("/templates", async () => {
    const info = getTemplateInfo();
    const suggestedFonts = getSuggestedFonts();
    return {
      templates: getAvailableTemplates(),
      templatesDir: info.templatesDir,
      fonts: {
        suggested: suggestedFonts,
        default: "Inter",
        note: "Any Google Font can be used - fonts are loaded dynamically via Coolify Fonts API",
        usage:
          "Add ?font=<name> to your /og request (e.g., ?font=Poppins, ?font=Playfair+Display)",
      },
      howToAdd: "Place JSON template files in the templates directory",
      inline: {
        description:
          "Pass a complete template config via URL using the 'config' parameter",
        encoding: "Base64-encoded JSON or URL-encoded JSON",
        example:
          "?config=<base64-encoded-template>&title=Hello - template config takes priority over 'template' param",
        maxLength: 10000,
        schema: {
          name: "string (optional)",
          layout: {
            backgroundColor: "string (hex color or CSS)",
            backgroundGradient: "string (CSS gradient)",
            padding: "number",
            fontFamily: "string (font name from available fonts)",
            direction: "column | row",
            align: "start | center | end",
            justify: "start | center | end | between",
            elements: [
              {
                type: "text | image | box | spacer",
                content: "string (supports {{title}}, {{description}}, etc.)",
                fontSize: "number",
                fontWeight: "number",
                color: "string",
                src: "string (for images, supports {{logo}}, {{image}})",
                width: "number",
                height: "number",
                showIf: "title | description | logo | image",
              },
            ],
          },
        },
      },
      usage:
        "Add ?template=<name>&font=<font> or ?config=<base64-json> to your /og request",
    };
  })
  .get(
    "/",
    async ({ query, set }) => {
      const params: OGParams = {
        title: query.title,
        description: query.description,
        template: query.template,
        bg: query.bg,
        fg: query.fg,
        titleColor: query.titleColor,
        descColor: query.descColor,
        accentColor: query.accentColor,
        image: query.image,
        logo: query.logo,
        w: query.w,
        h: query.h,
        config: query.config,
        font: query.font,
      };

      // Generate cache key
      const cacheKey = generateCacheKey({
        type: "og",
        ...params,
      } as Record<string, string | number | boolean | undefined>);

      // Check cache
      const cached = await getCached(cacheKey);
      if (cached) {
        const headers = getCacheHeaders("png");
        set.headers = headers;
        return new Response(cached, { headers });
      }

      // Generate OG image
      const buffer = await generateOGImage(params);

      // Store in cache
      setCache(cacheKey, buffer, "png").catch((err) =>
        console.error("Cache write error:", err),
      );

      // Return response
      const headers = getCacheHeaders("png");
      set.headers = headers;
      return new Response(buffer, { headers });
    },
    {
      query: ogQuerySchema,
    },
  );
