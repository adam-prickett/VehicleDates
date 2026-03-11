# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Generate Drizzle migrations and build the Vite frontend
RUN npm run db:generate && npm run build

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Install all deps (tsx is a devDep but required at runtime for the server)
COPY package*.json ./
RUN npm ci

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy server source and config
COPY src/server ./src/server
COPY drizzle.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.server.json ./

# Copy pre-generated migrations
COPY --from=builder /app/drizzle ./drizzle

# SQLite data lives in a mounted volume
RUN mkdir -p /data

ENV NODE_ENV=production
ENV DATABASE_URL=/data/vehicles.db
ENV PORT=3001

EXPOSE 3001

CMD ["npm", "run", "start:prod"]
