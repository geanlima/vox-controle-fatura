# syntax=docker/dockerfile:1

FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Build de produção (SSR + browser em dist/vox-controle-fatura)
RUN npm run build -- --configuration production

FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist/vox-controle-fatura ./dist/vox-controle-fatura

RUN chown -R node:node /app

EXPOSE 4000
ENV PORT=4000
ENV NG_ALLOWED_HOSTS=localhost,127.0.0.1

USER node

CMD ["node", "dist/vox-controle-fatura/server/server.mjs"]
