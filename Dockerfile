# Imagem Linux (para hosts Linux). No Windows Server 2019 use Dockerfile.windows.
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/.output ./.output
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3789 NUXT_DATA_FILE=/app/data/orders.json
EXPOSE 3789
CMD ["node", ".output/server/index.mjs"]
