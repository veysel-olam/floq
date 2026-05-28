FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @floq/api build
# pnpm deploy creates a self-contained folder with flat node_modules (no workspace symlinks)
RUN pnpm --filter @floq/api deploy --prod /deploy

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 floq

COPY --from=builder /deploy/node_modules ./node_modules
COPY --from=builder /deploy/package.json ./package.json
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/drizzle ./drizzle

USER floq
EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
