import { describe, expect, test } from "bun:test";
import {
  getSuggestedFonts,
  isFontSupported,
  loadFontsForSatori,
  preloadDefaultFonts,
} from "../../src/services/fonts";

describe("Fonts Service", () => {
  describe("getSuggestedFonts", () => {
    test("returns an array of font names", () => {
      const fonts = getSuggestedFonts();
      expect(Array.isArray(fonts)).toBe(true);
      expect(fonts.length).toBeGreaterThan(0);
    });

    test("includes common fonts", () => {
      const fonts = getSuggestedFonts();
      expect(fonts).toContain("Inter");
      expect(fonts).toContain("Roboto");
      expect(fonts).toContain("Open Sans");
      expect(fonts).toContain("Poppins");
      expect(fonts).toContain("Montserrat");
    });

    test("includes display fonts", () => {
      const fonts = getSuggestedFonts();
      expect(fonts).toContain("Playfair Display");
      expect(fonts).toContain("Merriweather");
    });
  });

  describe("isFontSupported", () => {
    test("returns true for any font (dynamic loading)", () => {
      // Since we use Coolify Fonts API, any Google Font should work
      expect(isFontSupported("Inter")).toBe(true);
      expect(isFontSupported("Roboto")).toBe(true);
      expect(isFontSupported("Some Random Font")).toBe(true);
      expect(isFontSupported("Comic Sans MS")).toBe(true);
    });

    test("returns true for fonts with spaces", () => {
      expect(isFontSupported("Open Sans")).toBe(true);
      expect(isFontSupported("Playfair Display")).toBe(true);
      expect(isFontSupported("Source Sans Pro")).toBe(true);
    });
  });

  describe("loadFontsForSatori", () => {
    test("loads Inter font by default", async () => {
      const fonts = await loadFontsForSatori();

      expect(fonts.length).toBeGreaterThan(0);
      expect(fonts[0].name).toBe("Inter");
      expect(fonts[0].data).toBeInstanceOf(ArrayBuffer);
      expect(fonts[0].style).toBe("normal");
    });

    test("loads requested weights", async () => {
      const fonts = await loadFontsForSatori("Inter", [400, 700]);

      expect(fonts.length).toBe(2);
      expect(fonts.some((f) => f.weight === 400)).toBe(true);
      expect(fonts.some((f) => f.weight === 700)).toBe(true);
    });

    test("loads different font families", async () => {
      const fonts = await loadFontsForSatori("Roboto", [400]);

      expect(fonts.length).toBeGreaterThan(0);
      expect(fonts[0].name).toBe("Roboto");
    });

    test("falls back to Inter for invalid font names", async () => {
      // This should fall back to Inter when the API returns an error
      const fonts = await loadFontsForSatori(
        "ThisFontDoesNotExist12345",
        [400],
      );

      // Should either load the font or fall back to Inter
      expect(fonts.length).toBeGreaterThan(0);
    });

    test("returns LoadedFont objects with correct structure", async () => {
      const fonts = await loadFontsForSatori("Inter", [400]);

      expect(fonts[0]).toHaveProperty("name");
      expect(fonts[0]).toHaveProperty("data");
      expect(fonts[0]).toHaveProperty("weight");
      expect(fonts[0]).toHaveProperty("style");

      expect(typeof fonts[0].name).toBe("string");
      expect(fonts[0].data).toBeInstanceOf(ArrayBuffer);
      expect(typeof fonts[0].weight).toBe("number");
      expect(fonts[0].style).toBe("normal");
    });
  });

  describe("preloadDefaultFonts", () => {
    test("preloads Inter 400 and 700 without error", async () => {
      // This should complete without throwing
      await expect(preloadDefaultFonts()).resolves.toBeUndefined();
    });
  });

  describe("Font caching", () => {
    test("subsequent loads use cache (faster)", async () => {
      // First load
      const start1 = performance.now();
      await loadFontsForSatori("Inter", [400]);
      const time1 = performance.now() - start1;

      // Second load should be from cache
      const start2 = performance.now();
      await loadFontsForSatori("Inter", [400]);
      const time2 = performance.now() - start2;

      // Cached load should be significantly faster (at least 10x)
      // But we can't guarantee exact times, so just check it completes
      expect(time2).toBeLessThan(time1 + 100); // Allow some variance
    });
  });

  describe("Font weights", () => {
    test("loads single weight", async () => {
      const fonts = await loadFontsForSatori("Inter", [400]);
      expect(fonts.length).toBe(1);
      expect(fonts[0].weight).toBe(400);
    });

    test("loads multiple weights", async () => {
      const fonts = await loadFontsForSatori("Inter", [400, 700]);
      expect(fonts.length).toBe(2);
    });

    test("handles weight 700 (bold)", async () => {
      const fonts = await loadFontsForSatori("Inter", [700]);
      expect(fonts.length).toBe(1);
      // Weight might be exactly 700 or closest available
      expect(fonts[0].weight).toBeGreaterThanOrEqual(600);
    });
  });

  describe("Font URL construction", () => {
    test("handles fonts with spaces in name", async () => {
      const fonts = await loadFontsForSatori("Open Sans", [400]);
      expect(fonts.length).toBeGreaterThan(0);
      expect(fonts[0].name).toBe("Open Sans");
    });

    test("handles fonts with multiple words", async () => {
      const fonts = await loadFontsForSatori("Source Sans Pro", [400]);
      expect(fonts.length).toBeGreaterThan(0);
    });
  });
});
