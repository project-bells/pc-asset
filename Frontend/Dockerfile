# Multi-stage Dockerfile for Next.js 14 Web Portal
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json tsconfig.json tailwind.config.ts postcss.config.js next.config.js ./
RUN npm ci

COPY app ./app
COPY components ./components
COPY context ./context
COPY lib ./lib
COPY types ./types

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production Runner
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public 2>/dev/null || true

EXPOSE 3000
CMD ["npm", "run", "start", "--", "-p", "3000"]

