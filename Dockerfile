# ==========================================
# Phase 1: Build stage
# ==========================================
FROM node:20-alpine AS build

WORKDIR /app

# Copy package descriptors for caching layer optimization
COPY package*.json ./

# Install project dependencies
RUN npm ci

# Copy full application codebase
COPY . .

# Build the production bundle
RUN npm run build

# ==========================================
# Phase 2: Production release stage
# ==========================================
FROM nginx:1.25-alpine

# Copy the build artifacts from Stage 1 to Nginx distribution directory
COPY --from=build /app/dist /usr/share/nginx/html

# Replace the default Nginx web configuration with custom SPA rules
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose standard web traffic port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
