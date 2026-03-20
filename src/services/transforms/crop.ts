import type sharp from "sharp";
import type { ImageParams } from "../../types";
import { ValidationError } from "../../utils/errors";

export function applyCrop(
  pipeline: sharp.Sharp,
  params: ImageParams,
): sharp.Sharp {
  if (!params.crop) return pipeline;

  const parts = params.crop.split(",").map(Number);
  if (
    parts.length !== 4 ||
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

  if (
    !Number.isFinite(left) ||
    !Number.isFinite(top) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isInteger(left) ||
    !Number.isInteger(top) ||
    !Number.isInteger(width) ||
    !Number.isInteger(height)
  ) {
    throw new ValidationError("Crop dimensions must be finite integers");
  }

  if (left < 0 || top < 0 || width <= 0 || height <= 0) {
    throw new ValidationError("Invalid crop dimensions");
  }

  return pipeline.extract({ left, top, width, height });
}
