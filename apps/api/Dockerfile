FROM node:20-alpine AS deps

WORKDIR /workspace

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json

RUN npm ci

FROM node:20-alpine AS builder

WORKDIR /workspace

COPY --from=deps /workspace/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY database ./database

RUN npm run build -w @saas/shared && npm exec -- tsc -p apps/api/tsconfig.json

FROM node:20-alpine AS runner

WORKDIR /workspace
ENV NODE_ENV=production

COPY --from=deps /workspace/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/scripts ./apps/api/scripts
COPY --from=builder /workspace/packages/shared/dist ./packages/shared/dist
COPY --from=builder /workspace/apps/api/dist ./apps/api/dist
COPY database ./database

CMD ["sh", "-c", "npm run migrate -w @saas/api && npm run start -w @saas/api"]
