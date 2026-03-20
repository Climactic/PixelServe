/**
 * Creates an Elysia onRequest handler that validates the request origin
 * against a list of allowed origins. Supports subdomain matching.
 */
export function createOriginGuard(allowedOrigins: string[]) {
  return ({ request, set }: { request: Request; set: { status?: number } }) => {
    if (allowedOrigins.length === 0) return;

    const url = new URL(request.url);
    if (url.pathname === "/health") return;

    const origin = request.headers.get("Origin");
    const referer = request.headers.get("Referer");

    // When allowedOrigins is configured, reject requests missing both headers
    // to prevent bypassing origin checks (e.g., via curl without headers).
    if (!origin && !referer) {
      set.status = 403;
      return { error: "FORBIDDEN", message: "Origin not allowed" };
    }

    const sourceOrigin =
      origin ||
      (() => {
        try {
          return new URL(referer as string).origin;
        } catch {
          return referer as string;
        }
      })();

    const isAllowed = allowedOrigins.some((allowed) => {
      if (sourceOrigin === allowed) return true;

      // Normalize allowed entry to hostname (handles full URLs like "https://example.com")
      let allowedHost: string;
      try {
        allowedHost = new URL(allowed).hostname;
      } catch {
        allowedHost = allowed;
      }

      try {
        const parsed = new URL(sourceOrigin);
        return (
          parsed.hostname === allowedHost ||
          parsed.hostname.endsWith(`.${allowedHost}`)
        );
      } catch {
        return sourceOrigin === allowed;
      }
    });

    if (!isAllowed) {
      set.status = 403;
      return { error: "FORBIDDEN", message: "Origin not allowed" };
    }
  };
}
