# PixelServe

Image processing microservice with OG image generation.

## Tech Stack

- **Runtime**: Bun (not Node.js)
- **Framework**: Elysia (type-safe HTTP framework)
- **Image Processing**: Sharp (libvips bindings)
- **OG Generation**: Satori + resvg-js (SVG-based, no headless browser)
- **Linting/Formatting**: Biome

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Start with hot reload
bun run start        # Start production server
bun test             # Run all tests
bun test tests/unit  # Run unit tests only
```

## Project Structure

```
src/
├── index.ts              # Entry point, Elysia server setup
├── config.ts             # Environment configuration
├── routes/
│   ├── image.ts          # GET /image - image transformations
│   ├── og.ts             # GET /og - OG image generation
│   └── health.ts         # GET /health - health check
├── services/
│   ├── image-processor.ts # Sharp transformations
│   ├── image-fetcher.ts  # Remote image fetching with SSRF protection
│   ├── cache.ts          # Disk/memory caching
│   ├── og-generator.ts   # Satori rendering
│   ├── custom-templates.ts # JSON template builder
│   └── fonts.ts          # Dynamic Google Fonts loading
├── utils/
│   ├── url-validator.ts  # SSRF prevention (blocks private IPs)
│   └── errors.ts         # Custom error classes
└── types/index.ts        # TypeScript interfaces

templates/                # Custom JSON templates for OG images
tests/
├── unit/                 # Unit tests
└── integration/          # API integration tests
```

## Key APIs

- `GET /image?url=<source>&w=<width>&h=<height>&format=<webp|avif|png|jpg>` - Transform remote images
- `GET /og?title=<title>&description=<desc>&template=<name>` - Generate OG images
- `GET /og/templates` - List available templates
- `GET /health` - Health check with cache stats

## Code Style

- Use Biome for linting/formatting: `bunx biome check --write .`
- Double quotes for strings
- Space indentation
- Organize imports automatically

## Bun-Specific Notes

- Bun auto-loads `.env` files (no dotenv needed)
- Use `Bun.$\`cmd\`` for shell commands
- Use `Bun.file()` over `node:fs` when possible
- Tests use `bun:test` (import { test, expect, describe } from "bun:test")
