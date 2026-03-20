import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import sharp from "sharp";
import {
  DEFAULT_FALLBACK_HEIGHT,
  DEFAULT_FALLBACK_WIDTH,
  DEFAULT_WATERMARK_FONT_SIZE,
  TEXT_WIDTH_MULTIPLIER,
} from "../../constants";
import type { ImageParams, WatermarkPosition } from "../../types";
import { loadFontsForSatori } from "../fonts";
import { fetchImage } from "../image-fetcher";

const GRAVITY_MAP: Record<WatermarkPosition, string> = {
  center: "center",
  top: "north",
  "top-left": "northwest",
  "top-right": "northeast",
  bottom: "south",
  "bottom-left": "southwest",
  "bottom-right": "southeast",
  left: "west",
  right: "east",
};

export async function applyWatermark(
  pipeline: sharp.Sharp,
  params: ImageParams,
): Promise<sharp.Sharp> {
  if (!params.wm_image && !params.wm_text) return pipeline;

  // Get actual post-transform dimensions by resolving the pipeline
  const { info } = await pipeline.clone().toBuffer({ resolveWithObject: true });
  const mainWidth = info.width || DEFAULT_FALLBACK_WIDTH;
  const mainHeight = info.height || DEFAULT_FALLBACK_HEIGHT;

  let watermarkInput: Buffer;

  if (params.wm_text) {
    watermarkInput = await renderTextWatermark(params);
  } else {
    watermarkInput = await renderImageWatermark(params, mainWidth);
  }

  // Calculate position with padding
  const padding = params.wm_padding || 0;
  const position = params.wm_position || "bottom-right";
  const gravity = GRAVITY_MAP[position] || "southeast";

  if (padding > 0) {
    const wmMeta = await sharp(watermarkInput).metadata();
    const wmWidth = wmMeta.width || 0;
    const wmHeight = wmMeta.height || 0;

    let top = 0;
    let left = 0;

    if (position.includes("top")) {
      top = padding;
    } else if (position.includes("bottom")) {
      top = mainHeight - wmHeight - padding;
    } else {
      top = Math.round((mainHeight - wmHeight) / 2);
    }

    if (position.includes("left")) {
      left = padding;
    } else if (position.includes("right")) {
      left = mainWidth - wmWidth - padding;
    } else {
      left = Math.round((mainWidth - wmWidth) / 2);
    }

    return pipeline.composite([
      {
        input: watermarkInput,
        top: Math.max(0, top),
        left: Math.max(0, left),
      },
    ]);
  }

  return pipeline.composite([
    {
      input: watermarkInput,
      gravity,
    },
  ]);
}

async function renderTextWatermark(params: ImageParams): Promise<Buffer> {
  const fontSize = params.wm_fontsize || DEFAULT_WATERMARK_FONT_SIZE;
  const fontFamily = params.wm_font || "Inter";
  const color = params.wm_color
    ? params.wm_color.startsWith("#")
      ? params.wm_color
      : `#${params.wm_color}`
    : "#ffffff";
  const opacity = params.wm_opacity ?? 0.7;

  const fonts = await loadFontsForSatori(fontFamily, [400, 700]);
  const actualFontFamily = fonts[0]?.name || fontFamily;

  const estimatedWidth =
    (params.wm_text as string).length * fontSize * TEXT_WIDTH_MULTIPLIER;
  const estimatedHeight = fontSize * 1.5;

  const element = {
    type: "div",
    props: {
      style: {
        display: "flex",
        fontFamily: actualFontFamily,
        fontSize,
        color,
        opacity,
        whiteSpace: "nowrap",
      },
      children: params.wm_text,
    },
  };

  const svg = await satori(element, {
    width: estimatedWidth,
    height: estimatedHeight,
    fonts: fonts.map((f) => ({
      name: f.name,
      data: f.data,
      weight: f.weight,
      style: f.style,
    })),
  });

  const resvg = new Resvg(svg);
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}

async function renderImageWatermark(
  params: ImageParams,
  mainWidth: number,
): Promise<Buffer> {
  const watermarkBuffer = await fetchImage(params.wm_image || "");
  let watermarkPipeline = sharp(watermarkBuffer);

  // Scale watermark if specified (percentage of main image width)
  if (params.wm_scale) {
    const wmMetadata = await watermarkPipeline.metadata();
    const wmWidth = wmMetadata.width || 100;
    const wmHeight = wmMetadata.height || 100;
    const targetWidth = Math.round(mainWidth * (params.wm_scale / 100));
    const scaleFactor = targetWidth / wmWidth;
    const targetHeight = Math.round(wmHeight * scaleFactor);

    watermarkPipeline = watermarkPipeline.resize({
      width: targetWidth,
      height: targetHeight,
      fit: "inside",
    });
  }

  // Apply opacity by scaling the alpha channel directly
  if (params.wm_opacity !== undefined && params.wm_opacity < 1) {
    const opacity = Math.max(0, Math.min(1, params.wm_opacity));
    watermarkPipeline = watermarkPipeline
      .ensureAlpha()
      .linear([1, 1, 1, opacity], [0, 0, 0, 0]);
  }

  return watermarkPipeline.toBuffer();
}
