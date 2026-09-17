FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@10.30.0
COPY . .
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_ASSET_BASE=""
ARG NEXT_PUBLIC_AD_PROVIDER="stub"
ARG NEXT_PUBLIC_GD_GAME_ID=""
ENV NEXT_PUBLIC_HOSTED_STUDIO=1 NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_ASSET_BASE=$NEXT_PUBLIC_ASSET_BASE
ENV NEXT_PUBLIC_AD_PROVIDER=$NEXT_PUBLIC_AD_PROVIDER
ENV NEXT_PUBLIC_GD_GAME_ID=$NEXT_PUBLIC_GD_GAME_ID
RUN pnpm --filter @tk/web build

# The authoring APIs need tools/editor and packages/data at runtime.
# Keep the workspace layout; next standalone tracing omits these dynamic files.
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN npm install --global pnpm@10.30.0
COPY --from=build /app /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_HOSTED_STUDIO=1
ENV TK_STUDIO_DATA_DIR=/data/studio TK_STUDIO_ASSET_DIR=/data/assets
EXPOSE 3000
CMD ["sh", "tools/deploy/railway-start.sh"]
