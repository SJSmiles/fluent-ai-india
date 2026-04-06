# Use the official Node.js image
FROM node:20

# Set the working directory in the container
WORKDIR /app

# Copy package.json and yarn.lock (or package-lock.json if using npm)
COPY package.json yarn.lock ./

# Install dependencies, including bcrypt
RUN yarn install

# Rebuild bcrypt to handle native modules
RUN npm rebuild bcrypt --build-from-source

# Copy the rest of the application code
COPY . .

# Build the TypeScript code to JavaScript
RUN yarn build

# Ensure bcrypt native modules are compatible with the built code
RUN npm rebuild bcrypt --build-from-source

# Start the application using the compiled JavaScript
CMD ["node", "./dist/src/index.js"]
