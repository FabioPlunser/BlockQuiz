# Stage 1: Builder
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source files
COPY . .

RUN mkdir -p /app/data
ENV DATABASE_URL=file:./data/build.db

# Build the application
RUN bun --bun run build

# Stage 2: Runtime
FROM oven/bun:1-slim

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/scripts ./scripts

# Source + svelte-kit synced tsconfig are needed at runtime so scripts/seed.ts
# can resolve $lib path aliases when importing from src/.
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/svelte.config.js ./svelte.config.js
COPY --from=builder /app/.svelte-kit ./.svelte-kit

# Copy drizzle migrations for database setup
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Set environment
ENV NODE_ENV=production

# Expose the default SvelteKit port
EXPOSE 3000

# Run the production server with Bun
CMD ["sh", "-c", "bun --bun run db:push && bun ./build"]
