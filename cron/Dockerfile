FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Run directly with ts-node (no build)
CMD ["node", "--loader", "ts-node/esm", "src/cron-runner.ts"]
