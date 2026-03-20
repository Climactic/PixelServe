import type sharp from "sharp";
import type { ImageParams } from "../../types";

interface ResizeConfig {
  maxWidth: number;
  maxHeight: number;
}

export async function applyResize(
  pipeline: sharp.Sharp,
  params: ImageParams,
  resizeConfig: ResizeConfig,
): Promise<sharp.Sharp> {
  if (!params.size && !params.w && !params.h) return pipeline;

  if (params.size) {
    // Size param: percentage (1-100) of current image dimensions
    // Skip resize entirely if size=100
    if (params.size < 100) {
      // Resolve the pipeline to get actual post-transform dimensions
      const { info } = await pipeline
        .clone()
        .toBuffer({ resolveWithObject: true });
      const currentWidth = info.width || 0;
      const currentHeight = info.height || 0;
      const scale = Math.max(1, params.size) / 100;
      const width = Math.max(1, Math.round(currentWidth * scale));
      const height = Math.max(1, Math.round(currentHeight * scale));

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
