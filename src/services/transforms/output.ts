import type sharp from "sharp";
import type { ImageFormat } from "../../types";

export function applyOutputFormat(
  pipeline: sharp.Sharp,
  format: ImageFormat,
  quality: number,
): sharp.Sharp {
  switch (format) {
    case "webp":
      return pipeline.webp({ quality });
    case "avif":
      return pipeline.avif({ quality });
    case "png":
      return pipeline.png({ quality });
    case "jpg":
    case "jpeg":
      return pipeline.jpeg({ quality, mozjpeg: true });
    case "gif":
      return pipeline.gif();
    default:
      return pipeline.webp({ quality });
  }
}
