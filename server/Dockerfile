# Multi-stage build for the @rummy/server package.
# Builds the shared workspace package first, then the server.
FROM node:20-alpine AS builder
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace manifests for cached install
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY server/package.json server/

RUN pnpm install --frozen-lockfile=false

# Copy sources
COPY shared shared
COPY server server

RUN pnpm --filter @rummy/shared build && pnpm --filter @rummy/server build

# Runtime image
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY --from=builder /repo/pnpm-workspace.yaml /repo/package.json /repo/tsconfig.base.json ./
COPY --from=builder /repo/shared/package.json shared/
COPY --from=builder /repo/shared/dist shared/dist
COPY --from=builder /repo/server/package.json server/
COPY --from=builder /repo/server/dist server/dist

RUN pnpm install --prod --frozen-lockfile=false

ENV PORT=3001
EXPOSE 3001
WORKDIR /app/server
CMD ["node", "dist/index.js"]
