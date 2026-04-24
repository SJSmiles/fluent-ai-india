# =========================
# Build stage
# =========================
FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./

RUN yarn install

COPY . .

RUN yarn build:dev


# =========================
# Runtime stage
# =========================
FROM node:20-slim

RUN useradd -u 1001 -m appuser

WORKDIR /app

# ✅ Vite output = dist (not build)
COPY --from=builder --chown=appuser:appuser /app/dist ./dist

# Install serve
RUN npm install -g serve

USER appuser

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
