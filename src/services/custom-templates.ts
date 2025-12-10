import type { OGParams } from "../types";

// Custom template definition (JSON-based)
export interface CustomTemplateConfig {
  name: string;
  description?: string;
  layout: TemplateLayout;
}

export interface TemplateLayout {
  // Root container styles
  backgroundColor?: string;
  backgroundGradient?: string; // e.g., "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
  backgroundImage?: string; // URL or "{{image}}" to use params.image
  padding?: number;
  fontFamily?: string;

  // Layout direction
  direction?: "column" | "row";
  align?: "start" | "center" | "end";
  justify?: "start" | "center" | "end" | "between";

  // Elements to render
  elements: TemplateElement[];
}

export interface TemplateElement {
  type: "text" | "image" | "box" | "spacer";

  // For text elements
  content?: string; // Can include {{title}}, {{description}}, etc.
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  maxWidth?: number;
  lineHeight?: number;
  opacity?: number;

  // For image elements
  src?: string; // Can be {{logo}}, {{image}}, or a URL
  width?: number;
  height?: number;
  borderRadius?: number;

  // For box elements (containers)
  backgroundColor?: string;
  backgroundGradient?: string;
  padding?: number | string;
  margin?: number | string;
  direction?: "column" | "row";
  align?: "start" | "center" | "end";
  justify?: "start" | "center" | "end" | "between";
  children?: TemplateElement[];

  // For spacer
  size?: number;

  // Conditional rendering
  showIf?: string; // e.g., "logo", "description" - only show if param exists
}

export interface ElementNode {
  type: string;
  props: Record<string, unknown> & {
    children?: (ElementNode | string | null)[];
  };
}

function createElement(
  type: string,
  props: Record<string, unknown>,
  ...children: (ElementNode | string | null)[]
): ElementNode {
  return {
    type,
    props: {
      ...props,
      children: children.filter((c) => c !== null),
    },
  };
}

// Replace template variables like {{title}}, {{description}}, {{logo}}, {{image}}, colors, etc.
function replaceVariables(
  str: string | undefined | null,
  params: OGParams,
): string {
  if (!str) return "";
  const fg = params.fg || "ffffff";
  return (
    String(str)
      .replace(/\{\{title\}\}/g, params.title || "Untitled")
      .replace(/\{\{description\}\}/g, params.description || "")
      .replace(/\{\{logo\}\}/g, params.logo || "")
      .replace(/\{\{image\}\}/g, params.image || "")
      .replace(/\{\{bg\}\}/g, params.bg || "1a1a2e")
      .replace(/\{\{fg\}\}/g, fg)
      // Extended color options - fall back to fg if not specified
      .replace(/\{\{titleColor\}\}/g, params.titleColor || fg)
      .replace(
        /\{\{descColor\}\}/g,
        params.descColor || params.titleColor || fg,
      )
      .replace(/\{\{accentColor\}\}/g, params.accentColor || "3b82f6")
  );
}

// Check if a condition is met (for showIf)
function checkCondition(condition: string, params: OGParams): boolean {
  switch (condition) {
    case "title":
      return !!params.title;
    case "description":
      return !!params.description;
    case "logo":
      return !!params.logo;
    case "image":
      return !!params.image;
    default:
      return true;
  }
}

// Convert align/justify strings to flexbox values
function getFlexAlign(value?: string): string {
  switch (value) {
    case "start":
      return "flex-start";
    case "end":
      return "flex-end";
    case "between":
      return "space-between";
    default:
      return value || "center";
  }
}

// Build element from config
function buildElement(
  element: TemplateElement,
  params: OGParams,
): ElementNode | null {
  // Check conditional rendering
  if (element.showIf && !checkCondition(element.showIf, params)) {
    return null;
  }

  switch (element.type) {
    case "text": {
      const content = element.content
        ? replaceVariables(element.content, params)
        : "";
      if (!content) return null;

      const style: Record<string, unknown> = {
        display: "flex",
        fontSize: element.fontSize || 32,
        fontWeight: element.fontWeight || 400,
        color: element.color
          ? replaceVariables(element.color, params)
          : "#ffffff",
        lineHeight: element.lineHeight || 1.4,
      };

      // Only add optional properties if defined
      if (element.maxWidth !== undefined) style.maxWidth = element.maxWidth;
      if (element.opacity !== undefined) style.opacity = element.opacity;

      return createElement("div", { style }, content);
    }

    case "image": {
      const src = element.src ? replaceVariables(element.src, params) : "";
      if (!src) return null;

      const style: Record<string, unknown> = {};
      if (element.borderRadius !== undefined)
        style.borderRadius = element.borderRadius;

      return createElement("img", {
        src,
        width: element.width || 64,
        height: element.height || 64,
        style,
      });
    }

    case "box": {
      const children = (element.children || [])
        .map((child) => buildElement(child, params))
        .filter((c): c is ElementNode => c !== null);

      if (children.length === 0) return null;

      const style: Record<string, unknown> = {
        display: "flex",
        flexDirection: element.direction || "column",
        alignItems: getFlexAlign(element.align),
        justifyContent: getFlexAlign(element.justify),
      };

      if (element.backgroundColor) {
        style.backgroundColor = replaceVariables(
          element.backgroundColor,
          params,
        );
      }
      if (element.backgroundGradient) {
        style.background = element.backgroundGradient;
      }
      if (element.padding !== undefined) {
        style.padding = element.padding;
      }
      if (element.margin !== undefined) {
        style.margin = element.margin;
      }

      return createElement("div", { style }, ...children);
    }

    case "spacer": {
      return createElement("div", {
        style: {
          display: "flex",
          height: element.size || 20,
          width: element.size || 20,
        },
      });
    }

    default:
      return null;
  }
}

