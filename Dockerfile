# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application (no DATABASE_URL needed here)
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy package files and install all dependencies
# Note: We need devDependencies (like vite) because the bundled server code imports them
COPY package*.json ./
RUN npm ci

# Copy built application from builder
# Vite builds client to dist/public, server to dist/index.js
COPY --from=builder /app/dist ./dist

# DATABASE_URL will be available at runtime from Railway environment variables
# Railway injects the runtime port via PORT (commonly 8080), so expose it here
EXPOSE 8080

CMD ["npm", "start"]
