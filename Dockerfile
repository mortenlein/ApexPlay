# Stage 1: Install dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm install

# Stage 2: Build the application
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client for the target platform
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:./dev.db"
RUN npm run build

# Stage 3: Production runner
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and generated client
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/sharp ./node_modules/sharp

# Bake the Prisma CLI (pinned to the exact version in package-lock.json) into the image so
# `migrate deploy` at boot needs no network and no version drift. Installing globally as root
# also fetches prisma's own alpine engines (linux-musl-openssl-3.0.x) at BUILD time; the tree
# under /usr/local is world-readable/executable, so the non-root runtime user (compose runs us
# as uid 1000) can invoke it. Bump this in lockstep with the `prisma` devDependency.
RUN npm install -g prisma@6.19.3 \
 && chmod -R a+rX /usr/local/lib/node_modules/prisma \
 && prisma --version

# Data directory for SQLite database and uploads
RUN mkdir -p /app/data /app/public/uploads && chown -R nextjs:nodejs /app/data /app/public

USER nextjs

EXPOSE 4001
ENV PORT=4001
ENV HOSTNAME=0.0.0.0

# Apply migrations with the baked-in CLI (no npx / no network at boot), then start the server.
# An existing pre-migrations DB needs a one-time
# `docker exec summit prisma migrate resolve --applied <baseline> --schema=/app/prisma/schema.prisma`.
CMD ["sh", "-c", "DATABASE_URL=file:/app/data/prod.db prisma migrate deploy --schema=/app/prisma/schema.prisma && DATABASE_URL=file:/app/data/prod.db node server.js"]
