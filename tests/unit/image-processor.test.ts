import { beforeAll, describe, expect, test } from "bun:test";
import sharp from "sharp";
import { processImage } from "../../src/services/image-processor";
import { ImageProcessingError, ValidationError } from "../../src/utils/errors";

// Create test images in memory
let testImageBuffer: Buffer;
let _testImageBufferWithAlpha: Buffer;

beforeAll(async () => {
  // Create a simple 100x100 red test image
  testImageBuffer = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .jpeg()
    .toBuffer();

  // Create a 100x100 image with alpha channel
  _testImageBufferWithAlpha = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
});

describe("Image Processor", () => {
  describe("Basic Processing", () => {
    test("processes image with default settings", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg" },
        testImageBuffer,
      );

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.format).toBe("webp"); // Default format
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    test("preserves original dimensions when no resize specified", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg" },
        testImageBuffer,
      );

      const metadata = await sharp(result.buffer).metadata();
      expect(metadata.width).toBe(100);
      expect(metadata.height).toBe(100);
    });
  });

  describe("Resizing", () => {
    test("resizes image to specified width", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg", w: 50 },
        testImageBuffer,
      );

      const metadata = await sharp(result.buffer).metadata();
      expect(metadata.width).toBe(50);
    });

    test("resizes image to specified height", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg", h: 50 },
        testImageBuffer,
      );

      const metadata = await sharp(result.buffer).metadata();
      expect(metadata.height).toBe(50);
    });

    test("resizes image to specified width and height", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg", w: 50, h: 25 },
        testImageBuffer,
      );

      const metadata = await sharp(result.buffer).metadata();
      expect(metadata.width).toBe(50);
      expect(metadata.height).toBe(25);
    });

    test("respects fit mode 'contain'", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg", w: 50, h: 25, fit: "contain" },
        testImageBuffer,
      );

      const metadata = await sharp(result.buffer).metadata();
      // With contain, one dimension should be <= requested, other should match ratio
      expect(metadata.width).toBeLessThanOrEqual(50);
      expect(metadata.height).toBeLessThanOrEqual(25);
    });

    test("does not enlarge images (withoutEnlargement)", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg", w: 200, h: 200 },
        testImageBuffer,
      );

      const metadata = await sharp(result.buffer).metadata();
      // Original is 100x100, should not be enlarged
      expect(metadata.width).toBeLessThanOrEqual(100);
      expect(metadata.height).toBeLessThanOrEqual(100);
    });

    test("respects max width/height limits", async () => {
      // Create a larger test image
      const largeImage = await sharp({
        create: {
          width: 5000,
          height: 5000,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .jpeg()
        .toBuffer();

      const result = await processImage(
        { url: "https://example.com/test.jpg", w: 5000, h: 5000 },
        largeImage,
      );

      const metadata = await sharp(result.buffer).metadata();
      // Max is 4096x4096
      expect(metadata.width).toBeLessThanOrEqual(4096);
      expect(metadata.height).toBeLessThanOrEqual(4096);
    });
  });

  describe("Format Conversion", () => {
    test("converts to webp format", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg", format: "webp" },
        testImageBuffer,
      );

      expect(result.format).toBe("webp");
      const metadata = await sharp(result.buffer).metadata();
      expect(metadata.format).toBe("webp");
    });

    test("converts to png format", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg", format: "png" },
        testImageBuffer,
      );

      expect(result.format).toBe("png");
      const metadata = await sharp(result.buffer).metadata();
      expect(metadata.format).toBe("png");
    });

    test("converts to jpeg format", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg", format: "jpg" },
        testImageBuffer,
      );

      expect(result.format).toBe("jpg");
      const metadata = await sharp(result.buffer).metadata();
      expect(metadata.format).toBe("jpeg");
    });

    test("converts to avif format", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg", format: "avif" },
        testImageBuffer,
      );

      expect(result.format).toBe("avif");
      const metadata = await sharp(result.buffer).metadata();
      expect(metadata.format).toBe("heif"); // AVIF uses HEIF container
    });
  });

  describe("Quality Settings", () => {
    test("applies quality setting (lower quality = smaller file)", async () => {
      const lowQuality = await processImage(
        { url: "https://example.com/test.jpg", format: "jpg", q: 10 },
        testImageBuffer,
      );

      const highQuality = await processImage(
        { url: "https://example.com/test.jpg", format: "jpg", q: 90 },
        testImageBuffer,
      );

      // Lower quality should generally result in smaller file
      expect(lowQuality.buffer.length).toBeLessThan(highQuality.buffer.length);
    });
  });

  describe("Transformations", () => {
    test("applies blur effect", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg", blur: 10 },
        testImageBuffer,
      );

      expect(result.buffer).toBeInstanceOf(Buffer);
      // Blur should result in a different image
      expect(result.buffer.length).not.toBe(testImageBuffer.length);
    });

    test("applies grayscale filter", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg", grayscale: true, format: "png" },
        testImageBuffer,
      );

      // Check that the image was converted
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    test("rotates image 90 degrees", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg", rotate: 90 },
        testImageBuffer,
      );

      const metadata = await sharp(result.buffer).metadata();
      // 100x100 rotated should still be 100x100 for square
      expect(metadata.width).toBe(100);
      expect(metadata.height).toBe(100);
    });

    test("flips image vertically", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg", flip: true },
        testImageBuffer,
      );

      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    test("flops image horizontally", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg", flop: true },
        testImageBuffer,
      );

      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    test("applies brightness adjustment", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg", brightness: 1.5, saturation: 1 },
        testImageBuffer,
      );

      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    test("applies saturation adjustment", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg", saturation: 0.5, brightness: 1 },
        testImageBuffer,
      );

      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    test("applies sharpen effect", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg", sharpen: 2 },
        testImageBuffer,
      );

      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    test("applies tint color", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg", tint: "0000ff" },
        testImageBuffer,
      );

      expect(result.buffer).toBeInstanceOf(Buffer);
    });
  });

  describe("Cropping", () => {
    test("crops image with valid dimensions", async () => {
      const result = await processImage(
        { url: "https://example.com/test.jpg", crop: "10,10,50,50" },
        testImageBuffer,
      );

      const metadata = await sharp(result.buffer).metadata();
      expect(metadata.width).toBe(50);
      expect(metadata.height).toBe(50);
    });

    test("throws ValidationError for invalid crop format", async () => {
      await expect(
        processImage(
          { url: "https://example.com/test.jpg", crop: "invalid" },
          testImageBuffer,
        ),
      ).rejects.toThrow(ValidationError);
    });

    test("throws ValidationError for missing crop values", async () => {
      await expect(
        processImage(
          { url: "https://example.com/test.jpg", crop: "10,10,50" },
          testImageBuffer,
        ),
      ).rejects.toThrow(ValidationError);
    });

    test("throws ValidationError for negative crop dimensions", async () => {
      await expect(
        processImage(
          { url: "https://example.com/test.jpg", crop: "-10,10,50,50" },
          testImageBuffer,
        ),
      ).rejects.toThrow(ValidationError);
    });

    test("throws ValidationError for zero width/height crop", async () => {
      await expect(
        processImage(
          { url: "https://example.com/test.jpg", crop: "10,10,0,50" },
          testImageBuffer,
        ),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("Combined Operations", () => {
    test("applies multiple transformations", async () => {
      const result = await processImage(
        {
          url: "https://example.com/test.jpg",
          w: 50,
          h: 50,
          blur: 2,
          grayscale: true,
          format: "png",
          q: 80,
        },
        testImageBuffer,
      );

      const metadata = await sharp(result.buffer).metadata();
      expect(metadata.width).toBe(50);
      expect(metadata.height).toBe(50);
      expect(metadata.format).toBe("png");
    });
  });

  describe("Error Handling", () => {
    test("throws ImageProcessingError for corrupted image data", async () => {
      const corruptedBuffer = Buffer.from("not an image");

      await expect(
        processImage({ url: "https://example.com/test.jpg" }, corruptedBuffer),
      ).rejects.toThrow(ImageProcessingError);
    });
  });
});
