# Use the official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json or yarn.lock
COPY package.json ./

# Install only production dependencies first
RUN npm install

# Copy the rest of the application files
COPY . .

# Install dev dependencies and build TypeScript
RUN npm install && npm run build

# Remove dev dependencies after build to keep the image small
#RUN npm prune --production

# Set environment variable if needed
ENV NODE_ENV=production

# Set the command to run the production build
CMD ["sh", "-c", "node dist/queue-process/worker.js"]
