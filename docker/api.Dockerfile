# API (NestJS) — imagem de produção. Build: docker compose -f docker-compose.prod.yml build api
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api... --ignore-scripts
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm rebuild argon2 \
  && pnpm --filter @metabi/shared build \
  && DATABASE_URL=postgresql://build:postgres@localhost:5432/build pnpm --filter api exec prisma generate \
  && pnpm --filter api build \
  && pnpm --filter api deploy --legacy --prod /out \
  && cp -r apps/api/dist /out/dist

# Estágio usado só para rodar migrations (tem a CLI do Prisma).
FROM build AS migrate
WORKDIR /repo/apps/api
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

FROM node:24-alpine AS runtime
ENV NODE_ENV=production TZ=America/Sao_Paulo PDF_CHROMIUM_PATH=/usr/bin/chromium-browser
# O container roda com o disco somente leitura (read_only no compose; só /tmp é gravável). O Chromium
# precisa gravar perfil e o banco de relatórios de falha: sem isto ele morre ao abrir
# ("chrome_crashpad_handler: --database is required") e o PDF falha.
ENV XDG_CONFIG_HOME=/tmp/.chromium XDG_CACHE_HOME=/tmp/.chromium
# Chromium do sistema (o empacotado pelo Playwright não roda em musl) + fontes para o PDF (ADR 0004).
RUN apk add --no-cache tzdata chromium font-noto ttf-freefont
WORKDIR /app
COPY --from=build --chown=node:node /out ./
# Pasta dos uploads já pertencendo ao usuário da API: o volume "storage" é montado aqui e, vazio, herda
# este dono. Sem isso o volume nasce do root e a importação falha com EACCES (a API roda como node).
RUN mkdir -p /app/storage/uploads && chown -R node:node /app/storage
USER node
EXPOSE 4318
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4318/api/health || exit 1
CMD ["node", "dist/main.js"]
