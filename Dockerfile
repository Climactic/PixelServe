# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Dependencies
# ============================================
FROM oven/bun:1-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies (production only)
RUN bun install --frozen-lockfile --production

# ============================================
# Stage 2: Builder (for any build steps)
# ============================================
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install all dependencies (including dev)
RUN bun install --frozen-lockfile

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Type check (optional but recommended)
RUN bun x tsc --noEmit || true

# ============================================
# Stage 3: Production runtime
# ============================================
FROM oven/bun:1-alpine AS runtime

# Install runtime dependencies for sharp and resvg-js
# These native modules need specific system libraries
RUN apk add --no-cache \
    libstdc++ \
    libgcc \
    # For sharp (libvips)
    vips-dev \
    # For general networking
    ca-certificates \
    # For healthcheck
    curl

# Create non-root user for security
RUN addgroup -g 1001 -S pixelserve && \
    adduser -u 1001 -S pixelserve -G pixelserve

WORKDIR /app

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code (Bun runs TypeScript directly)
COPY --chown=pixelserve:pixelserve src ./src
COPY --chown=pixelserve:pixelserve package.json ./

# Copy templates directory
COPY --chown=pixelserve:pixelserve templates ./templates

# Create cache and fonts directories with proper permissions
RUN mkdir -p cache fonts && \
    chown -R pixelserve:pixelserve cache fonts

# Environment variables with sensible defaults
ENV NODE_ENV=production \
    PORT=3000 \
    CACHE_MODE=disk \
    CACHE_DIR=./cache \
    TEMPLATES_DIR=./templates

# Switch to non-root user
USER pixelserve

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["bun", "run", "src/index.ts"]
