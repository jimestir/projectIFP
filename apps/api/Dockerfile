FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

RUN npm ci --workspace=@stock-for-pymes/api --workspace=@stock-for-pymes/shared

COPY apps/api apps/api
COPY packages/shared packages/shared

RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build -w @stock-for-pymes/api

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

RUN npm ci --workspace=@stock-for-pymes/api --workspace=@stock-for-pymes/shared --omit=dev && npm cache clean --force

COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/node_modules/.prisma node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma node_modules/@prisma
COPY --from=builder /app/apps/api/prisma apps/api/prisma

EXPOSE 3000

CMD ["sh", "-c", "echo DATABASE_URL=$DATABASE_URL && cd apps/api && npx prisma migrate deploy && node dist/index.js"]
