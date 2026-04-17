FROM node:20-alpine AS deps

WORKDIR /workspace

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/bot/package.json ./apps/bot/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm ci

FROM node:20-alpine AS builder

WORKDIR /workspace

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

COPY --from=deps /workspace/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web ./apps/web
COPY apps/api/package.json ./apps/api/package.json
COPY apps/bot/package.json ./apps/bot/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm run build -w @saas/web

FROM node:20-alpine AS runner

WORKDIR /workspace
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=deps /workspace/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY --from=builder /workspace/apps/web ./apps/web

CMD ["npm", "run", "start", "-w", "@saas/web"]
