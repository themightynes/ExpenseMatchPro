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

# Install Chromium and dependencies for Puppeteer
# Based on official Puppeteer Alpine Linux documentation:
# https://pptr.dev/troubleshooting
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Set Puppeteer to use system Chromium (Alpine installs it as chromium-browser)
# This matches the official Puppeteer Alpine setup
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files and install all dependencies
# Note: We need devDependencies (like vite) because the bundled server code imports them
COPY package*.json ./
RUN npm ci

# Copy built application from builder
# Vite builds client to dist/public, server to dist/index.js
COPY --from=builder /app/dist ./dist

# DATABASE_URL will be available at runtime from Railway environment variables
# Don't set PORT - let Railway inject it dynamically
EXPOSE 8080

CMD ["npm", "start"]
