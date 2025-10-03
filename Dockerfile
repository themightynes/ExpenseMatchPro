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

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built application from builder
# Vite builds client to dist/public, server to dist/index.js
COPY --from=builder /app/dist ./dist

# DATABASE_URL will be available at runtime from Railway environment variables
EXPOSE 5000

CMD ["npm", "start"]
