import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { config } from "../config";
import type { OGParams } from "../types";
import { ImageProcessingError } from "../utils/errors";
import {
  getSuggestedFonts,
  isFontSupported,
  loadFontsForSatori,
  preloadDefaultFonts,
} from "./fonts";

// Preload default fonts at startup
let defaultFontsLoaded = false;
async function ensureDefaultFontsLoaded(): Promise<void> {
  if (defaultFontsLoaded) return;
  await preloadDefaultFonts();
  defaultFontsLoaded = true;
}

// Templates support (all loaded from JSON files)
import {
  buildTemplateFromConfig,
  type ElementNode,
  getCustomTemplate,
  getCustomTemplateNames,
  loadCustomTemplates,
  parseInlineTemplateConfig,
  validateTemplateConfig,
} from "./custom-templates";

let templatesLoaded = false;

export async function initTemplates(): Promise<void> {
  if (templatesLoaded) return;
  await loadCustomTemplates(config.templatesDir);
  templatesLoaded = true;
}

export function getAvailableTemplates(): string[] {
  return getCustomTemplateNames();
}

export function getTemplateInfo(): {
  templates: string[];
  templatesDir: string;
} {
  return {
    templates: getCustomTemplateNames(),
    templatesDir: config.templatesDir,
  };
}

export { getSuggestedFonts };

export async function generateOGImage(params: OGParams): Promise<Buffer> {
  try {
    await ensureDefaultFontsLoaded();
    await initTemplates();

    const width = params.w || config.ogDefaultWidth;
    const height = params.h || config.ogDefaultHeight;

    // Determine font family to use
    const fontFamily =
      params.font && isFontSupported(params.font) ? params.font : "Inter";

    // Load fonts for the requested font family
    const fonts = await loadFontsForSatori(fontFamily, [400, 700]);
    if (fonts.length === 0) {
      throw new ImageProcessingError("Failed to load fonts");
    }

    let element: ElementNode;

    // Check for inline template config first (takes highest priority)
    if (params.config) {
      const inlineConfig = parseInlineTemplateConfig(params.config);
      if (!inlineConfig) {
        throw new ImageProcessingError(
          "Invalid inline template config: could not parse",
        );
      }

      const validation = validateTemplateConfig(inlineConfig);
      if (!validation.valid) {
        throw new ImageProcessingError(
          `Invalid inline template config: ${validation.error}`,
        );
      }

      element = buildTemplateFromConfig(inlineConfig, params, fontFamily);
    } else {
      // Get template from loaded templates
      const templateName = params.template || "default";

      const template = getCustomTemplate(templateName);
      if (template) {
        element = buildTemplateFromConfig(template, params, fontFamily);
      } else {
        // Fall back to default template if not found
        const defaultTemplate = getCustomTemplate("default");
        if (!defaultTemplate) {
          throw new ImageProcessingError(
            `Template "${templateName}" not found and no default template available`,
          );
        }
        element = buildTemplateFromConfig(defaultTemplate, params, fontFamily);
      }
    }

    // Generate SVG with Satori
    const svg = await satori(element as React.ReactNode, {
      width,
      height,
      fonts: fonts.map((f) => ({
        name: f.name,
        data: f.data,
        weight: f.weight,
        style: f.style,
      })),
    });

    // Convert SVG to PNG with resvg
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: width },
    });

    const pngData = resvg.render();
    return Buffer.from(pngData.asPng());
  } catch (error) {
    if (error instanceof ImageProcessingError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new ImageProcessingError(
        `OG image generation failed: ${error.message}`,
      );
    }
    throw new ImageProcessingError("OG image generation failed");
  }
}
