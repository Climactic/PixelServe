import { join } from "node:path";

// Font weight definitions
export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export interface LoadedFont {
  name: string;
  data: ArrayBuffer;
  weight: FontWeight;
  style: "normal" | "italic";
}

// Google Fonts API - use with Android UA to get full TTF files (no subsetting)
const GOOGLE_FONTS_API = "https://fonts.googleapis.com";

// In-memory cache for loaded fonts
const fontCache = new Map<string, ArrayBuffer>();

// Loading promises to prevent duplicate downloads
const loadingPromises = new Map<string, Promise<ArrayBuffer>>();

// Cache for parsed CSS (font URL lookups)
const cssCache = new Map<string, Map<number, string>>();

/**
 * Generate a cache key for a font variant
 */
function getCacheKey(fontName: string, weight: FontWeight): string {
  return `${fontName}-${weight}`;
}

/**
 * Get the local file path for caching a font
 */
function getLocalFontPath(fontName: string, weight: FontWeight): string {
  const safeName = fontName.replace(/\s+/g, "-");
  return join(import.meta.dir, `../../fonts/${safeName}-${weight}.ttf`);
}

/**
 * Fetch CSS from Coolify Fonts API and parse TTF URLs
 * Satori requires TTF format, so we request it specifically via User-Agent
 */