// Build template from config
export function buildTemplateFromConfig(
  config: CustomTemplateConfig,
  params: OGParams,
  fontFamilyOverride?: string,
): ElementNode {
  const layout = config.layout;

  // Priority: fontFamilyOverride (from API param) > layout.fontFamily > "Inter"
  const fontFamily = fontFamilyOverride || layout.fontFamily || "Inter";

  const rootStyle: Record<string, unknown> = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: layout.direction || "column",
    alignItems: getFlexAlign(layout.align),
    justifyContent: getFlexAlign(layout.justify),
    padding: layout.padding || 60,
    fontFamily,
  };

  // Background
  if (layout.backgroundGradient) {
    rootStyle.background = layout.backgroundGradient;
  } else if (layout.backgroundColor) {
    rootStyle.backgroundColor = replaceVariables(
      layout.backgroundColor,
      params,
    );
  } else {
    rootStyle.backgroundColor = `#${params.bg || "1a1a2e"}`;
  }

  // Background image
  if (layout.backgroundImage) {
    const bgImage = replaceVariables(layout.backgroundImage, params);
    if (bgImage) {
      rootStyle.backgroundImage = `url(${bgImage})`;
      rootStyle.backgroundSize = "cover";
      rootStyle.backgroundPosition = "center";
    }
  }

  // Build child elements
  const children = layout.elements
    .map((el) => buildElement(el, params))
    .filter((c): c is ElementNode => c !== null);

  return createElement("div", { style: rootStyle }, ...children);
}

// Load custom templates from a directory
const customTemplates: Map<string, CustomTemplateConfig> = new Map();

export async function loadCustomTemplates(templatesDir: string): Promise<void> {
  try {
    // Check if directory exists using fs
    const { existsSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");

    if (!existsSync(templatesDir)) {
      console.log(`Custom templates directory not found: ${templatesDir}`);
      return;
    }

    // Read all JSON files in the directory
    const files = readdirSync(templatesDir).filter((f) => f.endsWith(".json"));

    for (const fileName of files) {
      try {
        const filePath = join(templatesDir, fileName);
        const file = Bun.file(filePath);
        const content = await file.json();

        if (content.name) {
          customTemplates.set(content.name, content as CustomTemplateConfig);
          console.log(`Loaded custom template: ${content.name}`);
        }
      } catch (err) {
        console.error(`Failed to load template from ${fileName}:`, err);
      }
    }
  } catch (err) {
    console.error("Failed to load custom templates:", err);
  }
}

export function getCustomTemplate(
  name: string,
): CustomTemplateConfig | undefined {
  return customTemplates.get(name);
}

export function getCustomTemplateNames(): string[] {
  return Array.from(customTemplates.keys());
}

export function hasCustomTemplates(): boolean {
  return customTemplates.size > 0;
}

// Parse inline template config from URL parameter
// Supports both base64 encoding and URL-safe JSON
export function parseInlineTemplateConfig(
  configStr: string,
): CustomTemplateConfig | null {
  try {
    let jsonStr: string;

    // Try to detect if it's base64 encoded
    // Base64 strings typically only contain A-Za-z0-9+/= characters
    // URL-safe base64 uses - and _ instead of + and /
    const isBase64 = /^[A-Za-z0-9+/\-_]+=*$/.test(configStr);

    if (isBase64 && !configStr.startsWith("{")) {
      // Decode base64 (handle both standard and URL-safe base64)
      const base64Standard = configStr.replace(/-/g, "+").replace(/_/g, "/");
      jsonStr = atob(base64Standard);
    } else {
      // Assume it's URL-encoded JSON
      jsonStr = decodeURIComponent(configStr);
    }

    const config = JSON.parse(jsonStr);

    // Validate required fields
    if (!config.layout || !config.layout.elements) {
      return null;
    }

    // Add default name if missing
    if (!config.name) {
      config.name = "inline";
    }

    return config as CustomTemplateConfig;
  } catch {
    return null;
  }
}

// Validate template config structure
export function validateTemplateConfig(config: CustomTemplateConfig): {
  valid: boolean;
  error?: string;
} {
  if (!config.layout) {
    return { valid: false, error: "Missing layout property" };
  }

  if (!Array.isArray(config.layout.elements)) {
    return { valid: false, error: "layout.elements must be an array" };
  }

  // Validate element types
  const validTypes = ["text", "image", "box", "spacer"];
  for (const element of config.layout.elements) {
    if (!validTypes.includes(element.type)) {
      return { valid: false, error: `Invalid element type: ${element.type}` };
    }
  }

  return { valid: true };
}
