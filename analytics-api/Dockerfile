# Stage 1: Build
FROM node:20 AS builder

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled app and environment file
COPY --from=builder /app/dist ./dist
#COPY .env .env

# Expose app port
#EXPOSE 3000

# Start the app
CMD ["node", "dist/server.js"]
