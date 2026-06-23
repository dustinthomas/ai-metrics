# Dockerfile
# Containerized execution for the Node.js / TypeScript parts of this project.
# (Policy: no native Node on some dev machines)
#
# Usage:
#   docker build -t ai-metrics .
#   docker run --rm ai-metrics npm run test
#   docker run --rm ai-metrics npm run build
#   docker run --rm -it ai-metrics npm run dev
#
# Dev with live code:
#   docker run --rm -v $(pwd):/app -v /app/node_modules ai-metrics npm test

FROM node:20-slim

WORKDIR /app

# Copy package files first for layer caching
COPY package.json ./

# Install dependencies (no lockfile present yet)
RUN npm install

# Copy the rest of the project
COPY . .

# Build dist for standalone cli use
RUN npm run build

# Default command runs the dev script (override as needed)
CMD ["npm", "run", "dev"]
