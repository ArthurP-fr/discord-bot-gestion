FROM node:20-alpine AS deps

WORKDIR /workspace

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/bot/package.json ./apps/bot/package.json

RUN npm ci

FROM node:20-alpine AS builder

WORKDIR /workspace

COPY --from=deps /workspace/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/bot ./apps/bot

RUN npm run build -w @saas/bot

FROM node:20-alpine AS runner

WORKDIR /workspace
ENV NODE_ENV=production

COPY --from=deps /workspace/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/bot/package.json ./apps/bot/package.json
COPY --from=builder /workspace/packages/shared/dist ./packages/shared/dist
COPY --from=builder /workspace/apps/bot/dist ./apps/bot/dist

CMD ["npm", "run", "start", "-w", "@saas/bot"]
