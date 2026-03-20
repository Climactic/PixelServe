import sharp from "sharp";
import type { ImageParams } from "../../types";

interface ResizeConfig {
  maxWidth: number;
  maxHeight: number;
}

export async function applyResize(
  pipeline: sharp.Sharp,
  params: ImageParams,
  imageBuffer: Buffer,
  resizeConfig: ResizeConfig,
): Promise<sharp.Sharp> {
  if (!params.size && !params.w && !params.h) return pipeline;

  if (params.size) {
    // Size param: percentage (1-100) of original image size
    // Skip resize entirely if size=100
    if (params.size < 100) {
      const metadata = await sharp(imageBuffer).metadata();
      const originalWidth = metadata.width || 0;
      const originalHeight = metadata.height || 0;
      const scale = Math.max(1, params.size) / 100;
      const width = Math.round(originalWidth * scale);
      const height = Math.round(originalHeight * scale);

      return pipeline.resize({
        width,
        height,
        fit: "fill",
        withoutEnlargement: true,
      });
    }
  } else {
    const width = params.w
      ? Math.min(Math.max(1, params.w), resizeConfig.maxWidth)
      : undefined;
    const height = params.h
      ? Math.min(Math.max(1, params.h), resizeConfig.maxHeight)
      : undefined;
    const fit = params.fit || "cover";

    return pipeline.resize({
      width,
      height,
      fit,
      position: params.position || "center",
      withoutEnlargement: true,
    });
  }

  return pipeline;
}
