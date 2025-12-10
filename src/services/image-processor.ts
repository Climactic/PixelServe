import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import sharp from "sharp";
import { config } from "../config";
import type { ImageFormat, ImageParams, WatermarkPosition } from "../types";
import { ImageProcessingError, ValidationError } from "../utils/errors";
import { loadFontsForSatori } from "./fonts";
import { fetchImage } from "./image-fetcher";

// Map user-friendly position names to sharp gravity values
const GRAVITY_MAP: Record<WatermarkPosition, string> = {
  center: "center",
  top: "north",
  "top left": "northwest",
  "top right": "northeast",
  bottom: "south",
  "bottom left": "southwest",
  "bottom right": "southeast",
  left: "west",
  right: "east",
};

export async function processImage(
  params: ImageParams,
  sourceBuffer?: Buffer,
): Promise<{ buffer: Buffer; format: ImageFormat }> {
  try {
    // Fetch the source image if not provided
    const imageBuffer = sourceBuffer || (await fetchImage(params.url));

    let pipeline = sharp(imageBuffer, { failOnError: false });

    // Auto-orient based on EXIF
    pipeline = pipeline.rotate();

    // Crop (before resize) - format: "x,y,w,h"
    if (params.crop) {
      const parts = params.crop.split(",").map(Number);
      if (
        parts.length !== 4 ||
        parts.some(Number.isNaN) ||
        parts[0] === undefined ||
        parts[1] === undefined ||
        parts[2] === undefined ||
        parts[3] === undefined
      ) {
        throw new ValidationError(
          "Invalid crop format. Expected: x,y,width,height",
        );
      }
      const left = parts[0];
      const top = parts[1];
      const width = parts[2];
      const height = parts[3];
      if (left < 0 || top < 0 || width <= 0 || height <= 0) {
        throw new ValidationError("Invalid crop dimensions");
      }
      pipeline = pipeline.extract({ left, top, width, height });
    }

    // Resize
    if (params.size || params.w || params.h) {
      let width: number | undefined;
      let height: number | undefined;
      const fit = params.fit || "cover";

      if (params.size) {
        // Size param: percentage (1-100) of original image size
        // Skip resize entirely if size=100
        if (params.size < 100) {
          const metadata = await sharp(imageBuffer).metadata();
          const originalWidth = metadata.width || 0;
          const originalHeight = metadata.height || 0;
          const scale = Math.max(1, params.size) / 100;
          width = Math.round(originalWidth * scale);
          height = Math.round(originalHeight * scale);

          pipeline = pipeline.resize({
            width,
            height,
            fit: "fill", // Exact dimensions since we calculated them proportionally
            withoutEnlargement: true,
          });
        }
      } else {
        width = params.w
          ? Math.min(Math.max(1, params.w), config.maxWidth)
          : undefined;
        height = params.h
          ? Math.min(Math.max(1, params.h), config.maxHeight)
          : undefined;

        pipeline = pipeline.resize({
          width,
          height,
          fit,
          position: params.position || "center",
          withoutEnlargement: true,
        });
      }
    }

    // Rotation (explicit, after EXIF auto-orient)
    if (params.rotate !== undefined) {
      // Normalize to 0, 90, 180, 270 for best quality
      const angle = ((params.rotate % 360) + 360) % 360;
      if (angle !== 0) {
        pipeline = pipeline.rotate(angle);
      }
    }

    // Flip/Flop
    if (params.flip) {
      pipeline = pipeline.flip();
    }
    if (params.flop) {
      pipeline = pipeline.flop();
    }

    // Color adjustments using modulate
    if (params.brightness !== undefined || params.saturation !== undefined) {
      pipeline = pipeline.modulate({
        brightness: params.brightness,
        saturation: params.saturation,
      });
    }

    // Grayscale
    if (params.grayscale) {
      pipeline = pipeline.grayscale();
    }

    // Tint
    if (params.tint) {
      const tintColor = params.tint.startsWith("#")
        ? params.tint
        : `#${params.tint}`;
      pipeline = pipeline.tint(tintColor);
    }

    // Blur
    if (params.blur !== undefined) {
      const sigma = Math.min(Math.max(params.blur, 0.3), 1000);
      pipeline = pipeline.blur(sigma);
    }

    // Sharpen
    if (params.sharpen !== undefined) {
      pipeline = pipeline.sharpen({ sigma: params.sharpen });
    }

    // Trim whitespace
    if (params.trim) {
      pipeline = pipeline.trim();
    }

    // Watermark/Overlay (image or text)
    if (params.wm_image || params.wm_text) {
      const mainMetadata = await pipeline.clone().metadata();
      const mainWidth = mainMetadata.width || 800;
      const mainHeight = mainMetadata.height || 600;

      let watermarkInput: Buffer;

      if (params.wm_text) {
        // Text watermark using Satori + Resvg for proper font support
        const fontSize = params.wm_fontsize || 24;
        const fontFamily = params.wm_font || "Inter";
        const color = params.wm_color ? `#${params.wm_color}` : "#ffffff";
        const opacity = params.wm_opacity ?? 0.7;

        // Load the font
        const fonts = await loadFontsForSatori(fontFamily, [400, 700]);

        // Estimate dimensions (will be auto-sized by satori)
        const estimatedWidth = params.wm_text.length * fontSize * 0.7;
        const estimatedHeight = fontSize * 1.5;

        // Create text element for Satori
        const element = {
          type: "div",
          props: {
            style: {
              display: "flex",
              fontFamily,
              fontSize,
              color,
              opacity,
              whiteSpace: "nowrap",
            },
            children: params.wm_text,
          },
        };

        // Render with Satori to SVG
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

        // Convert SVG to PNG using Resvg
        const resvg = new Resvg(svg);
        const pngData = resvg.render();
        watermarkInput = Buffer.from(pngData.asPng());
      } else {
        // Image watermark
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

        // Apply opacity
        if (params.wm_opacity !== undefined && params.wm_opacity < 1) {
          const opacity = Math.max(0, Math.min(1, params.wm_opacity));
          watermarkPipeline = watermarkPipeline.ensureAlpha(opacity);
        }

        watermarkInput = await watermarkPipeline.toBuffer();
      }

      // Calculate position with padding
      const padding = params.wm_padding || 0;
      const position = params.wm_position || "bottom right";
      const gravity = GRAVITY_MAP[position] || "southeast";

      // For padding, we need to use top/left offsets instead of gravity
      if (padding > 0) {
        const wmMeta = await sharp(watermarkInput).metadata();
        const wmWidth = wmMeta.width || 0;
        const wmHeight = wmMeta.height || 0;

        let top = 0;
        let left = 0;

        // Calculate position based on gravity + padding
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

        pipeline = pipeline.composite([
          {
            input: watermarkInput,
            top: Math.max(0, top),
            left: Math.max(0, left),
          },
        ]);
      } else {
        pipeline = pipeline.composite([
          {
            input: watermarkInput,
            gravity,
          },
        ]);
      }
    }

    // Output format
    const format: ImageFormat = params.format || config.defaultFormat;
    const quality = params.q || config.defaultQuality;

    switch (format) {
      case "webp":
        pipeline = pipeline.webp({ quality });
        break;
      case "avif":
        pipeline = pipeline.avif({ quality });
        break;
      case "png":
        pipeline = pipeline.png({ quality });
        break;
      case "jpg":
      case "jpeg":
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        break;
      case "gif":
        pipeline = pipeline.gif();
        break;
      default:
        pipeline = pipeline.webp({ quality });
    }

    const buffer = await pipeline.toBuffer();

    return { buffer, format };
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof ImageProcessingError
    ) {
      throw error;
    }
    if (error instanceof Error) {
      throw new ImageProcessingError(
        `Image processing failed: ${error.message}`,
      );
    }
    throw new ImageProcessingError("Image processing failed");
  }
}
