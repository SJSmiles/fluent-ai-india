# Use official Node.js 18 Alpine image as the base
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Ensure npm uses the official registry (fixes 403 errors)
RUN npm config set registry https://registry.npmjs.org/

# Copy only package.json (omit package-lock.json if it's missing)
COPY package.json package-lock.json* ./

# Install dependencies efficiently
RUN npm install --legacy-peer-deps

# Copy the entire project into the container after installing dependencies
COPY . .

# Ensure the frontend directory exists and switch to it
WORKDIR /app/admin

# Install frontend dependencies
RUN npm install --legacy-peer-deps

# Clean build artifacts if they exist
RUN rm -rf .angular && rm -rf build

# Build the Angular application
RUN CI=false npm run build:dev

# Move back to the root application directory
WORKDIR /app

# Expose port 3000
EXPOSE 3000

# Install serve globally to serve the built Angular app
RUN npm install -g serve

# Command to serve the Angular app from the build output directory
ENTRYPOINT ["serve", "-s", "/app/dist/fluent-admin"]
