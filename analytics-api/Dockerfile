# ---------- Stage 1: Build ----------
FROM node:20 AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install ALL deps (including dev for build tools like tsc-alias)
RUN npm install

# Copy source
COPY . .

# Build TypeScript + resolve path aliases
RUN npm run build

# ---------- Stage 2: Production ----------
FROM node:20-alpine

WORKDIR /app

# Copy only package files
COPY package*.json ./

# Install ONLY production deps
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Optional: if you need runtime configs
# COPY .env .env

# Start app
CMD ["node", "dist/server.js"]
