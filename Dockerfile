# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Run the build/prepare scripts to generate the www directory
RUN npm run prepare:web

# Production stage
FROM nginx:alpine

# Copy the built static files to Nginx public folder
COPY --from=builder /app/www /usr/share/nginx/html

# Copy the custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
