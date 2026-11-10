# =============================================================================
# Multi-stage Dockerfile: Next.js 14 Standalone Production Portal
# Base: Node.js 20 Alpine (Minimal Footprint & High Efficiency)
# =============================================================================

# Stage 1: Dependency resolution
FROM node:20-alpine AS deps

WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci

# Stage 2: Next.js standalone build
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json tsconfig.json tailwind.config.ts postcss.config.js next.config.js ./
COPY app ./app
COPY components ./components
COPY context ./context
COPY lib ./lib
COPY types ./types
COPY public ./public

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Default client-side API path through unified Nginx reverse proxy
ENV NEXT_PUBLIC_API_URL=/api/v1

RUN npm run build

# Stage 3: Ultra-lightweight Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Hardened unprivileged system user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Automatically leverage standalone output traces (keeps image <150MB)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000 || exit 1

CMD ["node", "server.js"]
