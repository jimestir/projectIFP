FROM node:20-alpine AS base
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./

# Copy workspace package files
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN npm ci --workspace=@stock-for-pymes/api --workspace=@stock-for-pymes/shared --omit=dev

# Copy source code
COPY apps/api apps/api
COPY packages/shared packages/shared

# Generate Prisma client
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Build TypeScript
RUN npm run build -w @stock-for-pymes/api

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Copy built files maintaining structure
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./
COPY --from=base /app/apps/api/package.json apps/api/
COPY --from=base /app/apps/api/dist apps/api/dist
COPY --from=base /app/apps/api/prisma apps/api/prisma
COPY --from=base /app/packages/shared packages/shared

ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=3000

EXPOSE 3000

# Start with migrations and then run the app
CMD ["sh", "-c", "cd apps/api && npx prisma migrate deploy && node dist/index.js"]
