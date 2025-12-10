import type { FitEnum } from "sharp";

export type ImageFormat = "webp" | "avif" | "png" | "jpg" | "jpeg" | "gif";

export type FitMode = keyof FitEnum;

export type Position =
  | "center"
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "top left"
  | "top right"
  | "bottom left"
  | "bottom right"
  | "entropy"
  | "attention";

export type WatermarkPosition =
  | "center"
  | "top"
  | "top left"
  | "top right"
  | "bottom"
  | "bottom left"
  | "bottom right"
  | "left"
  | "right";

export interface ImageParams {
  url: string;
  w?: number;
  h?: number;
  size?: number; // Percentage (1-100) of original image size
  fit?: FitMode;
  position?: Position;
  q?: number;
  format?: ImageFormat;
  blur?: number;
  grayscale?: boolean;
  rotate?: number;
  flip?: boolean;
  flop?: boolean;
  brightness?: number;
  saturation?: number;
  sharpen?: number;
  tint?: string;
  trim?: boolean;
  crop?: string; // "x,y,w,h"
  wm_image?: string; // Image watermark URL
  wm_text?: string; // Text watermark
  wm_position?: WatermarkPosition;
  wm_opacity?: number;
  wm_scale?: number; // Scale watermark as percentage of image width (1-100)
  wm_padding?: number; // Padding from edges in pixels
  wm_font?: string; // Font family for text watermark
  wm_fontsize?: number; // Font size for text watermark
  wm_color?: string; // Text color for text watermark (hex)
}

export interface OGParams {
  title?: string;
  description?: string;
  template?: string;
  bg?: string;
  fg?: string;
  // Extended color options
  titleColor?: string; // Title text color (overrides fg)
  descColor?: string; // Description text color (overrides fg)
  accentColor?: string; // Accent color for decorative elements
  // Images
  image?: string;
  logo?: string;
  w?: number;
  h?: number;
  // Inline template config (base64-encoded JSON or URL-safe JSON)
  config?: string;
  // Font options
  font?: string; // Font family name (e.g., "Roboto", "Poppins")
}

export interface CacheEntry {
  data: Buffer;
  format: ImageFormat;
  createdAt: number;
}

export interface HealthStatus {
  status: "ok" | "degraded" | "error";
  uptime: number;
  cache: {
    enabled: boolean;
    directory: string;
  };
  version: string;
}

export type CacheKeyParams = Record<
  string,
  string | number | boolean | undefined
>;

export function imageParamsToCacheKeyParams(
  params: ImageParams,
): CacheKeyParams {
  return {
    url: params.url,
    w: params.w,
    h: params.h,
    size: params.size,
    fit: params.fit,
    position: params.position,
    q: params.q,
    format: params.format,
    blur: params.blur,
    grayscale: params.grayscale,
    rotate: params.rotate,
    flip: params.flip,
    flop: params.flop,
    brightness: params.brightness,
    saturation: params.saturation,
    sharpen: params.sharpen,
    tint: params.tint,
    trim: params.trim,
    crop: params.crop,
    wm_image: params.wm_image,
    wm_text: params.wm_text,
    wm_position: params.wm_position,
    wm_opacity: params.wm_opacity,
    wm_scale: params.wm_scale,
    wm_padding: params.wm_padding,
    wm_font: params.wm_font,
    wm_fontsize: params.wm_fontsize,
    wm_color: params.wm_color,
  };
}
