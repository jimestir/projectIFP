FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace=@stock-for-pymes/api --workspace=@stock-for-pymes/shared

# Copy source
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/shared packages/shared

# Generate Prisma client
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Build
RUN npm run build -w @stock-for-pymes/api

# Production
FROM node:20-alpine AS production
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/api/dist ./dist
COPY --from=base /app/apps/api/prisma ./prisma
COPY --from=base /app/packages/shared ./packages/shared
COPY --from=base /app/apps/api/package.json ./

ENV NODE_ENV=production

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
