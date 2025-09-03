# Multi-stage build for optimized production image

# Stage 1: Build the application
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install production dependencies for the server
RUN npm install express compression

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy server file
COPY server.js .

# Expose port 8080
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]