async function fetchFontCss(
  fontName: string,
  weights: FontWeight[],
): Promise<Map<number, string>> {
  const cacheKey = `${fontName}-${weights.join(",")}`;
  const cached = cssCache.get(cacheKey);
  if (cached) return cached;

  // Build the Google Fonts CSS2 API URL format
  // Example: https://fonts.googleapis.com/css2?family=Inter:wght@400;700
  const weightStr = weights.join(";");
  const url = `${GOOGLE_FONTS_API}/css2?family=${encodeURIComponent(fontName)}:wght@${weightStr}`;

  console.log(`Fetching font CSS from ${url}`);

  // Use Android User-Agent to get full TTF files (no subsetting, no WOFF2 conversion needed)
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; U; Android 4.0.3; en-us) AppleWebKit/537.36 (KHTML, like Gecko)",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch font CSS for "${fontName}": ${response.status}`,
    );
  }

  const css = await response.text();

  // Parse CSS to extract font URLs and weights
  // CSS format:
  // @font-face {
  //   font-family: 'Inter';
  //   font-style: normal;
  //   font-weight: 400;
  //   src: url(https://...) format('truetype');
  // }
  const urlMap = new Map<number, string>();

  // Match @font-face blocks - Android UA returns full TTF without subsetting
  const fontFaceRegex = /@font-face\s*\{([^}]+)\}/g;
  let match = fontFaceRegex.exec(css);

  while (match !== null) {
    const block = match[1];

    // Extract weight
    const weightMatch = block.match(/font-weight:\s*(\d+)/);
    const weight = weightMatch ? Number.parseInt(weightMatch[1], 10) : 400;

    // Extract URL - prefer truetype format
    let urlMatch = block.match(/url\(([^)]+)\)\s*format\(['"]truetype['"]\)/);
    if (!urlMatch) {
      urlMatch = block.match(/url\(([^)]+)\)/);
    }

    if (urlMatch) {
      let fontUrl = urlMatch[1].replace(/['"]/g, "");
      if (!fontUrl.startsWith("http")) {
        fontUrl = `https:${fontUrl}`;
      }
      urlMap.set(weight, fontUrl);
    }

    match = fontFaceRegex.exec(css);
  }

  if (urlMap.size === 0) {
    throw new Error(`No font URLs found in CSS for "${fontName}"`);
  }

  cssCache.set(cacheKey, urlMap);
  return urlMap;
}

/**
 * Get the closest available weight from a set of weights
 */
function getClosestWeight(
  availableWeights: number[],
  targetWeight: FontWeight,
): FontWeight {
  if (availableWeights.length === 0) return 400 as FontWeight;

  const closest = availableWeights.reduce((prev, curr) =>
    Math.abs(curr - targetWeight) < Math.abs(prev - targetWeight) ? curr : prev,
  );

  return closest as FontWeight;
}

/**
 * Load a single font variant from Coolify Fonts
 */
async function loadFontVariant(
  fontName: string,
  weight: FontWeight,
): Promise<ArrayBuffer> {
  const cacheKey = getCacheKey(fontName, weight);

  // Check memory cache
  const cached = fontCache.get(cacheKey);
  if (cached) return cached;

  // Check if already loading
  const loading = loadingPromises.get(cacheKey);
  if (loading) return loading;

  // Create loading promise
  const loadPromise = (async () => {
    const localPath = getLocalFontPath(fontName, weight);

    // Try loading from local cache first
    const localFile = Bun.file(localPath);
    if (await localFile.exists()) {
      console.log(`Loading font ${fontName} (${weight}) from cache`);
      const data = await localFile.arrayBuffer();
      fontCache.set(cacheKey, data);
      return data;
    }

    // Fetch CSS to get font URLs - deduplicate and sort weights (Google Fonts requires ascending order)
    const weightsToFetch = [...new Set([weight, 400, 700])].sort(
      (a, b) => a - b,
    ) as FontWeight[];
    const urlMap = await fetchFontCss(fontName, weightsToFetch);

    // Get URL for requested weight, or closest available
    let fontUrl = urlMap.get(weight);
    let actualWeight = weight;

    if (!fontUrl) {
      // Find closest weight
      const availableWeights = Array.from(urlMap.keys());
      actualWeight = getClosestWeight(availableWeights, weight);
      fontUrl = urlMap.get(actualWeight);
    }

    if (!fontUrl) {
      throw new Error(`No font URL found for "${fontName}" weight ${weight}`);
    }

    // Download the font file
    console.log(
      `Downloading font ${fontName} (${actualWeight}) from Google Fonts...`,
    );
    const response = await fetch(fontUrl, {
      headers: {
        "User-Agent": "PixelServe/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download font: ${response.status}`);
    }

    const data = await response.arrayBuffer();

    // Cache locally
    try {
      const fontsDir = join(import.meta.dir, "../../fonts");
      await Bun.$`mkdir -p ${fontsDir}`.quiet();
      await Bun.write(localPath, data);
      console.log(`Cached font ${fontName} (${actualWeight}) to ${localPath}`);
    } catch (err) {
      // Non-fatal if we can't cache
      console.warn(`Failed to cache font locally: ${err}`);
    }

    fontCache.set(cacheKey, data);
    return data;
  })();

  loadingPromises.set(cacheKey, loadPromise);

  try {
    return await loadPromise;
  } finally {
    loadingPromises.delete(cacheKey);
  }
}

/**
 * Load fonts for Satori rendering
 * Any Google Font name can be used - it will be fetched dynamically from Coolify Fonts
 */
export async function loadFontsForSatori(
  fontName = "Inter",
  weights: FontWeight[] = [400, 700],
): Promise<LoadedFont[]> {
  const fonts: LoadedFont[] = [];

  for (const weight of weights) {
    try {
      const data = await loadFontVariant(fontName, weight);
      fonts.push({
        name: fontName,
        data,
        weight,
        style: "normal",
      });
    } catch (err) {
      console.error(`Failed to load font ${fontName} (${weight}):`, err);

      // Fall back to Inter if the requested font fails
      if (fontName !== "Inter") {
        try {
          console.log(`Falling back to Inter for weight ${weight}`);
          const data = await loadFontVariant("Inter", weight);
          fonts.push({
            name: "Inter",
            data,
            weight,
            style: "normal",
          });
        } catch (fallbackErr) {
          console.error(
            `Failed to load fallback font Inter (${weight}):`,
            fallbackErr,
          );
        }
      }
    }
  }

  if (fonts.length === 0) {
    throw new Error(
      `Failed to load any fonts for "${fontName}". Make sure the font name is a valid Google Font.`,
    );
  }

  return fonts;
}

/**
 * Preload default fonts (Inter 400/700) at startup
 */
export async function preloadDefaultFonts(): Promise<void> {
  console.log("Preloading default fonts...");
  await loadFontsForSatori("Inter", [400, 700]);
  console.log("Default fonts preloaded");
}

/**
 * Check if a font is likely supported (any Google Font name should work)
 * Since we use dynamic loading, we always return true and let the API handle validation
 */
export function isFontSupported(_fontName: string): boolean {
  // All Google Fonts are supported via Coolify Fonts API
  return true;
}

/**
 * Get list of suggested fonts (this is just for documentation, not a hard limit)
 */
export function getSuggestedFonts(): string[] {
  return [
    "Inter",
    "Roboto",
    "Open Sans",
    "Lato",
    "Montserrat",
    "Poppins",
    "Source Sans Pro",
    "Playfair Display",
    "Merriweather",
    "Nunito",
    "Raleway",
    "Ubuntu",
    "Oswald",
    "PT Sans",
    "Quicksand",
  ];
}
