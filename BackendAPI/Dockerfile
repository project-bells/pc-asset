# =============================================================================
# Multi-stage Dockerfile: Hardened Express/TypeScript Backend API
# Base: Node.js 20 Alpine (Minimal Attack Surface & High Performance)
# =============================================================================

# Stage 1: Build & Verification
FROM node:20-alpine AS builder

WORKDIR /app

# Install native dependencies required for compilation if any
RUN apk add --no-cache libc6-compat

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
COPY public ./public

# Build TypeScript to Javascript
RUN npm run build

# Stage 2: Production Distroless-like Minimal Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Create dedicated non-root application user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled artifacts and static assets from builder
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/public ./public

# Ensure write access for local embedded fallback directory if used
RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data

USER appuser

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4000/health || exit 1

CMD ["node", "dist/server.js"]
