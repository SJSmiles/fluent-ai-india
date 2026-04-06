# Use the official Node.js 20 image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json if available
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the TypeScript project
RUN npm run build

# Expose the port if your Express server uses one (adjust if needed)
EXPOSE 3000

# Start the compiled JavaScript file
CMD ["npm", "run", "dev"]
