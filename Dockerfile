
# ── Stage 1: Build ─────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci

# Copy source & generate Prisma client
COPY . .
RUN npx prisma generate

# Inject build-time public env vars (NEXT_PUBLIC_* phải có lúc build)
ARG NEXT_PUBLIC_BRIDGE_URL
ENV NEXT_PUBLIC_BRIDGE_URL=$NEXT_PUBLIC_BRIDGE_URL

# Build Next.js
RUN npm run build

# ── Stage 2: Production runtime ────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Install runtime dependencies for Prisma engine
RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production
ENV PRISMA_QUERY_ENGINE_TYPE=library
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=library

# Copy only what's needed
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

# Just start server - no migrate needed (DB already has schema)
CMD ["node", "server.js"]
