# PixelServe

Image processing microservice with OG image generation.

## Tech Stack

- **Runtime**: Bun (not Node.js)
- **Framework**: Elysia (type-safe HTTP framework)
- **Image Processing**: Sharp (libvips bindings)
- **OG Generation**: Satori + resvg-js (SVG-based, no headless browser)
- **Linting**: oxlint (fast Rust-based linter)
- **Formatting**: oxfmt (Prettier-compatible Rust formatter)
- **Building**: tsdown (TypeScript bundler based on Rolldown)
- **Config Validation**: @sinclair/typebox (runtime schema validation)

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Start with hot reload
bun run start        # Start production server
bun run start:cluster # Start with clustering
bun test             # Run all tests
bun test tests/unit  # Run unit tests only
bun run lint         # Lint with oxlint
bun run lint:fix     # Lint and auto-fix
bun run format       # Format with oxfmt
bun run format:check # Check formatting without writing
bun run build        # Build with tsdown
```

## Project Structure

```
src/
├── index.ts              # Entry point — server setup, CORS, cache init, shutdown
├── config.ts             # Env config with TypeBox schema validation
├── constants.ts          # Named constants (timeouts, limits, defaults)
├── middleware/
│   ├── origin-validator.ts  # Origin/Referer validation guard (subdomain-aware)
│   └── error-handler.ts     # Shared Elysia error handler (PixelServeError → JSON)
├── routes/
│   ├── image.ts          # GET /image — image transformations
│   ├── og.ts             # GET /og — OG image generation
│   └── health.ts         # GET /health — health check
├── services/
│   ├── image-processor.ts   # Orchestrator: fetch → crop → resize → adjust → watermark → output
│   ├── image-fetcher.ts     # Remote image fetching with SSRF protection + redirect validation
│   ├── cache.ts             # Multi-backend caching (disk/memory/hybrid/redis/none)
│   ├── og-generator.ts      # Satori rendering pipeline
│   ├── custom-templates.ts  # JSON template builder for OG images
│   ├── fonts.ts             # Dynamic Google Fonts loading + caching
│   └── transforms/          # Individual image transform steps
│       ├── crop.ts
│       ├── resize.ts
│       ├── adjustments.ts   # rotate, flip, flop, brightness, saturation, grayscale, tint, blur, sharpen, trim
│       ├── watermark.ts     # Text (via Satori) and image watermarks with positioning
│       └── output.ts        # Format conversion (webp, avif, png, jpg, gif)
├── utils/
│   ├── url-validator.ts  # SSRF prevention (private IP blocking, DNS resolution, domain allowlist)
│   └── errors.ts         # Error hierarchy: PixelServeError → Validation/Fetch/Timeout/Forbidden/NotFound/ImageProcessing
└── types/index.ts        # TypeScript interfaces (ImageParams, OGParams, etc.)

templates/                # Custom JSON templates for OG images
tests/
├── unit/                 # Unit tests (bun:test)
└── integration/          # API integration tests
```

## Key APIs

- `GET /image?url=<source>&w=<width>&h=<height>&format=<webp|avif|png|jpg>` — Transform remote images
- `GET /og?title=<title>&description=<desc>&template=<name>` — Generate OG images
- `GET /og/templates` — List available templates with schema docs
- `GET /health` — Health check with cache stats

## Architecture Patterns

### Error handling

- All domain errors extend `PixelServeError` (in `utils/errors.ts`) with `statusCode` and `code` fields.
- Routes use the shared `createErrorHandler()` from `middleware/error-handler.ts` — do NOT duplicate error handling inline.
- Cache write errors are fire-and-forget (logged but don't fail the request).

### Middleware

- Origin validation and error handling live in `src/middleware/`. Elysia hooks are created via factory functions (`createOriginGuard()`, `createErrorHandler()`) for testability.
- Tests import and test the real middleware — never duplicate implementation in test files.

### Image processing pipeline

- `image-processor.ts` is a thin orchestrator. Each transform step is in `services/transforms/`. Add new transforms as separate files there.
- Pipeline order: fetch → auto-orient → crop → resize → adjustments → watermark → output format.

### SSRF protection

- `url-validator.ts` blocks private IPs, loopback, and link-local addresses via DNS resolution.
- `image-fetcher.ts` handles redirects manually (max 5 hops) and re-validates each redirect target through `validateUrl()` to prevent redirect-to-private-IP attacks. Never use `redirect: "follow"`.

### Caching

- `cache.ts` abstracts multiple backends behind `getCached()`/`setCache()`. Cache mode is set via `CACHE_MODE` env var.
- Cache keys are SHA256 hashes of sorted params (via `generateCacheKey()`).

### Config

- `config.ts` parses env vars and validates against a TypeBox schema. Bun auto-loads `.env` — no dotenv needed.
- Named constants (timeouts, limits) go in `constants.ts`, not inline as magic numbers.

## Code Style

- **Formatter**: oxfmt (`bun run format`). Double quotes, trailing commas, semicolons, space indentation.
- **Linter**: oxlint (`bun run lint`).
- **Imports**: Use `import type` for type-only imports. Keep imports organized: external → internal (config/constants → middleware → services → types → utils).
- **No `any`**: Use proper types or narrowing. Avoid `as` casts unless structurally necessary (document why).
- **Errors**: Throw typed errors from `utils/errors.ts` — never throw plain strings or generic `Error`.

## Bun-Specific Notes

- Bun auto-loads `.env` files (no dotenv needed)
- Use `Bun.$\`cmd\`` for shell commands
- Use `Bun.file()` over `node:fs` when possible
- Tests use `bun:test` (`import { test, expect, describe } from "bun:test"`)
- Redis uses Bun's built-in `RedisClient` (not ioredis)

## Testing

- Tests live in `tests/unit/` and `tests/integration/`.
- Unit tests mock external dependencies; integration tests use Elysia's `app.handle()` for in-process HTTP testing.
- Always run `bun test` after changes. Run `bun run lint` and `bun run format` before committing.
