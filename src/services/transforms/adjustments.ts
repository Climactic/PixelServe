import type sharp from "sharp";
import { BLUR_MAX, BLUR_MIN } from "../../constants";
import type { ImageParams } from "../../types";

export function applyAdjustments(
  pipeline: sharp.Sharp,
  params: ImageParams,
): sharp.Sharp {
  // Rotation (explicit, after EXIF auto-orient)
  if (params.rotate !== undefined) {
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
    const sigma = Math.min(Math.max(params.blur, BLUR_MIN), BLUR_MAX);
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

  return pipeline;
}
