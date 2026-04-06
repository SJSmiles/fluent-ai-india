# ------------------------
# Stage 1: Build
# ------------------------
FROM node:20 AS builder

WORKDIR /app

# Copy dependency files first
COPY package*.json ./

# Install deps (including dev), and make sure axios is new enough
RUN npm install && npm install axios@^1.6.0 @types/axios @types/ms --save-dev || true

# Copy rest of source code
COPY . .

# Build TypeScript
RUN npm run build

# ------------------------
# Stage 2: Production image
# ------------------------
FROM node:20-alpine

WORKDIR /app

# Copy only package files for prod deps
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev && npm install axios@^1.6.0

# Copy compiled build from builder stage
COPY --from=builder /app/dist ./dist

# Expose app port (optional)
# EXPOSE 3000

# Start the app
CMD ["node", "dist/server.js"]
