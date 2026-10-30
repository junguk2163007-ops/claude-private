# Playwright 공식 이미지(Chromium + 의존 라이브러리 + Node 포함). package.json 의 playwright 버전과 맞춘다.
FROM mcr.microsoft.com/playwright:v1.63.0-noble AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
# better-sqlite3 미리 빌드된 바이너리를 못 받을 때 소스 빌드용
RUN apt-get update && apt-get install -y --no-install-recommends build-essential python3 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

FROM base AS run
ENV NODE_ENV=production \
    DATA_DIR=/data \
    SEED_DIR=/data/seed \
    LANG=C.UTF-8 \
    PORT=3000
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/assets ./assets
COPY --from=build /app/seed.example ./seed.example
COPY --from=build /app/scripts ./scripts
RUN mkdir -p /data && chown -R pwuser:pwuser /data /app/.next
USER pwuser
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
