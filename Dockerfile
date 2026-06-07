# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock* ./

# Install production dependencies and clean cache to keep image small
RUN yarn install --production --frozen-lockfile && yarn cache clean

# Stage 2: Final runner image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built dependencies and application files from the builder
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY database.js server.js seed.js ./

# Run under the non-root 'node' user for security
USER node

EXPOSE 3000

CMD ["node", "server.js"]
