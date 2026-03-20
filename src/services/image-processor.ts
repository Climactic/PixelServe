import sharp from "sharp";
import { config } from "../config";
import type { ImageFormat, ImageParams } from "../types";
import { ImageProcessingError, ValidationError } from "../utils/errors";
import { fetchImage } from "./image-fetcher";
import { applyAdjustments } from "./transforms/adjustments";
import { applyCrop } from "./transforms/crop";
import { applyOutputFormat } from "./transforms/output";
import { applyResize } from "./transforms/resize";
import { applyWatermark } from "./transforms/watermark";

export async function processImage(
  params: ImageParams,
  sourceBuffer?: Buffer,
): Promise<{ buffer: Buffer; format: ImageFormat }> {
  try {
    const imageBuffer = sourceBuffer || (await fetchImage(params.url));

    let pipeline = sharp(imageBuffer, { failOnError: false });

    // Auto-orient based on EXIF
    pipeline = pipeline.rotate();

    // Transform pipeline: crop → resize → adjustments → watermark → output
    pipeline = applyCrop(pipeline, params);
    pipeline = await applyResize(pipeline, params, {
      maxWidth: config.maxWidth,
      maxHeight: config.maxHeight,
    });
    pipeline = applyAdjustments(pipeline, params);
    pipeline = await applyWatermark(pipeline, params);

    const format: ImageFormat = params.format || config.defaultFormat;
    const quality = params.q || config.defaultQuality;
    pipeline = applyOutputFormat(pipeline, format, quality);

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
