FROM node:20-alpine

WORKDIR /app

# Copy everything needed
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN npm ci --workspace=@stock-for-pymes/api --workspace=@stock-for-pymes/shared --omit=dev

# Copy source
COPY apps/api apps/api
COPY packages/shared packages/shared

# Generate Prisma
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Build
RUN npm run build -w @stock-for-pymes/api

# Expose port
EXPOSE 3000

# Start
CMD ["sh", "-c", "cd apps/api && npx prisma migrate deploy && node dist/index.js"]
