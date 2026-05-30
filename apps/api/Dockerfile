FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @floq/api build
# pnpm deploy creates a self-contained folder with flat node_modules (no workspace symlinks).
# --legacy: pnpm v10 needs inject-workspace-packages otherwise; legacy avoids that.
RUN pnpm --filter @floq/api deploy --prod --legacy /deploy

FROM base AS runner
WORKDIR /app

# System ffmpeg/ffprobe for video transcoding (ffmpeg-static's binary download is
# skipped by pnpm in the build). The app reads these via FFMPEG_PATH / FFPROBE_PATH.
RUN apk add --no-cache ffmpeg
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe

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
