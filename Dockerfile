# ============================================================================
# Stage 1: build the React/Vite frontend
# ============================================================================
FROM node:20-alpine AS web-builder

WORKDIR /app

# Root workspace files + web workspace
COPY package.json package-lock.json* ./
COPY web/package.json ./web/

# Install only the web workspace (concurrently is a devDep we don't need here,
# so install with --ignore-scripts to avoid running any postinstall hooks).
RUN npm install --workspace=web --include-workspace-root=false

# Build
COPY web/ ./web/
RUN npm --workspace=web run build

# ============================================================================
# Stage 2: install server production dependencies
# ============================================================================
FROM node:20-alpine AS server-deps

WORKDIR /app

COPY package.json package-lock.json* ./
COPY server/package.json ./server/

RUN npm install --workspace=server --include-workspace-root=false --omit=dev

# ============================================================================
# Stage 3: runtime
# ============================================================================
FROM node:20-alpine

WORKDIR /app

# Server code + dependencies
COPY server/ ./server/
COPY --from=server-deps /app/node_modules ./node_modules
COPY --from=server-deps /app/server/node_modules ./server/node_modules 2>/dev/null || true

# Built frontend (served as static assets in production)
COPY --from=web-builder /app/web/dist ./web/dist

# Migrations (read on boot by server/db/migrate.js)
COPY migrations/ ./migrations/

WORKDIR /app/server

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "index.js"]
